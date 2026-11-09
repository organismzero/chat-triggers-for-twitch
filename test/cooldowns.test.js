import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Cooldowns } from '../com.organismzero.chattriggers.sdPlugin/bin/core/cooldowns.js'

function setup () {
  const clock = { now: 1_000_000 }
  const cooldowns = new Cooldowns(() => clock.now)
  return { clock, cooldowns }
}

const limits = { globalSeconds: 10, userSeconds: 30 }

describe('Cooldowns', () => {
  it('allows the first use', () => {
    const { cooldowns } = setup()
    assert.deepEqual(cooldowns.check('t', 'alice', limits), { ok: true })
  })

  it('blocks everyone during the global cooldown', () => {
    const { clock, cooldowns } = setup()
    cooldowns.record('t', 'alice', limits)
    clock.now += 4_000
    assert.deepEqual(cooldowns.check('t', 'bob', limits), { ok: false, reason: 'global', remainingMs: 6_000 })
  })

  it('lets others in once the global cooldown ends, but not the same user', () => {
    const { clock, cooldowns } = setup()
    cooldowns.record('t', 'alice', limits)
    clock.now += 10_000
    assert.deepEqual(cooldowns.check('t', 'bob', limits), { ok: true })
    assert.deepEqual(cooldowns.check('t', 'alice', limits), { ok: false, reason: 'user', remainingMs: 20_000 })
  })

  it('lets the same user in once the per-user cooldown ends', () => {
    const { clock, cooldowns } = setup()
    cooldowns.record('t', 'alice', limits)
    clock.now += 30_000
    assert.deepEqual(cooldowns.check('t', 'alice', limits), { ok: true })
  })

  it('keeps triggers independent', () => {
    const { cooldowns } = setup()
    cooldowns.record('a', 'alice', limits)
    assert.deepEqual(cooldowns.check('b', 'alice', limits), { ok: true })
  })

  it('treats zero as no cooldown', () => {
    const { cooldowns } = setup()
    const none = { globalSeconds: 0, userSeconds: 0 }
    cooldowns.record('t', 'alice', none)
    assert.deepEqual(cooldowns.check('t', 'alice', none), { ok: true })
  })

  it('does not start a cooldown on check alone', () => {
    const { cooldowns } = setup()
    cooldowns.check('t', 'alice', limits)
    assert.deepEqual(cooldowns.check('t', 'alice', limits), { ok: true })
  })

  it('applies a lowered cooldown straight away', () => {
    const { clock, cooldowns } = setup()
    cooldowns.record('t', 'alice', limits)
    clock.now += 5_000
    assert.deepEqual(cooldowns.check('t', 'alice', { globalSeconds: 2, userSeconds: 2 }), { ok: true })
  })

  it('forgets a trigger', () => {
    const { cooldowns } = setup()
    cooldowns.record('t', 'alice', limits)
    cooldowns.forget('t')
    assert.deepEqual(cooldowns.check('t', 'alice', limits), { ok: true })
  })
})
