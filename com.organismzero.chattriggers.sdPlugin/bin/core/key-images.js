// Key images, drawn as SVG and passed to Stream Deck as data URLs. Pure functions.

import { COLOURS as C, markSvg } from './brand.js'

const SIZE = 144

/** Escapes text for use inside SVG. @param {string} text */
export function escapeXml (text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Shortens text to fit a key, adding an ellipsis. @param {string} text @param {number} max */
export function fit (text, max) {
  const chars = [...String(text)]
  return chars.length <= max ? chars.join('') : chars.slice(0, max - 1).join('') + '…'
}

function svg (body) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(markup)}`
}

// Key text uses the system UI font: Stream Deck renders these SVGs without web fonts.
function label (text, y, { x = 72, size = 22, colour = C.paper, weight = 600 } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${colour}">${escapeXml(text)}</text>`
}

/**
 * @typedef {'unset' | 'ready' | 'offline' | 'disabled' | 'broken' | 'fired' | 'failed'} TriggerLook
 */

const TRIGGER_LOOKS = {
  ready: { ground: C.ground, mark: C.spark, text: C.paper, noteColour: C.muted, note: '' },
  offline: { ground: C.ground, mark: C.sparkDim, text: C.muted, noteColour: C.muted, note: 'Offline' },
  disabled: { ground: C.ground, mark: C.muted, text: C.muted, noteColour: C.muted, note: 'Off' },
  broken: { ground: C.faultGround, mark: C.fault, text: C.paper, noteColour: C.fault, note: 'Missing action' },
  unset: { ground: C.ground, mark: C.muted, text: C.paper, noteColour: C.paper, note: 'Set up' },
  fired: { ground: C.spark, mark: C.onSpark, text: C.onSpark, noteColour: C.onSpark, note: '' },
  failed: { ground: C.faultGround, mark: C.fault, text: C.paper, noteColour: C.fault, note: 'Failed' }
}

/**
 * @param {{ command: string, look: TriggerLook }} options
 * @returns {string} Data URL.
 */
export function triggerImage ({ command, look }) {
  const style = TRIGGER_LOOKS[look] ?? TRIGGER_LOOKS.ready
  const lines = (command ? 1 : 0) + (style.note ? 1 : 0)
  // The mark shrinks to make room for the command and note beneath it.
  const mark = [{ y: 72, scale: 0.8 }, { y: 50, scale: 0.62 }, { y: 42, scale: 0.55 }][lines]
  const parts = [
    `<rect width="${SIZE}" height="${SIZE}" fill="${style.ground}"/>`,
    markSvg({ x: 72, ...mark, bubble: style.mark, bolt: style.mark, stroke: 11, dashed: look === 'unset' })
  ]
  if (look === 'disabled') parts.push(`<path d="M34 ${mark.y + 34}L110 ${mark.y - 34}" stroke="${C.muted}" stroke-width="7" stroke-linecap="round"/>`)
  let y = mark.y + 56
  if (command) {
    parts.push(label(fit(command, 11), y, { colour: style.text, size: 22 }))
    y += 24
  }
  if (style.note) parts.push(label(style.note, y, { colour: style.noteColour, size: 16, weight: 500 }))
  return svg(parts.join(''))
}

/**
 * @typedef {'ok' | 'partial' | 'problem' | 'idle'} StatusLook
 */

const STATUS_COLOURS = { ok: C.go, partial: C.wait, problem: C.fault, idle: C.muted }

// A filled dot when connected, a hollow ring when not: told apart by shape as well as colour.
function indicator (ok, cx) {
  return ok
    ? `<circle cx="${cx}" cy="58" r="10" fill="${C.go}"/>`
    : `<circle cx="${cx}" cy="58" r="8" fill="none" stroke="${C.fault}" stroke-width="4"/>`
}

/**
 * @param {{ look: StatusLook, chatOk: boolean, mcpOk: boolean, channel: string, note: string }} options
 * @returns {string} Data URL.
 */
export function statusImage ({ look, chatOk, mcpOk, channel, note }) {
  const colour = STATUS_COLOURS[look] ?? STATUS_COLOURS.idle
  const parts = [
    `<rect width="${SIZE}" height="${SIZE}" fill="${C.ground}"/>`,
    `<rect x="5" y="5" width="134" height="134" rx="18" fill="none" stroke="${colour}" stroke-width="6"/>`,
    label('Chat', 36, { x: 44, size: 18, colour: C.muted, weight: 500 }),
    label('MCP', 36, { x: 100, size: 18, colour: C.muted, weight: 500 }),
    indicator(chatOk, 44),
    indicator(mcpOk, 100)
  ]
  if (channel) parts.push(label(fit(channel, 12), 98, { size: 18 }))
  if (note) parts.push(label(fit(note, 14), 122, { size: 15, colour, weight: 500 }))
  return svg(parts.join(''))
}
