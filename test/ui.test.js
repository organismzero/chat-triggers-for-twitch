import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const built = (name) => fileURLToPath(new URL(`../com.organismzero.chattriggers.sdPlugin/ui/${name}`, import.meta.url))

describe('property inspector build', () => {
  it('embeds every script and stylesheet, so a page loads no separate files', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/build-ui.js', import.meta.url))], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    for (const name of ['trigger.html', 'status.html']) {
      const html = readFileSync(built(name), 'utf8')
      assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/)
      // Stream Deck calls this to connect the page, so it must be defined by the embedded library.
      assert.match(html, /connectElgatoStreamDeckSocket/)
      assert.match(html, /<style>/)
    }
  })
})
