import { readFile } from 'node:fs/promises'
import streamDeck from '@elgato/streamdeck'
import { App } from './app.js'
import { TWITCH_CLIENT_ID, TWITCH_SCOPES } from './config.js'
import { StatusAction } from './actions/status.js'
import { TriggerAction } from './actions/trigger.js'

// Quiet by default. The Status key's settings can switch on debug logging (see App#applyOptions).
// Never use 'trace' in a release: it records every message to and from Stream Deck, including
// global settings, which hold the Twitch tokens.
streamDeck.logger.setLevel('info')

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'))

const app = new App({
  streamDeck,
  clientId: TWITCH_CLIENT_ID,
  scopes: TWITCH_SCOPES,
  version: manifest.Version
})

streamDeck.actions.registerAction(new TriggerAction(app))
streamDeck.actions.registerAction(new StatusAction(app))

await streamDeck.connect()
await app.start()

const shutdown = () => {
  app.chat.stop()
  app.mcp.stop().finally(() => process.exit(0))
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
