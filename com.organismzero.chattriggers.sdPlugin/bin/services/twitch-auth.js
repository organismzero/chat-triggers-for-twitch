// Twitch sign-in with the Device Code Grant flow, as a public client with no client secret.
//
// The user is shown a short code and a link; once they approve on Twitch, the tokens are saved in
// the plugin's global settings and refreshed automatically by Twurple. If a refresh fails (e.g.
// the user disconnected the app on Twitch), the plugin goes into a "needs reconnecting" state
// rather than retrying forever.

import { EventEmitter } from 'node:events'
import { RefreshingAuthProvider, exchangeDeviceCode, getTokenInfo, revokeToken } from '@twurple/auth'
import { describeError, twitchErrorMessage } from '../core/redact.js'

/**
 * @typedef {'not-configured' | 'signed-out' | 'pending' | 'signed-in' | 'needs-reconnect'} AuthState
 * @typedef {{ state: AuthState, login: string, userCode: string, verificationUri: string, message: string }} AuthStatus
 */

const INTENT = 'chat'
const REFRESH_RETRY_MS = 30_000

/** Whether Twitch itself turned the refresh token down, as opposed to a network problem. */
function isRejected (error) {
  return error?.statusCode === 400 || error?.statusCode === 401
}

/** Waits, unless the signal is aborted first. */
function wait (ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** @param {string[] | undefined} granted @param {readonly string[]} wanted */
function hasScopes (granted, wanted) {
  return Array.isArray(granted) && wanted.every(scope => granted.includes(scope))
}

/** Only the fields Twurple needs to restore a token. */
function serialiseToken (token) {
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    scope: token.scope,
    expiresIn: token.expiresIn,
    obtainmentTimestamp: token.obtainmentTimestamp
  }
}

export class TwitchAuth extends EventEmitter {
  /** @type {AuthStatus} */
  #status = { state: 'signed-out', login: '', userCode: '', verificationUri: '', message: '' }
  #userId = ''
  /** @type {AbortController | null} */
  #signIn = null
  /** @type {NodeJS.Timeout | undefined} */
  #retryTimer
  #provider
  #clientId
  #scopes
  #store
  #logger

