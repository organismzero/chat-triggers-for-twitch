# Development

## Unlinking the development copy to test the packaged copy

1. Unlink the development copy:
`npx streamdeck unlink com.organismzero.chattriggers`
   This removes only the link Stream Deck uses to find the plugin. Your project folder isn't touched. Your keys stay on the deck, but they'll look blank until the plugin is back.
2. Build a fresh package. One small file has changed since the last pack:
`npm run pack`
3. Install it: `double-click dist\com.organismzero.chattriggers.streamDeckPlugin` in Explorer, and confirm when Stream Deck asks to install it. You can open the folder from the project with `explorer dist`.
4. Check it:
   - the Status key connects;
   - a Trigger key's settings list your MCP Deck actions;
   - a test press runs the action;
   - a chat command runs it.

You may have to sign in to Twitch again, depending on whether Stream Deck keeps the plugin's settings when it's unlinked and reinstalled. That's worth knowing either way.

The installed copy writes its logs to `%APPDATA%\Elgato\StreamDeck\Plugins\com.organismzero.chattriggers.sdPlugin\logs\`, not to your project folder.

## Link the development copy instead of using the packaged copy

To go back to developing afterwards, remove the installed copy and link your folder again:

```
npx streamdeck unlink --delete com.organismzero.chattriggers
npm run link
npm run restart
```

`--delete` deletes the installed copy; your project folder isn't touched.
