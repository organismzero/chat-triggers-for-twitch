// Ties the services together: chat messages in, MCP Deck actions out, with every check in between.
//
// Stream Deck only tells a plugin about keys that are visible, and can't tell a page change from
// a deleted key. So triggers are remembered in global settings once their key has been seen, and
// keep working while hidden and across restarts. Keys that were deleted can be forgotten from the
// Status key's settings.

import { EventEmitter } from 'node:events'
import { Cooldowns } from './core/cooldowns.js'
import { evaluate } from './core/evaluate.js'
import { actionLabel } from './core/mcp-actions.js'
import { RateLimiter } from './core/rate-limit.js'
import { normaliseOptions, normaliseTriggerSettings } from './core/settings.js'
import { McpService } from './services/mcp.js'
import { GlobalStore } from './services/store.js'
import { TwitchAuth } from './services/twitch-auth.js'
import { TwitchChat } from './services/twitch-chat.js'

const RATE_LIMIT_LOG_INTERVAL_MS = 10_000

/**
 * @typedef {object} TriggerEntry
 * @property {string} id The key's action ID.
 * @property {import('./core/settings.js').TriggerSettings} settings
 * @property {boolean} visible Whether the key is currently shown on a Stream Deck.
 */

export class App extends EventEmitter {
  /** @type {Map<string, TriggerEntry>} */
  triggers = new Map()
  cooldowns = new Cooldowns()
  rateLimiter = new RateLimiter({ maxEvents: 5, windowSeconds: 10 })
  options = normaliseOptions(undefined)
  #lastRateLimitLog = 0
  #logger
  #markReady
  /** Resolves once saved settings are loaded; key events wait for it. */
  ready = new Promise(resolve => { this.#markReady = resolve })

  /**
   * @param {object} options
   * @param {typeof import('@elgato/streamdeck').default} options.streamDeck
   * @param {string} options.clientId
   * @param {readonly string[]} options.scopes
   * @param {string} options.version
   */
  constructor ({ streamDeck, clientId, scopes, version }) {
    super()
    this.setMaxListeners(50)
    this.#logger = streamDeck.logger.createScope('Triggers')
    this.store = new GlobalStore({
      read: () => streamDeck.settings.getGlobalSettings(),
      write: (settings) => streamDeck.settings.setGlobalSettings(settings)
    })
    this.auth = new TwitchAuth({ clientId, scopes, store: this.store, logger: streamDeck.logger.createScope('Twitch') })
    this.chat = new TwitchChat({ auth: this.auth, logger: streamDeck.logger.createScope('Chat') })
    this.mcp = new McpService({ logger: streamDeck.logger.createScope('MCP'), clientVersion: version })
  }

  async start () {
    await this.store.load()
    this.#applyOptions(this.store.get().options)
    this.#loadTriggers()

    this.auth.on('status', (status) => {
      if (status.state === 'signed-in' && this.chat.status.state === 'stopped') this.chat.start()
      if (status.state !== 'signed-in' && status.state !== 'pending') this.chat.stop()
      this.emit('change')
    })
    this.chat.on('status', () => this.emit('change'))
    this.chat.on('message', (message) => this.handleMessage(message))
    this.mcp.on('status', () => this.emit('change'))
    this.mcp.on('actions', () => {
      this.#refreshTargetLabels()
      this.emit('change')
    })

    // Emits a status, which starts chat if a saved sign-in was restored.
    this.auth.load()
    this.#markReady()
    this.mcp.start().catch(() => {})
  }

  /** Reconnects to Twitch chat and restarts the MCP server, e.g. when the Status key is pressed. */
  async reconnect () {
    this.#logger.info('Reconnecting')
    if (this.auth.userId) this.chat.start()
    await this.mcp.restart()
  }

  // Triggers -------------------------------------------------------------------------------------

  /**
   * Adds or updates a trigger from its key's settings.
   * @param {string} id
   * @param {Record<string, unknown>} rawSettings
   * @param {boolean} visible
   */
  upsertTrigger (id, rawSettings, visible) {
    const previous = this.triggers.get(id)
    const settings = normaliseTriggerSettings(rawSettings)
    settings.targetLabel = this.#labelFor(settings.targetId) ?? (previous?.settings.targetId === settings.targetId ? previous.settings.targetLabel : '')
    this.triggers.set(id, { id, settings, visible })
    if (previous?.settings.targetId !== settings.targetId) this.cooldowns.forget(id)
    this.#saveTriggers()
    this.emit('change')
  }

  /** @param {string} id @param {boolean} visible */
  setVisible (id, visible) {
    const entry = this.triggers.get(id)
    if (!entry || entry.visible === visible) return
    entry.visible = visible
    this.emit('change')
  }

  /** Stops a trigger working, e.g. because its key was deleted. @param {string} id */
  forgetTrigger (id) {
    if (!this.triggers.delete(id)) return
    this.cooldowns.forget(id)
    this.#saveTriggers()
    this.#logger.info('Forgot a trigger')
    this.emit('change')
  }

  /** @param {import('./core/settings.js').TriggerSettings} settings */
  isBroken (settings) {
    return this.mcp.status.state === 'ready' &&
      settings.targetId !== '' &&
      !this.mcp.actions.some(action => action.id === settings.targetId)
  }

  /**
   * How a trigger's key should look.
   * @param {string} id
   * @returns {import('./core/key-images.js').TriggerLook}
   */
  lookFor (id) {
    const entry = this.triggers.get(id)
    if (!entry || !entry.settings.command || !entry.settings.targetId) return 'unset'
    if (this.isBroken(entry.settings)) return 'broken'
    if (!entry.settings.enabled) return 'disabled'
    if (this.chat.status.state !== 'connected' || this.mcp.status.state !== 'ready') return 'offline'
    return 'ready'
  }

  // Chat -----------------------------------------------------------------------------------------

  /** @param {import('./core/evaluate.js').ChatMessage} message */
  handleMessage (message) {
    for (const entry of this.triggers.values()) {
      const decision = evaluate(message, { id: entry.id, settings: entry.settings, broken: this.isBroken(entry.settings) }, this)
      if (!decision.run) {
        this.#logSkipped(entry, decision, message)
        continue
      }
      // Recorded before anything is awaited, so a burst of messages can't slip past the cooldown.
      this.cooldowns.record(entry.id, message.chatterId, { userSeconds: entry.settings.userCooldown })
      this.#logger.debug(`${entry.settings.command} used by ${message.chatterName}`)
      this.#run(entry).catch(() => {})
    }
  }

  /**
   * Runs a trigger's action from a key press. Permissions, cooldowns and the rate limit only
   * apply to chat, since the person pressing the key is the streamer.
   * @param {string} id
   */
  async test (id) {
    const entry = this.triggers.get(id)
    if (!entry?.settings.targetId) return { ok: false, notFound: false, message: 'Choose an action first' }
    return this.#run(entry)
  }

  /** @param {TriggerEntry} entry */
  async #run (entry) {
    const { command, targetId } = entry.settings
    const result = await this.mcp.execute(targetId)
    if (result.ok) {
      this.#logger.info(`Ran ${command || 'trigger'}`)
      this.emit('fired', entry.id)
    } else {
      this.#logger.warn(`Couldn't run ${command || 'trigger'}: ${result.message}`)
      this.emit('failed', entry.id, result)
    }
    return result
  }

  #logSkipped (entry, decision, message) {
    switch (decision.reason) {
      case 'no-match':
      case 'other-channel':
        return
      case 'rate-limited': {
        const now = Date.now()
        if (now - this.#lastRateLimitLog < RATE_LIMIT_LOG_INTERVAL_MS) return
        this.#lastRateLimitLog = now
        this.#logger.warn(`Rate limit reached (${this.options.rateLimitCount} per ${this.options.rateLimitWindow} s); ignoring commands for now`)
        return
      }
      case 'cooldown':
        this.#logger.debug(`${entry.settings.command} from ${message.chatterName} ignored: ${decision.scope} cooldown, ${Math.ceil(decision.remainingMs / 1000)} s left`)
        return
      default:
        this.#logger.debug(`${entry.settings.command} from ${message.chatterName} ignored: ${decision.reason}`)
    }
  }

  // Options --------------------------------------------------------------------------------------

  /** @param {Record<string, unknown>} raw */
  setOptions (raw) {
    this.#applyOptions(raw)
    this.store.update({ options: this.options })
    this.emit('change')
  }

  #applyOptions (raw) {
    this.options = normaliseOptions(raw)
    this.rateLimiter.configure({ maxEvents: this.options.rateLimitCount, windowSeconds: this.options.rateLimitWindow })
  }

  // Persistence ----------------------------------------------------------------------------------

  #loadTriggers () {
    const saved = this.store.get().triggers
    if (!saved || typeof saved !== 'object') return
    for (const [id, settings] of Object.entries(saved)) {
      this.triggers.set(id, { id, settings: normaliseTriggerSettings(settings), visible: false })
    }
    this.#logger.info(`Loaded ${this.triggers.size} trigger(s)`)
  }

  #saveTriggers () {
    const triggers = Object.fromEntries([...this.triggers.values()].map(entry => [entry.id, entry.settings]))
    this.store.update({ triggers })
  }

  #labelFor (targetId) {
    const action = targetId ? this.mcp.actions.find(item => item.id === targetId) : undefined
    return action ? actionLabel(action) : undefined
  }

  #refreshTargetLabels () {
    let changed = false
    for (const entry of this.triggers.values()) {
      const label = this.#labelFor(entry.settings.targetId)
      if (label !== undefined && label !== entry.settings.targetLabel) {
        entry.settings.targetLabel = label
        changed = true
      }
    }
    if (changed) this.#saveTriggers()
  }
}
