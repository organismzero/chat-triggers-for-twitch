// Key images, drawn as SVG and passed to Stream Deck as data URLs. Pure functions.

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

function label (text, y, { x = 72, size = 22, colour = '#ffffff', weight = 600 } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${colour}">${escapeXml(text)}</text>`
}

const BUBBLE = 'M30 18h84v52H66l-20 18V70H30z'
const BOLT = 'M78 26L64 46h14L68 62'

/**
 * @typedef {'unset' | 'ready' | 'offline' | 'disabled' | 'broken' | 'fired' | 'failed'} TriggerLook
 */

const TRIGGER_LOOKS = {
  ready: { background: '#1f1530', accent: '#a970ff', text: '#ffffff', note: '' },
  offline: { background: '#1f1530', accent: '#6b5a85', text: '#c9c2d6', note: 'Offline' },
  disabled: { background: '#1c1c1c', accent: '#5a5a5a', text: '#8a8a8a', note: 'Off' },
  broken: { background: '#3a1216', accent: '#ff5c6c', text: '#ffffff', note: 'Missing action' },
  unset: { background: '#1c1c1c', accent: '#5a5a5a', text: '#bdbdbd', note: 'Set up' },
  fired: { background: '#0f3d24', accent: '#3ddc84', text: '#ffffff', note: '' },
  failed: { background: '#3a1216', accent: '#ff5c6c', text: '#ffffff', note: 'Failed' }
}

/**
 * @param {{ command: string, look: TriggerLook }} options
 * @returns {string} Data URL.
 */
export function triggerImage ({ command, look }) {
  const style = TRIGGER_LOOKS[look] ?? TRIGGER_LOOKS.ready
  const dashed = look === 'unset' ? ' stroke-dasharray="8 6"' : ''
  const parts = [
    `<rect width="${SIZE}" height="${SIZE}" fill="${style.background}"/>`,
    `<path d="${BUBBLE}" fill="none" stroke="${style.accent}" stroke-width="6" stroke-linejoin="round"${dashed}/>`,
    `<path d="${BOLT}" fill="none" stroke="${style.text}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
  ]
  if (look === 'disabled') parts.push(`<path d="M24 100L120 22" stroke="${style.accent}" stroke-width="6" stroke-linecap="round"/>`)
  if (command) parts.push(label(fit(command, 11), 112, { colour: style.text, size: 22 }))
  if (style.note) parts.push(label(style.note, command ? 134 : 116, { colour: style.accent, size: 16, weight: 500 }))
  return svg(parts.join(''))
}

/**
 * @typedef {'ok' | 'partial' | 'problem' | 'idle'} StatusLook
 */

const STATUS_COLOURS = { ok: '#3ddc84', partial: '#ffb020', problem: '#ff5c6c', idle: '#8a8a8a' }

/**
 * @param {{ look: StatusLook, chatOk: boolean, mcpOk: boolean, channel: string, note: string }} options
 * @returns {string} Data URL.
 */
export function statusImage ({ look, chatOk, mcpOk, channel, note }) {
  const colour = STATUS_COLOURS[look] ?? STATUS_COLOURS.idle
  const dot = (ok, cx) => `<circle cx="${cx}" cy="58" r="9" fill="${ok ? STATUS_COLOURS.ok : STATUS_COLOURS.problem}"/>`
  const parts = [
    `<rect width="${SIZE}" height="${SIZE}" fill="#1c1c1c"/>`,
    `<rect x="6" y="6" width="132" height="132" rx="14" fill="none" stroke="${colour}" stroke-width="6"/>`,
    label('Chat', 36, { x: 42, size: 18, colour: '#d0d0d0', weight: 500 }),
    label('MCP', 36, { x: 102, size: 18, colour: '#d0d0d0', weight: 500 }),
    dot(chatOk, 42),
    dot(mcpOk, 102)
  ]
  if (channel) parts.push(label(fit(channel, 12), 98, { size: 18 }))
  if (note) parts.push(label(fit(note, 14), 122, { size: 15, colour, weight: 500 }))
  return svg(parts.join(''))
}
