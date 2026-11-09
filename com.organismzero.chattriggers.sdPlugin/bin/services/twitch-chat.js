// Reads the signed-in broadcaster's chat with EventSub over WebSocket (channel.chat.message).
// Twurple reconnects the WebSocket by itself; this tracks the state for the Status key and turns
// an authorisation failure into the "needs reconnecting" state.

import { EventEmitter } from 'node:events'
import { ApiClient } from '@twurple/api'
import { EventSubWsListener } from '@twurple/eventsub-ws'
import { describeError } from '../core/redact.js'
import { twurpleLogger } from './twurple-logger.js'

/**
 * @typedef {'stopped' | 'connecting' | 'connected' | 'error'} ChatState
 * @typedef {{ state: ChatState, message: string }} ChatStatus
 */

/**
 * Copies just the fields the triggers need out of a Twurple event.
 * @param {import('@twurple/eventsub-base').EventSubChannelChatMessageEvent} event
 * @returns {import('../core/evaluate.js').ChatMessage}
 */
export function toChatMessage (event) {
  return {
    text: event.messageText,
    chatterId: event.chatterId,
    chatterName: event.chatterName,
    badges: event.badges,
    broadcasterId: event.broadcasterId,
    sourceBroadcasterId: event.sourceBroadcasterId ?? null
  }
}

export class TwitchChat extends EventEmitter {
  /** @type {ChatStatus} */
  #status = { state: 'stopped', message: '' }
  /** @type {EventSubWsListener | null} */
  #listener = null
  #auth
  #logger

  /**
   * @param {object} options
   * @param {import('./twitch-auth.js').TwitchAuth} options.auth
   * @param {{ debug: Function, info: Function, warn: Function, error: Function }} options.logger
   */
  constructor ({ auth, logger }) {
    super()
    this.#auth = auth
    this.#logger = logger
  }

  get status () { return this.#status }

  /** Connects to chat for the signed-in account. Does nothing when not signed in. */
  start () {
    this.stop()
    const userId = this.#auth.userId
    if (!userId) return

    const logger = twurpleLogger(this.#logger)
    const apiClient = new ApiClient({ authProvider: this.#auth.provider, logger })
    const listener = new EventSubWsListener({ apiClient, logger })
    this.#listener = listener
    const current = () => this.#listener === listener

    listener.onUserSocketConnect(() => {
      if (current()) this.#logger.debug('EventSub WebSocket connected')
    })
    listener.onUserSocketDisconnect((_userId, error) => {
      if (!current()) return
      this.#setStatus('connecting', 'Reconnecting to Twitch chat…')
      if (error) this.#logger.warn(`Twitch chat disconnected: ${describeError(error)}`)
    })
    listener.onSubscriptionCreateSuccess(() => {
      if (!current()) return
      this.#logger.info('Listening to Twitch chat')
      this.#setStatus('connected', '')
    })
    listener.onSubscriptionCreateFailure((_subscription, error) => {
      if (!current()) return
      const description = describeError(error)
      this.#logger.warn(`Couldn't subscribe to Twitch chat: ${description}`)
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        this.#auth.markNeedsReconnect('Twitch refused access to chat; sign in again')
        this.stop()
        return
      }
      this.#setStatus('error', `Couldn't connect to Twitch chat (${description})`)
    })
    listener.onRevoke((_subscription, status) => {
      if (!current()) return
      this.#auth.markNeedsReconnect(`Twitch revoked access to chat (${status}); sign in again`)
      this.stop()
    })

    listener.onChannelChatMessage(userId, userId, (event) => {
      if (current()) this.emit('message', toChatMessage(event))
    })

    this.#setStatus('connecting', 'Connecting to Twitch chat…')
    listener.start()
  }

  stop () {
    const listener = this.#listener
    this.#listener = null
    if (listener) {
      try {
        listener.stop()
      } catch (error) {
        this.#logger.debug(`Stopping the chat listener failed: ${describeError(error)}`)
      }
    }
    this.#setStatus('stopped', '')
  }

  #setStatus (state, message) {
    if (this.#status.state === state && this.#status.message === message) return
    this.#status = { state, message }
    this.emit('status', this.#status)
  }
}
