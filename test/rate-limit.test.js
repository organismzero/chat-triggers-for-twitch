import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter } from '../com.organismzero.chattriggers.sdPlugin/bin/core/rate-limit.js'

function setup (limits = { maxEvents: 3, windowSeconds: 10 }) {
  const clock = { now: 0 }
  const limiter = new RateLimiter(limits, () => clock.now)
  return { clock, limiter }
}

describe('RateLimiter', () => {
  it('allows up to the limit within the window', () => {
    const { limiter } = setup()
    assert.ok(limiter.tryTake())
    assert.ok(limiter.tryTake())
    assert.ok(limiter.tryTake())
    assert.equal(limiter.tryTake(), false)
  })

  it('frees capacity as old events leave the window', () => {
    const { clock, limiter } = setup()
    limiter.tryTake()
    clock.now = 4_000
    limiter.tryTake()
    limiter.tryTake()
    clock.now = 9_999
    assert.equal(limiter.tryTake(), false)
    clock.now = 10_000
    assert.ok(limiter.tryTake())
    assert.equal(limiter.tryTake(), false)
  })

  it('does not count refused attempts', () => {
    const { clock, limiter } = setup({ maxEvents: 1, windowSeconds: 10 })
    limiter.tryTake()
    clock.now = 5_000
    assert.equal(limiter.tryTake(), false)
    clock.now = 10_000
    assert.ok(limiter.tryTake())
  })

  it('checks capacity without using it', () => {
    const { limiter } = setup({ maxEvents: 1, windowSeconds: 10 })
    assert.ok(limiter.canTake())
    assert.ok(limiter.canTake())
    assert.ok(limiter.tryTake())
    assert.equal(limiter.canTake(), false)
  })

  it('can be reconfigured while running', () => {
    const { limiter } = setup({ maxEvents: 1, windowSeconds: 10 })
    limiter.tryTake()
    limiter.configure({ maxEvents: 2, windowSeconds: 10 })
    assert.ok(limiter.tryTake())
    assert.equal(limiter.tryTake(), false)
  })
})
