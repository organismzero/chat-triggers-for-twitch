// Draws the Elgato Marketplace thumbnail and gallery images (1920 × 960 PNG) into marketplace/.
// Run with `npm run marketplace`. The keys shown are the plugin's real key images.
//
// Everything is laid out on a 960 × 480 grid and rendered at 2×, so the design system's type
// sizes and spacing apply directly. Fonts are in marketplace/fonts (SIL Open Font Licence); key
// text uses Segoe UI from the system, as it does on a real Stream Deck.

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { COLOURS as C } from '../com.organismzero.chattriggers.sdPlugin/bin/core/brand.js'
import { escapeXml, statusImage, triggerImage } from '../com.organismzero.chattriggers.sdPlugin/bin/core/key-images.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'marketplace')
const fonts = join(out, 'fonts')

const W = 960
const H = 480
const DISPLAY = 'Chakra Petch'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'
const KEY_BLANK = '#07080a'

// Building blocks ------------------------------------------------------------------------------

function page (body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${C.ground}"/>${body}</svg>`
}

/** Lines of text, top-aligned at y (the first baseline sits one size below). */
function text (lines, { x, y, size, lineHeight = size * 1.25, family = SANS, weight = 400, fill = C.paper, spacing = 0, anchor = 'start' }) {
  const spans = [].concat(lines).map((line, i) =>
    `<tspan x="${x}" y="${round(y + size * 0.92 + i * lineHeight)}">${escapeXml(line)}</tspan>`).join('')
  return `<text font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${spacing}" text-anchor="${anchor}">${spans}</text>`
}

let clipCount = 0
/** A key image drawn at (x, y), clipped to a rounded key. */
function key (dataUrl, x, y, size = 72) {
  const inner = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1)).replace(/^<svg[^>]*>|<\/svg>$/g, '')
  const id = `k${clipCount++}`
  const r = round(size * 0.16)
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}"/></clipPath>` +
    `<g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 144 144">${inner}</svg></g>`
}

function blankKey (x, y, size = 72) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${round(size * 0.16)}" fill="${KEY_BLANK}"/>`
}

/** A Stream Deck: a 5 × 3 grid of keys on a raised body. `cells` holds data URLs, or null for blank keys. */
function deck (cells, x, y) {
  const parts = [`<rect x="${x}" y="${y}" width="472" height="296" rx="28" fill="${C.raised}"/>`]
  cells.forEach((cell, i) => {
    const kx = x + 24 + (i % 5) * 88
    const ky = y + 24 + Math.floor(i / 5) * 88
    parts.push(cell ? key(cell, kx, ky) : blankKey(kx, ky))
  })
  return parts.join('')
}

function panel (x, y, width, height) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="${C.raised}"/>`
}

function headline (lines, y = 96) {
  return text(lines, { x: 56, y, size: 36, lineHeight: 42, family: DISPLAY, weight: 600 })
}

function lead (lines, y) {
  return text(lines, { x: 56, y, size: 18, lineHeight: 27, fill: C.muted })
}

const trig = (command, look = 'ready') => triggerImage({ command, look })
const round = (n) => Math.round(n * 100) / 100

// Images ---------------------------------------------------------------------------------------

function thumbnail () {
  return page([
    text(['Chat', 'Triggers'], { x: 56, y: 96, size: 76, lineHeight: 72, family: DISPLAY, weight: 700, spacing: -1 }),
    text('for Twitch', { x: 58, y: 262, size: 28, family: DISPLAY, weight: 600, fill: C.spark }),
    lead(['Chat commands that press', 'your Stream Deck keys.'], 316),
    text('Stream Deck 7.4 or later · Windows', { x: 56, y: 404, size: 13, fill: C.muted, weight: 500, spacing: 0.2 }),
    deck([
      trig('!lights'), trig('!confetti', 'fired'), trig('!hydrate'), statusImage({ look: 'ok', chatOk: true, mcpOk: true, channel: 'your channel', note: 'Ready' }), null,
      trig('!scene'), trig('!hype'), trig('!lurk', 'disabled'), null, trig('!clip'),
      null, trig('!bonk'), null, null, null
    ], 448, 92)
  ].join(''))
}

function chatCommand () {
  const messages = [
    ['nebula_rae', 'that boss fight though'],
    ['kit_mod', 'gg everyone'],
    ['pixelfox', '!confetti'],
    ['orbitjune', 'YES'],
    ['tallgrass', 'how did you do that']
  ]
  const lines = messages.map(([name, said], i) => {
    const y = 132 + i * 44
    const hit = said.startsWith('!')
    return (hit ? `<rect x="476" y="${y - 8}" width="272" height="44" rx="4" fill="none" stroke="${C.spark}" stroke-width="2"/>` : '') +
      text(name, { x: 488, y, size: 13, weight: 500, fill: C.muted }) +
      text(said, { x: 488, y: y + 14, size: 15, family: hit ? MONO : SANS, weight: hit ? 500 : 400, fill: C.paper })
  })
  return page([
    headline(['Type a command.', 'Something happens.']),
    lead(['When someone types a command in your', 'chat, Chat Triggers runs the Stream Deck', 'action or multi-action you chose for it:', 'lights, sounds, scenes, anything.'], 208),
    panel(464, 92, 300, 296),
    ...lines,
    `<path d="M780 240H808" stroke="${C.spark}" stroke-width="4" stroke-linecap="round"/><path d="M800 230L812 240L800 250" fill="none" stroke="${C.spark}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    key(trig('!confetti', 'fired'), 828, 196, 88),
    text(['Runs your', 'confetti action'], { x: 872, y: 298, size: 13, lineHeight: 18, fill: C.muted, weight: 500, anchor: 'middle' })
  ].join(''))
}

