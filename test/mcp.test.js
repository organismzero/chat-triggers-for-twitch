import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpService } from '../com.organismzero.chattriggers.sdPlugin/bin/services/mcp.js'

// Must match the fixture, which records each server's process ID here.
const PID_FILE = join(tmpdir(), 'chat-triggers-fake-mcp-pids.txt')
const bridgePath = fileURLToPath(new URL('./fixtures/fake-mcp-bridge.js', import.meta.url))
const quiet = { debug () {}, info () {}, warn () {}, error () {} }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function running () {
  let pids = []
  try { pids = readFileSync(PID_FILE, 'utf8').split('\n').filter(Boolean).map(Number) } catch {}
  return pids.filter(pid => {
    if (pid === process.pid) return false
    try { process.kill(pid, 0); return true } catch { return false }
  })
}

async function until (check, ms = 5000) {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await sleep(50)
}

describe('McpService', () => {
  before(() => rmSync(PID_FILE, { force: true }))
  after(() => rmSync(PID_FILE, { force: true }))

  it('lists actions, runs one and reports a missing one', async () => {
    const mcp = new McpService({ logger: quiet, bridgePath })
    await mcp.start()
    assert.equal(mcp.status.state, 'ready')
    assert.deepEqual(mcp.actions.map(action => action.id), ['lights'])
    assert.deepEqual(await mcp.execute('lights'), { ok: true })
    assert.equal((await mcp.execute('gone')).notFound, true)
    await mcp.stop()
  })

  it('leaves exactly one server running when started and restarted while connecting', async () => {
    rmSync(PID_FILE, { force: true })
    const mcp = new McpService({ logger: quiet, bridgePath })
    await Promise.all([mcp.start(), mcp.start(), sleep(50).then(() => mcp.restart())])
    assert.equal(mcp.status.state, 'ready')
    await until(() => running().length === 1)
    assert.equal(running().length, 1)

    await mcp.stop()
    await until(() => running().length === 0)
    assert.equal(running().length, 0)
  })
})
