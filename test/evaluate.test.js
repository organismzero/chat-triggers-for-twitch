import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate, isFromOwnChannel } from '../com.organismzero.chattriggers.sdPlugin/bin/core/evaluate.js'
import { Cooldowns } from '../com.organismzero.chattriggers.sdPlugin/bin/core/cooldowns.js'
import { RateLimiter } from '../com.organismzero.chattriggers.sdPlugin/bin/core/rate-limit.js'
import { normaliseTriggerSettings } from '../com.organismzero.chattriggers.sdPlugin/bin/core/settings.js'

function setup ({ settings = {}, broken = false, maxEvents = 5 } = {}) {
  const clock = { now: 0 }
  const limits = {
    cooldowns: new Cooldowns(() => clock.now),
    rateLimiter: new RateLimiter({ maxEvents, windowSeconds: 10 }, () => clock.now)
  }
  const trigger = {
    id: 'key-1',
    broken,
    settings: normaliseTriggerSettings({ command: '!lights', targetId: 'action-1', allowed: ['moderator'], ...settings })
  }
  return { clock, limits, trigger }
}

const message = (overrides = {}) => ({
  text: '!lights',
  chatterId: '2',
  chatterName: 'alice',
  badges: { moderator: '1' },
  broadcasterId: '1',
  sourceBroadcasterId: null,
  ...overrides
})

describe('isFromOwnChannel', () => {
  it('accepts normal messages and shared-chat messages sent in this channel', () => {
    assert.ok(isFromOwnChannel(message()))
    assert.ok(isFromOwnChannel(message({ sourceBroadcasterId: '1' })))
  })

  it('rejects shared-chat messages sent in a partner channel', () => {
    assert.equal(isFromOwnChannel(message({ sourceBroadcasterId: '99' })), false)
  })
})

describe('evaluate', () => {
  it('runs when every check passes', () => {
    const { limits, trigger } = setup()
    assert.deepEqual(evaluate(message(), trigger, limits), { run: true })
  })

  it('ignores messages from a partner channel during shared chat, even from its moderators', () => {
    const { limits, trigger } = setup()
    assert.deepEqual(evaluate(message({ sourceBroadcasterId: '99' }), trigger, limits), { run: false, reason: 'other-channel' })
  })

  it('ignores other commands', () => {
    const { limits, trigger } = setup()
    assert.deepEqual(evaluate(message({ text: '!other' }), trigger, limits), { run: false, reason: 'no-match' })
  })

  it('does nothing when disabled', () => {
    const { limits, trigger } = setup({ settings: { enabled: false } })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: false, reason: 'disabled' })
  })

  it('does nothing without a target', () => {
    const { limits, trigger } = setup({ settings: { targetId: '' } })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: false, reason: 'no-target' })
  })

  it('does nothing when the target is missing from the MCP Deck', () => {
    const { limits, trigger } = setup({ broken: true })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: false, reason: 'broken' })
  })

  it('refuses chatters without an allowed role', () => {
    const { limits, trigger } = setup()
    assert.deepEqual(evaluate(message({ badges: { subscriber: '1' } }), trigger, limits), { run: false, reason: 'not-allowed' })
  })

  it('applies cooldowns once a use is recorded', () => {
    const { clock, limits, trigger } = setup()
    assert.deepEqual(evaluate(message(), trigger, limits), { run: true })
    limits.cooldowns.record(trigger.id, '2', { userSeconds: trigger.settings.userCooldown })
    clock.now = 1_000
    assert.deepEqual(evaluate(message({ chatterId: '3' }), trigger, limits), { run: false, reason: 'cooldown', scope: 'global', remainingMs: 9_000 })
    clock.now = 10_000
    assert.deepEqual(evaluate(message(), trigger, limits), { run: false, reason: 'cooldown', scope: 'user', remainingMs: 20_000 })
    assert.deepEqual(evaluate(message({ chatterId: '3' }), trigger, limits), { run: true })
  })

  it('applies the global rate limit last', () => {
    const { limits, trigger } = setup({ settings: { globalCooldown: 0, userCooldown: 0 }, maxEvents: 2 })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: true })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: true })
    assert.deepEqual(evaluate(message(), trigger, limits), { run: false, reason: 'rate-limited' })
  })

  it('does not use up the rate limit on refused messages', () => {
    const { limits, trigger } = setup({ maxEvents: 1 })
    evaluate(message({ badges: {} }), trigger, limits)
    evaluate(message({ text: 'hello' }), trigger, limits)
    assert.deepEqual(evaluate(message(), trigger, limits), { run: true })
  })
})
