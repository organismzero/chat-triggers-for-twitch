import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getRoles, isAllowed, normaliseAllowedRoles, DEFAULT_ALLOWED_ROLES } from '../com.organismzero.chattriggers.sdPlugin/bin/core/permissions.js'

const roles = (chatter) => [...getRoles({ broadcasterId: '1', ...chatter })].sort()

describe('getRoles', () => {
  it('gives everyone the everyone role', () => {
    assert.deepEqual(roles({ chatterId: '2', badges: {} }), ['everyone'])
  })

  it('identifies the broadcaster by user ID, even without the badge', () => {
    assert.deepEqual(roles({ chatterId: '1', badges: {} }), ['broadcaster', 'everyone'])
  })

  it('does not trust a broadcaster badge on someone else', () => {
    assert.deepEqual(roles({ chatterId: '2', badges: { broadcaster: '1' } }), ['everyone'])
  })

  it('maps badges to roles', () => {
    assert.deepEqual(roles({ chatterId: '2', badges: { moderator: '1' } }), ['everyone', 'moderator'])
    assert.deepEqual(roles({ chatterId: '2', badges: { lead_moderator: '1' } }), ['everyone', 'moderator'])
    assert.deepEqual(roles({ chatterId: '2', badges: { vip: '1' } }), ['everyone', 'vip'])
    assert.deepEqual(roles({ chatterId: '2', badges: { subscriber: '12' } }), ['everyone', 'subscriber'])
    assert.deepEqual(roles({ chatterId: '2', badges: { founder: '0' } }), ['everyone', 'subscriber'])
  })

  it('ignores unrelated badges', () => {
    assert.deepEqual(roles({ chatterId: '2', badges: { 'bits-leader': '1', premium: '1' } }), ['everyone'])
  })

  it('copes with missing badges', () => {
    assert.deepEqual(roles({ chatterId: '2', badges: null }), ['everyone'])
  })

  it('does not treat an empty chatter ID as the broadcaster', () => {
    assert.deepEqual([...getRoles({ chatterId: '', broadcasterId: '', badges: {} })], ['everyone'])
  })
})

describe('isAllowed', () => {
  const sub = getRoles({ chatterId: '2', broadcasterId: '1', badges: { subscriber: '3' } })
  const mod = getRoles({ chatterId: '3', broadcasterId: '1', badges: { moderator: '1' } })
  const viewer = getRoles({ chatterId: '4', broadcasterId: '1', badges: {} })
  const broadcaster = getRoles({ chatterId: '1', broadcasterId: '1', badges: {} })

  it('allows when any role matches', () => {
    assert.ok(isAllowed(['moderator', 'subscriber'], sub))
    assert.ok(isAllowed(['moderator', 'subscriber'], mod))
  })

  it('refuses when no role matches', () => {
    assert.equal(isAllowed(['moderator'], sub), false)
    assert.equal(isAllowed(['broadcaster', 'moderator', 'vip', 'subscriber'], viewer), false)
  })

  it('treats roles as non-hierarchical', () => {
    assert.equal(isAllowed(['moderator'], broadcaster), false)
  })

  it('allows anyone when everyone is ticked', () => {
    assert.ok(isAllowed(['everyone'], viewer))
  })

  it('allows nobody when nothing is ticked', () => {
    assert.equal(isAllowed([], broadcaster), false)
  })
})

describe('normaliseAllowedRoles', () => {
  it('falls back to the default when not an array', () => {
    assert.deepEqual(normaliseAllowedRoles(undefined), [...DEFAULT_ALLOWED_ROLES])
    assert.deepEqual(normaliseAllowedRoles('moderator'), [...DEFAULT_ALLOWED_ROLES])
  })

  it('drops unknown roles and duplicates, keeping a stable order', () => {
    assert.deepEqual(normaliseAllowedRoles(['vip', 'admin', 'vip', 'broadcaster']), ['broadcaster', 'vip'])
  })

  it('keeps an empty list empty', () => {
    assert.deepEqual(normaliseAllowedRoles([]), [])
  })
})
