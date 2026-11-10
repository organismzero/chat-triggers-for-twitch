import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GlobalStore } from '../com.organismzero.chattriggers.sdPlugin/bin/services/store.js'

function setup (initial = {}) {
  const writes = []
  const store = new GlobalStore({
    read: async () => structuredClone(initial),
    write: async (settings) => { writes.push(structuredClone(settings)) }
  })
  return { store, writes }
}

describe('GlobalStore', () => {
  it('refuses to write before loading, so saved settings cannot be replaced', () => {
    const { store, writes } = setup({ twitch: { userId: '1' } })
    assert.throws(() => store.update({ triggers: {} }), /before they were loaded/)
    assert.equal(writes.length, 0)
  })

  it('merges top-level keys, keeping the rest', async () => {
    const { store, writes } = setup({ twitch: { userId: '1' }, options: { rateLimitCount: 5 } })
    await store.load()
    await store.update({ triggers: { a: {} } })
    assert.deepEqual(writes.at(-1), { twitch: { userId: '1' }, options: { rateLimitCount: 5 }, triggers: { a: {} } })
  })

  it('writes in order', async () => {
    const { store, writes } = setup()
    await store.load()
    store.update({ n: 1 })
    store.update({ n: 2 })
    await store.update({ n: 3 })
    assert.deepEqual(writes.map(w => w.n), [1, 2, 3])
  })
})
