import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { App, SETTINGS_VERSION } from '../com.organismzero.chattriggers.sdPlugin/bin/app.js'

const OWNER = 'owner-id'
const quiet = { debug () {}, info () {}, warn () {}, error () {}, createScope () { return quiet } }

function fakeStreamDeck (saved = {}) {
  const writes = []
  return {
    writes,
    logger: { ...quiet, setLevel () {} },
    settings: {
      getGlobalSettings: async () => structuredClone(saved),
      setGlobalSettings: async (settings) => { writes.push(structuredClone(settings)) }
    }
  }
}

class FakeMcp extends EventEmitter {
  status = { state: 'ready' }
  actions = [{ id: 'lights', title: 'Lights', description: { name: 'Multi Action' } }]
  executed = []
  /** Resolves the next execute call when the test says so. */
  gate = null
  async start () {}
  async stop () {}
  async restart () {}
  async execute (id) {
    this.executed.push(id)
    if (this.gate) await this.gate
    return this.actions.some(action => action.id === id) ? { ok: true } : { ok: false, notFound: true, message: 'Action not found' }
  }
}

class FakeAuth extends EventEmitter {
  userId = OWNER
  load () {}
}

class FakeChat extends EventEmitter {
  status = { state: 'connected' }
  start () {}
  stop () {}
}

async function makeApp (saved) {
  const streamDeck = fakeStreamDeck(saved)
  const app = new App({ streamDeck, clientId: 'test', scopes: [], version: '0.0.0' })
  app.mcp = new FakeMcp()
  app.auth = new FakeAuth()
  app.chat = new FakeChat()
  await app.start()
  return { app, streamDeck }
}

const trigger = (overrides = {}) => ({
  command: '!lights', targetId: 'lights', allowed: ['everyone'], globalCooldown: 0, userCooldown: 0, ...overrides
})

const message = (overrides = {}) => ({
  text: '!lights', chatterId: 'viewer-1', chatterName: 'viewer', broadcasterId: OWNER, badges: {}, ...overrides
})

const tick = () => new Promise(resolve => setImmediate(resolve))

