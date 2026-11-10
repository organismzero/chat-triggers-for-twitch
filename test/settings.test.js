import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { boundedNumber, normaliseOptions, normaliseTriggerSettings, MAX_COOLDOWN_SECONDS } from '../com.organismzero.chattriggers.sdPlugin/bin/core/settings.js'

describe('boundedNumber', () => {
  const limits = { min: 0, max: 100, fallback: 7 }

  it('parses numeric strings from text fields', () => {
    assert.equal(boundedNumber('12', limits), 12)
    assert.equal(boundedNumber('2.5', limits), 2.5)
  })

  it('clamps to the bounds', () => {
    assert.equal(boundedNumber(-5, limits), 0)
    assert.equal(boundedNumber('1000', limits), 100)
  })

  it('falls back for blanks and nonsense', () => {
    for (const value of [undefined, null, '', 'abc', NaN, Infinity, true, {}]) {
      assert.equal(boundedNumber(value, limits), 7, String(value))
    }
  })
})

describe('normaliseTriggerSettings', () => {
  it('fills in defaults for an empty key', () => {
    assert.deepEqual(normaliseTriggerSettings(undefined), {
      command: '',
      targetId: '',
      targetLabel: '',
      allowed: ['broadcaster', 'moderator'],
      globalCooldown: 10,
      userCooldown: 30,
      enabled: true
    })
  })

  it('normalises values from the property inspector', () => {
    const settings = normaliseTriggerSettings({
      command: ' !Lights ',
      targetId: ' abc ',
      targetLabel: 'Lights on',
      allowed: ['everyone'],
      globalCooldown: '0',
      userCooldown: String(MAX_COOLDOWN_SECONDS * 2),
      enabled: false
    })
    assert.deepEqual(settings, {
      command: '!lights',
      targetId: 'abc',
      targetLabel: 'Lights on',
      allowed: ['everyone'],
      globalCooldown: 0,
      userCooldown: MAX_COOLDOWN_SECONDS,
      enabled: false
    })
  })

  it('only disables when explicitly false', () => {
    assert.equal(normaliseTriggerSettings({ enabled: 'false' }).enabled, true)
    assert.equal(normaliseTriggerSettings({ enabled: 0 }).enabled, true)
  })

  it('ignores non-string targets', () => {
    assert.equal(normaliseTriggerSettings({ targetId: 42 }).targetId, '')
  })
})

describe('normaliseOptions', () => {
  it('uses the defaults', () => {
    assert.deepEqual(normaliseOptions(undefined), { rateLimitCount: 5, rateLimitWindow: 10, longPressMs: 600, debugLogging: false })
  })

  it('only turns debug logging on for an explicit true', () => {
    assert.equal(normaliseOptions({ debugLogging: true }).debugLogging, true)
    assert.equal(normaliseOptions({ debugLogging: 'true' }).debugLogging, false)
    assert.equal(normaliseOptions({ debugLogging: 1 }).debugLogging, false)
  })

  it('clamps and rounds', () => {
    assert.deepEqual(normaliseOptions({ rateLimitCount: '0', rateLimitWindow: '99999', longPressMs: '450.6' }), {
      rateLimitCount: 1,
      rateLimitWindow: 3600,
      longPressMs: 451,
      debugLogging: false
    })
  })
})
