// The Trigger key: one chat command that runs one MCP Deck action.
//   Press: run the action now, as a test (no permission or cooldown checks).
//   Hold:  enable or disable the trigger.

import streamDeck, { SingletonAction } from '@elgato/streamdeck'
import { ACTION_UUIDS } from '../config.js'
import { triggerImage } from '../core/key-images.js'
import { actionLabel } from '../core/mcp-actions.js'
import { TRIGGER_DEFAULTS } from '../core/settings.js'
import { DEFAULT_ALLOWED_ROLES } from '../core/permissions.js'

const FLASH_MS = 1200
const DATASOURCE = 'getDeckActions'

export class TriggerAction extends SingletonAction {
  manifestId = ACTION_UUIDS.trigger
  /** @type {Map<string, { timer: NodeJS.Timeout | null, held: boolean }>} */
  #presses = new Map()
  /** @type {Map<string, { look: string, timer: NodeJS.Timeout }>} */
  #flashes = new Map()
  #app

  /** @param {import('../app.js').App} app */
  constructor (app) {
    super()
    this.#app = app
    app.on('change', () => {
      this.#renderAll()
      this.#updatePropertyInspector()
    })
    app.on('fired', (id) => this.#flash(id, 'fired'))
    app.on('failed', (id) => this.#flash(id, 'failed'))
  }

  async onWillAppear (ev) {
    await this.#app.ready
    if (!ev.action.isKey()) return
    let settings = ev.payload.settings
    // Write the defaults into a new key's settings so the property inspector shows them.
    if (settings.allowed === undefined) {
      settings = {
        allowed: [...DEFAULT_ALLOWED_ROLES],
        globalCooldown: TRIGGER_DEFAULTS.globalCooldown,
        userCooldown: TRIGGER_DEFAULTS.userCooldown,
        enabled: true,
        ...settings
      }
      await ev.action.setSettings(settings)
    }
    this.#app.upsertTrigger(ev.action.id, settings, true)
  }

  async onWillDisappear (ev) {
    await this.#app.ready
    this.#cancelPress(ev.action.id)
    this.#app.setVisible(ev.action.id, false)
  }

  async onDidReceiveSettings (ev) {
    await this.#app.ready
    this.#app.upsertTrigger(ev.action.id, ev.payload.settings, true)
  }

  async onKeyDown (ev) {
    await this.#app.ready
    const id = ev.action.id
    this.#cancelPress(id)
    const press = { timer: null, held: false }
    press.timer = setTimeout(() => {
      press.held = true
      press.timer = null
      this.#toggle(ev.action).catch(() => {})
    }, this.#app.options.longPressMs)
    this.#presses.set(id, press)
  }

  async onKeyUp (ev) {
    await this.#app.ready
    const id = ev.action.id
    const press = this.#presses.get(id)
    this.#presses.delete(id)
    if (!press || press.held) return
    clearTimeout(press.timer)
    const result = await this.#app.test(id)
    if (!result.ok) await ev.action.showAlert()
  }

  async onPropertyInspectorDidAppear () {
    await this.#app.ready
    this.#updatePropertyInspector()
  }

  async onSendToPlugin (ev) {
    await this.#app.ready
    const event = ev.payload?.event
    if (event === DATASOURCE) {
      await this.#sendDeckActions(ev.action.id)
    } else if (event === 'refreshDeckActions') {
      await this.#app.mcp.refresh().catch(() => {})
      await this.#sendDeckActions(ev.action.id)
    }
  }

  async #toggle (action) {
    const settings = await action.getSettings()
    const enabled = settings.enabled === false
    const updated = { ...settings, enabled }
    await action.setSettings(updated)
    this.#app.upsertTrigger(action.id, updated, true)
    await action.showOk()
  }

  #cancelPress (id) {
    const press = this.#presses.get(id)
    if (press?.timer) clearTimeout(press.timer)
    this.#presses.delete(id)
  }

  #flash (id, look) {
    const previous = this.#flashes.get(id)
    if (previous) clearTimeout(previous.timer)
    const timer = setTimeout(() => {
      this.#flashes.delete(id)
      this.#render(id)
    }, FLASH_MS)
    this.#flashes.set(id, { look, timer })
    this.#render(id)
  }

  #renderAll () {
    for (const action of this.actions) this.#render(action.id)
  }

  #render (id) {
    const action = streamDeck.actions.getActionById(id)
    if (!action?.isKey()) return
    const entry = this.#app.triggers.get(id)
    const look = this.#flashes.get(id)?.look ?? this.#app.lookFor(id)
    action.setImage(triggerImage({ command: entry?.settings.command ?? '', look })).catch(() => {})
  }

  /** Sends the MCP Deck actions to the property inspector's dropdown (sdpi-components data source). */
  async #sendDeckActions (id) {
    const { mcp } = this.#app
    const entry = this.#app.triggers.get(id)
    const targetId = entry?.settings.targetId ?? ''
    const items = [{ value: '', label: 'Choose an action…' }]
    for (const action of mcp.actions) items.push({ value: action.id, label: actionLabel(action) })
    if (targetId && !mcp.actions.some(action => action.id === targetId)) {
      const name = entry.settings.targetLabel || 'unknown action'
      items.push({ value: targetId, label: mcp.status.state === 'ready' ? `Missing: ${name}` : name })
    }
    await streamDeck.ui.sendToPropertyInspector({ event: DATASOURCE, items })
  }

  /** Tells an open property inspector about the selected key's state. */
  #updatePropertyInspector () {
    const action = streamDeck.ui.action
    if (!action || action.manifestId !== this.manifestId) return
    const app = this.#app
    const notes = []
    const look = app.lookFor(action.id)
    if (look === 'broken') notes.push('The chosen action is no longer on the MCP Deck. Choose another, or put it back.')
    if (look === 'disabled') notes.push('This trigger is off. Hold the key to turn it back on.')
    if (look === 'unset') notes.push('Enter a command and choose an action.')
    if (app.chat.status.state !== 'connected') notes.push('Twitch chat isn\'t connected; see the Status key.')
    if (app.mcp.status.state !== 'ready') notes.push(app.mcp.status.message || 'The MCP connection isn\'t ready; see the Status key.')
    streamDeck.ui.sendToPropertyInspector({ event: 'triggerStatus', notes }).catch(() => {})
    this.#sendDeckActions(action.id).catch(() => {})
  }
}