describe('App', () => {
  let app, streamDeck
  beforeEach(async () => {
    ({ app, streamDeck } = await makeApp())
  })

  it('runs the configured action, never anything from the message', async () => {
    app.upsertTrigger('key-1', trigger(), true)
    app.handleMessage(message({ text: '!lights other-action-id ; rm -rf /' }))
    await tick()
    assert.deepEqual(app.mcp.executed, ['lights'])
  })

  it('applies the global cooldown to a burst that arrives before the first run finishes', async () => {
    app.upsertTrigger('key-1', trigger({ globalCooldown: 30 }), true)
    let release
    app.mcp.gate = new Promise(resolve => { release = resolve })
    for (let i = 0; i < 10; i++) app.handleMessage(message({ chatterId: `viewer-${i}` }))
    release()
    await tick()
    assert.equal(app.mcp.executed.length, 1)
  })

  it('applies the per-user cooldown', async () => {
    app.upsertTrigger('key-1', trigger({ userCooldown: 30 }), true)
    app.handleMessage(message())
    app.handleMessage(message())
    app.handleMessage(message({ chatterId: 'viewer-2' }))
    await tick()
    assert.equal(app.mcp.executed.length, 2)
  })

  it('stops at the global rate limit across triggers', async () => {
    app.setOptions({ rateLimitCount: 3, rateLimitWindow: 60 })
    app.upsertTrigger('key-1', trigger(), true)
    app.upsertTrigger('key-2', trigger({ command: '!more' }), true)
    for (let i = 0; i < 4; i++) {
      app.handleMessage(message({ chatterId: `a${i}` }))
      app.handleMessage(message({ chatterId: `b${i}`, text: '!more' }))
    }
    await tick()
    assert.equal(app.mcp.executed.length, 3)
  })

  it('ignores messages from other channels in shared chat', async () => {
    app.upsertTrigger('key-1', trigger(), true)
    app.handleMessage(message({ sourceBroadcasterId: 'someone-else' }))
    await tick()
    assert.equal(app.mcp.executed.length, 0)
  })

  it('checks permissions before running', async () => {
    app.upsertTrigger('key-1', trigger({ allowed: ['moderator'] }), true)
    app.handleMessage(message())
    app.handleMessage(message({ chatterId: 'mod', badges: { moderator: '1' } }))
    await tick()
    assert.equal(app.mcp.executed.length, 1)
  })

  it('does not run, and shows as missing, when the target has gone from the MCP Deck', async () => {
    app.upsertTrigger('key-1', trigger({ targetId: 'deleted' }), true)
    app.handleMessage(message())
    await tick()
    assert.equal(app.mcp.executed.length, 0)
    assert.equal(app.lookFor('key-1'), 'broken')
  })

  it('reports a failed run when the action disappears between listing and running', async () => {
    app.upsertTrigger('key-1', trigger(), true)
    const failed = []
    app.on('failed', (id, result) => failed.push([id, result.notFound]))
    app.mcp.actions = [{ id: 'lights', title: 'Lights', description: { name: 'Multi Action' } }]
    app.mcp.execute = async () => ({ ok: false, notFound: true, message: 'Action not found' })
    app.handleMessage(message())
    await tick()
    assert.deepEqual(failed, [['key-1', true]])
  })

  it('looks offline while chat or MCP is down', () => {
    app.upsertTrigger('key-1', trigger(), true)
    assert.equal(app.lookFor('key-1'), 'ready')
    app.chat.status = { state: 'connecting' }
    assert.equal(app.lookFor('key-1'), 'offline')
  })

  it('will not forget a trigger whose key is on show', () => {
    app.upsertTrigger('key-1', trigger(), true)
    app.forgetTrigger('key-1')
    assert.ok(app.triggers.has('key-1'))
  })

  it('restarts chat when a different account signs in', () => {
    let starts = 0
    app.chat.start = () => { starts++ }
    app.auth.userId = 'second-account'
    app.auth.emit('status', { state: 'signed-in' })
    app.auth.emit('status', { state: 'signed-in' })
    assert.equal(starts, 1)
  })

  it('forgets a hidden trigger so it no longer responds', async () => {
    app.upsertTrigger('key-1', trigger(), true)
    app.setVisible('key-1', false)
    app.forgetTrigger('key-1')
    app.handleMessage(message())
    await tick()
    assert.equal(app.mcp.executed.length, 0)
    assert.deepEqual(app.store.get().triggers, {})
  })

  it('only saves when a trigger changes', async () => {
    app.upsertTrigger('key-1', trigger(), true)
    await tick()
    const count = streamDeck.writes.length
    app.upsertTrigger('key-1', trigger(), true)
    await tick()
    assert.equal(streamDeck.writes.length, count)
  })
})

describe('App settings', () => {
  it('keeps the Twitch sign-in and remembered triggers when starting', async () => {
    const saved = { twitch: { userId: OWNER, token: 'secret' }, triggers: { 'key-1': trigger() } }
    const { app } = await makeApp(saved)
    assert.deepEqual(app.store.get().twitch, saved.twitch)
    assert.equal(app.triggers.get('key-1').settings.command, '!lights')
  })

  it('stamps settings from 0.1 builds with the current format', async () => {
    const { app } = await makeApp({ triggers: {} })
    assert.equal(app.store.get().settingsVersion, SETTINGS_VERSION)
  })

  it('leaves settings from a newer version unstamped', async () => {
    const { app, streamDeck } = await makeApp({ settingsVersion: SETTINGS_VERSION + 1 })
    await tick()
    assert.equal(app.store.get().settingsVersion, SETTINGS_VERSION + 1)
    assert.equal(streamDeck.writes.length, 0)
  })
})
