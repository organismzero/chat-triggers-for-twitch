import streamDeck from '@elgato/streamdeck'

// Quiet by default; raise to 'debug' or 'trace' while developing. Trace logging records every
// message to and from Stream Deck, including global settings, so never ship it enabled.
streamDeck.logger.setLevel('info')

await streamDeck.connect()
