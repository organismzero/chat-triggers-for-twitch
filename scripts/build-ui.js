// Builds the property inspectors into the plugin folder, with their scripts and stylesheets
// embedded. Stream Deck sometimes takes many seconds to load a page's separate files (every
// plugin's, not only ours), and if sdpi-components.js arrives after Stream Deck tries to connect,
// the page never connects. Embedded, everything arrives with the HTML.
//
// Sources are in ui/; the built pages go to the plugin's ui/ folder, which isn't committed.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../ui/', import.meta.url))
const target = fileURLToPath(new URL('../com.organismzero.chattriggers.sdPlugin/ui/', import.meta.url))

const read = (name) => readFileSync(join(source, name), 'utf8')

function script (name) {
  const code = read(name)
  if (/<!--|<\/script/i.test(code)) throw new Error(`${name} can't be embedded in a script element`)
  return `<script>\n${code}\n</script>`
}

function style (name) {
  const css = read(name)
  if (/<\/style/i.test(css)) throw new Error(`${name} can't be embedded in a style element`)
  return `<style>\n${css}\n</style>`
}

function build (name) {
  const html = read(name)
    .replace(/<script src="([^"]+)"><\/script>/g, (_, file) => script(file))
    .replace(/<link rel="stylesheet" href="([^"]+)" \/>/g, (_, file) => style(file))
  if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error(`${name} still loads a separate file`)
  return html
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
for (const name of readdirSync(source).filter(file => file.endsWith('.html'))) {
  writeFileSync(join(target, name), build(name))
  console.log(`Built ui/${name}`)
}
