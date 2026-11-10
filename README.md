# Chat Triggers for Twitch

A Stream Deck plugin that runs your Stream Deck actions and multi-actions when someone uses a command in your Twitch chat. Type `!lights` in chat and the lights come on.

Each **Trigger** key is one command. Its settings say which command to listen for, which action to run, who can use it and how often. A **Status** key shows whether everything is connected.

Chat Triggers only reads chat. It never sends messages. If you want a reply in chat, add a step that sends one (for example from another plugin) to the multi-action you trigger.

## How it works

Stream Deck plugins can't press other keys, so Chat Triggers uses Elgato's MCP integration. When **Enable MCP Actions** is turned on, Stream Deck creates a profile called the **MCP Deck**. Any action placed there can be listed and run by an MCP client. Chat Triggers starts the [Elgato MCP Server](https://www.npmjs.com/package/@elgato/mcp-server) and acts as that client. No AI is involved.

```
Twitch chat ──EventSub──▶ Chat Triggers ──stdio──▶ Elgato MCP Server ──local pipe──▶ Stream Deck ──▶ MCP Deck action
```

Only the chosen action's ID is sent to Stream Deck. Nothing from a chat message is passed on.

## Requirements

- **Stream Deck 7.4 or later on Windows 10 or later.** macOS isn't supported yet: it hasn't been tested there.
- **Node.js 24 or later**, for development only. The installed plugin runs on the Node.js built into Stream Deck.
- **The Elgato MCP Server.** It's bundled with the plugin (`@elgato/mcp-server`, pinned), so you don't need to install it separately.
- **MCP Actions turned on.** In Stream Deck, open **Preferences → General** and tick **Enable MCP Actions**. Some versions call it *Enable MCP Deck*.
- **Actions on the MCP Deck.** Choose the **MCP Actions** profile (the MCP Deck) in Stream Deck and add the actions or multi-actions you want chat to run. Give each one a clear title, such as "Lights on" or "Confetti", because the title is what you'll pick from in the Trigger settings. Moving a key or renaming it is fine. If you delete an action and add it again, it becomes a new action, and any trigger using it is marked as missing.

## Using it

1. Add a **Status** key and press it, or open its settings and choose **Sign in with Twitch**. Twitch opens in your browser with a code; approve it there. Sign in with the account whose chat you want to watch.
2. Add a **Trigger** key and fill in its settings:
   - **Command:** for example `!lights` or just `lights`; both respond to `!lights` in chat. It matches the first word of a message, ignoring case, so `!Lights please` works but `!lightsout` and `lights` (without the `!`) don't.
   - **Action:** an action from the MCP Deck. Use **Refresh actions** after changing the MCP Deck.
   - **Who can use it:** the broadcaster, moderators, VIPs, subscribers (including founders) or everyone. Roles aren't ranked: tick each one you want.
   - **Cooldown:** seconds before anyone can use the trigger again. **Per user** is how long each person waits before using it again.
   - **Enabled:** turns the trigger on or off.
3. Press the Trigger key to test the action. Hold it to turn the trigger on or off.

The key flashes green when its action runs. It shows **Off** when disabled, **Missing action** if its action has gone from the MCP Deck, **Offline** while chat or MCP isn't connected, and **Set up** until it has a command and an action.

### Hidden and deleted keys

Stream Deck only tells plugins about keys that are currently visible. So a trigger is remembered once its key has been shown, and it keeps working when you switch pages or profiles and after Stream Deck restarts. Because a deleted key can't be told apart from a hidden one, deleted triggers keep working until you choose **Forget** next to them in the Status key's settings.

### Status key

The Status key shows a dot each for **Chat** and **MCP**, the channel name and a short note:

| Note | Meaning |
| --- | --- |
| Ready | Listening to chat and connected to Stream Deck |
| Sign in / Reconnect | Not signed in, or Twitch needs you to sign in again. Press the key to sign in |
| MCP off | Stream Deck isn't connected to the MCP server. Turn on **Enable MCP Actions** |
| MCP down | The MCP server stopped. It restarts by itself; press the key to retry now |
| Connecting | Still connecting |

Pressing the key reconnects chat and restarts the MCP server. Its settings also hold two plugin-wide options:

- **Rate limit:** the most actions that can run across all triggers in a time window (default: 5 per 10 seconds). It's a safety net on top of each trigger's cooldowns.
- **Hold to toggle:** how long to hold a Trigger key to turn it on or off (default: 600 ms).
- **Debug logging:** writes more detail to the logs, such as why a command was ignored and who used it. Off by default; turn it on only while tracking down a problem.

## Security

- Chat messages are untrusted. A message can only choose *whether* a trigger runs, never *what* runs: the action is fixed in the key's settings.
- Checks run in this order, before anything happens: correct channel (messages from other channels during shared chat are ignored), command, enabled, action available, permission, cooldowns, then the global rate limit.
- Twitch tokens are kept in the plugin's global settings, as Elgato recommends for sensitive values, rather than in key settings, which are included in exported profiles. They're never written to the logs, and errors from Twitch's sign-in endpoints are reduced to a status code and message before logging, because their URLs contain credentials.
- Logging is quiet by default (`info`). The **Debug logging** option raises it to `debug`, which adds chatters' usernames but never tokens. The plugin never uses `trace`, which would record every message between Stream Deck and the plugin, including global settings.

## Twitch app registration

Chat Triggers signs in with the [Device Code Grant flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow) as a public client, so there's no client secret to protect.

1. In the [Twitch developer console](https://dev.twitch.tv/console/apps), choose **Register Your Application**.
2. **Name:** `Chat Triggers`. Keep "Twitch" out of the application name.
3. **OAuth Redirect URLs:** `http://localhost`. It isn't used by the Device Code flow, but the form requires one.
4. **Category:** Application Integration.
5. **Client Type:** **Public**.
6. Copy the **Client ID** into `TWITCH_CLIENT_ID` in `com.organismzero.chattriggers.sdPlugin/bin/config.js`.

The only scope requested is `user:read:chat`.

## Development

```sh
npm install        # also installs the plugin's runtime dependencies inside the .sdPlugin folder
npm test           # unit tests (node:test, no Stream Deck, MCP or Twitch needed)
npm run dev        # turn on Stream Deck developer mode (once)
npm run link       # link the .sdPlugin folder into Stream Deck (once)
npm run restart    # restart the plugin after changing code
npm run validate   # check the manifest and files
```

The plugin is plain JavaScript (ES modules) with no build step. The code in `com.organismzero.chattriggers.sdPlugin/bin/` is what Stream Deck runs:

| Path | Purpose |
| --- | --- |
| `bin/plugin.js` | Entry point: registers the keys and starts the app |
| `bin/app.js` | Connects chat, triggers and MCP |
| `bin/actions/` | The Trigger and Status keys |
| `bin/services/` | MCP client, Twitch sign-in and chat, global settings |
| `bin/core/` | Pure logic: command matching, permissions, cooldowns, rate limiting, redaction, key images |
| `ui/` | Property inspectors, using a vendored copy of [sdpi-components](https://sdpi-components.dev) v4.0.1 |

Logs are written to `com.organismzero.chattriggers.sdPlugin/logs/`. To check the MCP connection outside Stream Deck, with the Stream Deck app running:

```sh
node scripts/mcp-smoke.js          # lists the MCP Deck actions
node scripts/mcp-smoke.js <id>     # also runs one
```

## Packing

```sh
npm run pack
```

This reinstalls the runtime dependencies from the lockfile, validates the plugin and writes `dist/com.organismzero.chattriggers.streamDeckPlugin`. The `.sdignore` file keeps logs, lockfiles and the MCP server's unused ngrok binaries out of the package.

## Licence

MIT. See [LICENSE](LICENSE).