  /**
   * @param {object} options
   * @param {string} options.clientId
   * @param {readonly string[]} options.scopes
   * @param {import('./store.js').GlobalStore} options.store
   * @param {{ debug: Function, info: Function, warn: Function, error: Function }} options.logger
   */
  constructor ({ clientId, scopes, store, logger }) {
    super()
    this.#clientId = clientId
    this.#scopes = scopes
    this.#store = store
    this.#logger = logger
    this.#provider = new RefreshingAuthProvider({ clientId })
    this.#provider.onRefresh((userId, token) => {
      if (userId !== this.#userId) return
      this.#logger.debug('Twitch token refreshed')
      this.#save({ token: serialiseToken(token) })
    })
    this.#provider.onRefreshFailure((userId, error) => {
      if (userId !== this.#userId) return
      if (isRejected(error)) {
        this.markNeedsReconnect(`Twitch didn't accept the saved sign-in (${describeError(error)})`)
        return
      }
      // Probably offline, e.g. Stream Deck started before the network. Keep the token and retry.
      this.#logger.warn(`Couldn't refresh the Twitch sign-in (${describeError(error)}); trying again in ${REFRESH_RETRY_MS / 1000} s`)
      this.#scheduleRetry()
    })
  }

  get status () { return this.#status }

  get provider () { return this.#provider }

  /** The signed-in user's ID, which is also the channel being watched. Empty when not signed in. */
  get userId () { return this.#status.state === 'signed-in' ? this.#userId : '' }

  /** Restores a saved sign-in from global settings. */
  load () {
    if (!this.#clientId) {
      this.#setStatus({ state: 'not-configured', message: 'This build has no Twitch client ID' })
      return
    }
    const saved = this.#saved()
    if (!saved?.userId) {
      this.#setStatus({ state: 'signed-out' })
      return
    }
    this.#userId = saved.userId
    if (!saved.token?.refreshToken) {
      this.#setStatus({ state: 'needs-reconnect', login: saved.login ?? '', message: saved.reason ?? 'Sign in to Twitch again' })
      return
    }
    if (!hasScopes(saved.token.scope, this.#scopes)) {
      this.markNeedsReconnect('Chat Triggers needs different Twitch permissions; sign in again')
      return
    }
    this.#provider.addUser(saved.userId, saved.token, [INTENT])
    this.#setStatus({ state: 'signed-in', login: saved.login ?? '' })
  }

  /**
   * Starts the Device Code flow. Resolves once the user has signed in, or rejects if it fails, is
   * cancelled or expires. Listen for `status` with state `pending` to show the code and link.
   */
  async signIn () {
    if (!this.#clientId) throw new Error('This build has no Twitch client ID')
    this.cancelSignIn()
    const controller = new AbortController()
    this.#signIn = controller
    const { signal } = controller

    try {
      const info = await this.#provider.startDeviceCodeFlow([...this.#scopes])
      if (signal.aborted) throw signal.reason
      const login = this.#status.login
      this.#setStatus({ state: 'pending', login, userCode: info.userCode, verificationUri: info.verificationUri, message: 'Waiting for you to approve on Twitch…' })

      const expires = Date.now() + info.expiresIn * 1000
      let interval = Math.max(1, info.interval) * 1000
      let token = null
      while (!token) {
        if (Date.now() > expires) throw new Error('The sign-in code expired; try again')
        await wait(interval, signal)
        try {
          token = await exchangeDeviceCode(this.#clientId, info.deviceCode, [...this.#scopes])
        } catch (error) {
          const reason = twitchErrorMessage(error)
          if (reason === 'authorization_pending') continue
          if (reason === 'slow_down') { interval += 5000; continue }
          if (/invalid device code/i.test(reason)) throw new Error('The sign-in code expired; try again')
          throw new Error(`Twitch sign-in failed (${describeError(error)})`)
        }
      }
      if (signal.aborted) throw signal.reason

      const tokenInfo = await getTokenInfo(token.accessToken, this.#clientId)
      if (!tokenInfo.userId) throw new Error('Twitch didn\'t say which account signed in')
      // Cancelled or signed out while Twitch was answering: don't save the sign-in after all.
      if (signal.aborted) throw signal.reason
      clearTimeout(this.#retryTimer)

      if (this.#userId && this.#userId !== tokenInfo.userId && this.#provider.hasUser(this.#userId)) {
        this.#provider.removeUser(this.#userId)
      }
      this.#userId = tokenInfo.userId
      this.#provider.addUser(tokenInfo.userId, token, [INTENT])
      await this.#save({ userId: tokenInfo.userId, login: tokenInfo.userName ?? '', token: serialiseToken(token), reason: undefined })
      this.#logger.info('Signed in to Twitch')
      this.#setStatus({ state: 'signed-in', login: tokenInfo.userName ?? '' })
    } catch (error) {
      if (signal.aborted) return
      this.#logger.warn(`Twitch sign-in didn't complete: ${describeError(error)}`)
      this.#setStatus({ ...this.#restingStatus(), message: describeError(error) })
      throw error
    } finally {
      if (this.#signIn === controller) this.#signIn = null
    }
  }

  /** Stops waiting for a pending sign-in. */
  cancelSignIn () {
    if (!this.#signIn) return
    this.#signIn.abort(new Error('Sign-in cancelled'))
    this.#signIn = null
    if (this.#status.state === 'pending') this.#setStatus(this.#restingStatus())
  }

  /** Signs out, revoking the token on Twitch where possible. */
  async signOut () {
    this.cancelSignIn()
    clearTimeout(this.#retryTimer)
    const token = this.#saved()?.token
    if (this.#userId && this.#provider.hasUser(this.#userId)) this.#provider.removeUser(this.#userId)
    this.#userId = ''
    await this.#store.update({ twitch: null })
    this.#setStatus({ state: 'signed-out' })
    if (token?.accessToken) {
      await revokeToken(this.#clientId, token.accessToken).catch(error => {
        this.#logger.debug(`Couldn't revoke the Twitch token: ${describeError(error)}`)
      })
    }
  }

  /**
   * Drops the saved token and asks the user to sign in again. Used when a refresh fails or Twitch
   * revokes the plugin's access.
   * @param {string} reason Shown to the user; must not contain secrets.
   */
  markNeedsReconnect (reason) {
    if (this.#status.state === 'needs-reconnect') return
    this.#logger.warn(`Twitch needs reconnecting: ${reason}`)
    clearTimeout(this.#retryTimer)
    if (this.#userId && this.#provider.hasUser(this.#userId)) this.#provider.removeUser(this.#userId)
    this.#save({ token: null, reason })
    this.#setStatus({ state: 'needs-reconnect', login: this.#status.login, message: reason })
  }

  /** Re-adds the saved token after a failed refresh, which clears Twurple's cached failure. */
  #scheduleRetry () {
    clearTimeout(this.#retryTimer)
    this.#retryTimer = setTimeout(() => {
      const token = this.#saved()?.token
      if (this.#status.state !== 'signed-in' || !token?.refreshToken) return
      if (this.#provider.hasUser(this.#userId)) this.#provider.removeUser(this.#userId)
      this.#provider.addUser(this.#userId, token, [INTENT])
      this.emit('retry')
    }, REFRESH_RETRY_MS)
    this.#retryTimer.unref?.()
  }

  #restingStatus () {
    const saved = this.#saved()
    if (this.#provider.hasUser(this.#userId)) return { state: 'signed-in', login: saved?.login ?? '' }
    if (saved?.userId) return { state: 'needs-reconnect', login: saved.login ?? '', message: saved.reason ?? '' }
    return { state: 'signed-out' }
  }

  #saved () {
    const twitch = this.#store.get().twitch
    return twitch && typeof twitch === 'object' ? twitch : null
  }

  #save (patch) {
    const twitch = { ...(this.#saved() ?? {}), userId: this.#userId, ...patch }
    return this.#store.update({ twitch })
  }

  /** @param {Partial<AuthStatus> & { state: AuthState }} status */
  #setStatus (status) {
    this.#status = { login: '', userCode: '', verificationUri: '', message: '', ...status }
    this.emit('status', this.#status)
  }
}
