// Draws the plugin's static images from the shared brand module, so they always match the key
// images drawn at runtime. Run with `npm run images` after changing bin/core/brand.js.
//
// Sizes follow Elgato's manifest reference and image guidelines:
//   plugin icon      PNG 256 and 512 (@2x)
//   category icon    SVG, monochrome #FFFFFF on transparent (28 × 28)
//   action icons     SVG, monochrome #FFFFFF on transparent (20 × 20)
//   key images       SVG, 144 × 144
//   Marketplace icon PNG 288 (uploaded in Maker Console, not packed)

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { COLOURS as C, markSvg } from '../com.organismzero.chattriggers.sdPlugin/bin/core/brand.js'
import { statusImage, triggerImage } from '../com.organismzero.chattriggers.sdPlugin/bin/core/key-images.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const plugin = join(root, 'com.organismzero.chattriggers.sdPlugin')
const marketplace = join(root, 'marketplace')
const WHITE = '#ffffff'

const svg = (size, body, viewBox = 144) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${viewBox} ${viewBox}">${body}</svg>\n`

const fromDataUrl = (url) => decodeURIComponent(url.slice(url.indexOf(',') + 1)) + '\n'

// The brand icon: the solid mark with the bolt cut out, on the ground colour.
const brandIcon = (size) => svg(size, [
  `<rect width="144" height="144" fill="${C.ground}"/>`,
  markSvg({ x: 72, y: 72, scale: 0.78, bubble: C.spark, bolt: C.ground, style: 'solid' })
].join(''))

// Monochrome outline mark for Stream Deck's action list and category.
const monoMark = (size) => svg(size, markSvg({ x: 72, y: 72, scale: 1, bubble: WHITE, bolt: WHITE, stroke: 12 }))

const monoStatus = (size) => svg(size, [
  `<rect x="14" y="14" width="116" height="116" rx="22" fill="none" stroke="${WHITE}" stroke-width="12"/>`,
  `<circle cx="48" cy="52" r="12" fill="${WHITE}"/>`,
  `<circle cx="48" cy="92" r="11" fill="none" stroke="${WHITE}" stroke-width="7"/>`,
  `<path d="M72 52H104M72 92H104" stroke="${WHITE}" stroke-width="12" stroke-linecap="round"/>`
].join(''))

function png (markup, size) {
  return new Resvg(markup, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

async function write (path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
  console.log(path.slice(root.length + 1).replaceAll('\\', '/'))
}

await write(join(plugin, 'imgs/plugin/marketplace.png'), png(brandIcon(256), 256))
await write(join(plugin, 'imgs/plugin/marketplace@2x.png'), png(brandIcon(512), 512))
await write(join(plugin, 'imgs/plugin/category-icon.svg'), monoMark(28))
for (const old of ['category-icon.png', 'category-icon@2x.png']) await rm(join(plugin, 'imgs/plugin', old), { force: true })

await write(join(plugin, 'imgs/actions/trigger/icon.svg'), monoMark(20))
await write(join(plugin, 'imgs/actions/status/icon.svg'), monoStatus(20))
await write(join(plugin, 'imgs/actions/trigger/key.svg'), fromDataUrl(triggerImage({ command: '', look: 'ready' })))
await write(join(plugin, 'imgs/actions/status/key.svg'), fromDataUrl(statusImage({ look: 'idle', chatOk: false, mcpOk: false, channel: '', note: '' })))

await write(join(marketplace, 'app-icon.svg'), brandIcon(288))
await write(join(marketplace, 'app-icon.png'), png(brandIcon(288), 288))
