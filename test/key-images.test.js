import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeXml, fit, statusImage, triggerImage } from '../com.organismzero.chattriggers.sdPlugin/bin/core/key-images.js'

const decode = (url) => decodeURIComponent(url.slice(url.indexOf(',') + 1))

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    assert.equal(escapeXml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;')
  })
})

describe('fit', () => {
  it('leaves short text alone and shortens long text', () => {
    assert.equal(fit('!lights', 11), '!lights')
    assert.equal(fit('!averyverylongcommand', 8), '!averyv…')
  })

  it('counts emoji as single characters', () => {
    assert.equal(fit('🎉🎉🎉', 3), '🎉🎉🎉')
  })
})

describe('triggerImage', () => {
  it('produces an SVG data URL showing the command', () => {
    const url = triggerImage({ command: '!lights', look: 'ready' })
    assert.match(url, /^data:image\/svg\+xml;charset=utf8,/)
    assert.match(decode(url), /!lights/)
  })

  it('escapes the command so it cannot break the SVG', () => {
    const svg = decode(triggerImage({ command: '<x>&', look: 'ready' }))
    assert.match(svg, /&lt;x&gt;&amp;/)
    assert.doesNotMatch(svg, /<x>/)
  })

  it('labels problem states', () => {
    assert.match(decode(triggerImage({ command: '!a', look: 'broken' })), /Missing action/)
    assert.match(decode(triggerImage({ command: '', look: 'unset' })), /Set up/)
  })
})

describe('statusImage', () => {
  it('shows the channel and a note', () => {
    const svg = decode(statusImage({ look: 'ok', chatOk: true, mcpOk: true, channel: 'organismzero', note: 'Ready' }))
    assert.match(svg, /organismzero/)
    assert.match(svg, /Ready/)
  })
})
