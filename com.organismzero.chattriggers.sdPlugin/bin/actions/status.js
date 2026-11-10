// The Status key: shows whether Twitch chat and the MCP connection are up, and which channel.
// Pressing it reconnects both, or starts Twitch sign-in if the plugin isn't signed in.
// Its property inspector handles sign-in, the plugin-wide options and the list of remembered triggers.

import streamDeck, { SingletonAction } from '@elgato/streamdeck'
import { ACTION_UUIDS } from '../config.js'
import { statusImage } from '../core/key-images.js'
import { describeError } from '../core/redact.js'

const TWITCH_ORIGINS = ['https://www.twitch.tv', 'https://id.twitch.tv']

/**
 * Summarises the plugin's state for the Status key.
 * @param {import('../app.js').App} app
 * @returns {{ look: import('../core/key-images.js').StatusLook, note: string }}
 */
export function summarise (app) {
  const auth = app.auth.status
  const chat = app.chat.status
  const mcp = app.mcp.status
  if (auth.state === 'not-configured') return { look: 'problem', note: 'No client ID' }
  if (auth.state === 'pending') return { look: 'partial', note: auth.userCode }
  if (auth.state === 'needs-reconnect') return { look: 'problem', note: 'Reconnect' }
  if (auth.state === 'signed-out') return { look: 'idle', note: 'Sign in' }
  if (mcp.state === 'no-app') return { look: 'problem', note: 'MCP off' }
  if (mcp.state === 'down') return { look: 'problem', note: 'MCP down' }
  if (chat.state === 'error') return { look: 'problem', note: 'Chat error' }
  if (chat.state === 'connected' && mcp.state === 'ready') return { look: 'ok', note: 'Ready' }
  return { look: 'partial', note: 'Connecting' }
}

export class StatusAction extends SingletonAction {
  manifestId = ACTION_UUIDS.status
  #app

  /** @param {import('../app.js').App} app */
  constructor (app) {
    super()
    this.#app = app
    app.on('change', () => {
      this.#renderAll()
      this.#updatePropertyInspector()
    })
  }

  async onWillAppear (ev) {
    await this.#app.ready
    this.#render(ev.action)
  }

  async onKeyDown (ev) {
    await this.#app.ready
    const { state } = this.#app.auth.status
    if (state === 'signed-out' || state === 'needs-reconnect') {
      this.#signIn()
      return
    }
    if (state === 'pending') {
      this.#openVerification()
      return
    }
    await this.#app.reconnect()
    if (ev.action.isKey()) await ev.action.showOk()
  }

  async onPropertyInspectorDidAppear () {
    await this.#app.ready
    this.#updatePropertyInspector()
  }

  async onSendToPlugin (ev) {
    await this.#app.ready
    const payload = ev.payload ?? {}
    switch (payload.event) {
      case 'getState':
        break
      case 'signIn':
        this.#signIn()
        break
      case 'cancelSignIn':
        this.#app.auth.cancelSignIn()
        break
      case 'openVerification':
        this.#openVerification()
        break
      case 'signOut':
        await this.#app.auth.signOut()
        break
      case 'reconnect':
        await this.#app.reconnect()
        break
      case 'setOptions':
        this.#app.setOptions(payload.options)
        break
      case 'forgetTrigger':
        if (typeof payload.id === 'string') this.#app.forgetTrigger(payload.id)
        break
      default:
        return
    }
    this.#updatePropertyInspector()
  }

  #signIn () {
    const opened = new Set()
    const onStatus = (status) => {
      // Open Twitch's activation page once, as soon as there's a code.
      if (status.state === 'pending' && status.verificationUri && !opened.has(status.verificationUri)) {
        opened.add(status.verificationUri)
        this.#openVerification()
      }
    }
    this.#app.auth.on('status', onStatus)
    this.#app.auth.signIn()
      .catch(error => streamDeck.logger.debug(`Sign-in ended: ${describeError(error)}`))
      .finally(() => this.#app.auth.off('status', onStatus))
  }

  #openVerification () {
    const uri = this.#app.auth.status.verificationUri
    if (!uri) return
    let url
    try {
      url = new URL(uri)
    } catch {
      return
    }
    if (!TWITCH_ORIGINS.includes(url.origin)) {
      streamDeck.logger.warn('Ignored an unexpected sign-in link')
      return
    }
    streamDeck.system.openUrl(url.href).catch(() => {})
  }

  #renderAll () {
    for (const action of this.actions) this.#render(action)
  }

  #render (action) {
    if (!action.isKey()) return
    const { look, note } = summarise(this.#app)
    action.setImage(statusImage({
      look,
      note,
      chatOk: this.#app.chat.status.state === 'connected',
      mcpOk: this.#app.mcp.status.state === 'ready',
      channel: this.#app.auth.status.login
    })).catch(() => {})
  }

  #updatePropertyInspector () {
    const action = streamDeck.ui.action
    if (!action || action.manifestId !== this.manifestId) return
    const app = this.#app
    const auth = app.auth.status
    const triggers = [...app.triggers.values()]
      .map(entry => ({
        id: entry.id,
        command: entry.settings.command,
        target: entry.settings.targetLabel,
        visible: entry.visible,
        look: app.lookFor(entry.id)
      }))
      .sort((a, b) => a.command.localeCompare(b.command))
    streamDeck.ui.sendToPropertyInspector({
      event: 'statusState',
      twitch: { state: auth.state, login: auth.login, userCode: auth.userCode, message: auth.message },
      chat: app.chat.status,
      mcp: { ...app.mcp.status, actionCount: app.mcp.actions.length },
      options: app.options,
      triggers
    }).catch(() => {})
  }
}