function settings () {
  const rows = [
    ['Command', [['!lights', MONO]]],
    ['Action', [['Lights on — Multi Action', SANS]]],
    ['Who can use it', [[[['Moderators', true], ['VIPs', true], ['Everyone', false]], 'boxes']]],
    ['Cooldown', [['10 s', SANS]]],
    ['Per user', [['30 s', SANS]]],
    ['Enabled', [[[['On', true]], 'boxes']]]
  ]
  const body = rows.map(([label, [[value, family]]], i) => {
    const y = 124 + i * 42
    return text(label, { x: 464, y, size: 14, fill: C.muted, weight: 500 }) +
      `<rect x="588" y="${y - 7}" width="280" height="30" rx="4" fill="${C.ground}"/>` +
      (family === 'boxes' ? checkboxes(value, 600, y) : text(value, { x: 600, y: y - 1, size: 14, family, weight: family === MONO ? 500 : 400, fill: C.paper }))
  })
  return page([
    headline(['You decide who,', 'and how often.']),
    lead(['Pick the action, choose who can use the', 'command, and set cooldowns for everyone', 'and for each person. A global rate limit', 'backs them up.'], 208),
    panel(440, 92, 448, 296),
    ...body
  ].join(''))
}

function checkboxes (items, x, y) {
  let cx = x
  return items.map(([label, on]) => {
    const box = on
      ? `<rect x="${cx}" y="${y + 1}" width="14" height="14" rx="3" fill="${C.spark}"/><path d="M${cx + 3.5} ${y + 8}l2.5 2.5 4.5-5" fill="none" stroke="${C.onSpark}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<rect x="${cx + 0.75}" y="${y + 1.75}" width="12.5" height="12.5" rx="3" fill="none" stroke="${C.muted}" stroke-width="1.5"/>`
    const part = box + text(label, { x: cx + 20, y: y - 1, size: 14, fill: C.paper })
    cx += 20 + label.length * 7.6 + 18
    return part
  }).join('')
}

function states () {
  const looks = [
    ['ready', '!lights', 'Ready'], ['fired', '!lights', 'Fired'], ['disabled', '!lights', 'Off'],
    ['offline', '!lights', 'Offline'], ['broken', '!lights', 'Missing action'], ['unset', '', 'Not set up']
  ]
  const status = [
    [{ look: 'ok', chatOk: true, mcpOk: true, note: 'Ready' }, 'Connected'],
    [{ look: 'partial', chatOk: false, mcpOk: true, note: 'Connecting' }, 'Connecting'],
    [{ look: 'problem', chatOk: true, mcpOk: false, note: 'MCP off' }, 'Needs you']
  ]
  const caption = (label, x, y) => text(label, { x: x + 40, y, size: 13, fill: C.muted, weight: 500, anchor: 'middle' })
  return page([
    headline(['Every key shows', 'what it’s doing.']),
    lead(['Trigger keys flash when they run and show', 'when they’re off, offline or missing their', 'action. The Status key shows chat and MCP', 'at a glance. Press it to reconnect.'], 208),
    ...looks.map(([look, command, label], i) => {
      const x = 448 + (i % 3) * 96
      const y = 92 + Math.floor(i / 3) * 112
      return key(trig(command, look), x, y, 80) + caption(label, x, y + 86)
    }),
    ...status.map(([options, label], i) => {
      const y = 92 + i * 112
      return key(statusImage({ ...options, channel: 'your channel' }), 776, y, 80) + caption(label, 776, y + 86)
    })
  ].join(''))
}

function safety () {
  const points = [
    ['Chat chooses when, never what.', 'Each key runs the one action you picked. Nothing from a chat message is passed on.'],
    ['Checks come first.', 'Permissions, cooldowns and the rate limit are checked before anything runs.'],
    ['Read-only access.', 'It signs in only to read your chat, and never posts in it.'],
    ['Your keys stay yours.', 'Only actions you put on the MCP Deck can be triggered.']
  ]
  return page([
    headline(['Safe to leave', 'running live.']),
    lead(['Your viewers get to press buttons.', 'They don’t get control of your', 'Stream Deck.'], 208),
    ...points.map(([title, detail], i) => {
      const y = 96 + i * 76
      return `<rect x="448" y="${y + 3}" width="14" height="14" rx="3" fill="${C.spark}"/>` +
        text(title, { x: 478, y, size: 18, family: DISPLAY, weight: 600 }) +
        text(wrap(detail, 52), { x: 478, y: y + 26, size: 14, lineHeight: 20, fill: C.muted })
    })
  ].join(''))
}

function wrap (sentence, width) {
  const lines = ['']
  for (const word of sentence.split(' ')) {
    const last = lines.length - 1
    if (lines[last] && (lines[last] + ' ' + word).length > width) lines.push(word)
    else lines[last] = lines[last] ? `${lines[last]} ${word}` : word
  }
  return lines
}

// Render ---------------------------------------------------------------------------------------

const images = {
  'thumbnail.png': thumbnail(),
  'gallery-1-chat.png': chatCommand(),
  'gallery-2-settings.png': settings(),
  'gallery-3-states.png': states(),
  'gallery-4-safety.png': safety()
}

const fontFiles = ['ChakraPetch-Bold.ttf', 'ChakraPetch-SemiBold.ttf', 'IBMPlexSans-Regular.ttf', 'IBMPlexSans-Medium.ttf', 'IBMPlexMono-Medium.ttf']
  .map(file => join(fonts, file))

for (const [name, markup] of Object.entries(images)) {
  const png = new Resvg(markup, { font: { fontFiles, loadSystemFonts: true, defaultFontFamily: SANS } }).render().asPng()
  await writeFile(join(out, name), png)
  console.log(`marketplace/${name}`)
}
