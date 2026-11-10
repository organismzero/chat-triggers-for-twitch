# Privacy policy

*Chat Triggers for Twitch, a Stream Deck plugin by OrganismZero. Last updated 10 November 2026.*

Chat Triggers runs entirely on your computer. It has no server of its own, no analytics and no tracking, and it sends nothing to its developer.

## What it stores

These are kept in the plugin's settings inside the Stream Deck app, on your computer:

- **Your Twitch sign-in:** your Twitch user ID and username, and the access and refresh tokens Twitch issues when you sign in. The tokens only allow reading chat (`user:read:chat`).
- **Your triggers and options:** each Trigger key's command, chosen action, permissions and cooldowns, and the plugin-wide options.

## What it reads

- **Your channel's chat**, while you're signed in. Each message is checked against your commands as it arrives and then discarded. Messages aren't saved.
- **The list of actions on your MCP Deck**, from the Stream Deck app, so you can choose them in the Trigger settings.

## Logs

The plugin writes a log on your computer, in the plugin's `logs` folder, to help with problems. It never records tokens or chat messages. If you turn on **Debug logging** in the Status key's settings, the log also records the usernames of people who use your commands. Logs stay on your computer, and older ones are deleted automatically as new ones are written.

## Who it talks to

- **Twitch**, to sign you in, refresh your sign-in and receive your chat. Twitch's own [privacy notice](https://www.twitch.tv/p/legal/privacy-notice/) applies to that.
- **The Stream Deck app on your computer**, through the Elgato MCP Server bundled with the plugin, to list and run your MCP Deck actions.

It doesn't talk to anything else.

## Removing your data

- **Sign out** in the Status key's settings deletes your tokens from the plugin and asks Twitch to revoke them.
- **Disconnect** "Chat Triggers" under [Twitch's connection settings](https://www.twitch.tv/settings/connections) to revoke access from Twitch's side.
- **Uninstall** the plugin from Stream Deck to delete it and its logs. Sign out first, so your tokens are deleted and revoked too.

Because nothing is sent to the developer, there's no copy anywhere else to ask to have deleted.

## Contact

Questions about this policy: open an issue at <https://github.com/organismzero/chat-triggers-for-twitch/issues>.

Chat Triggers for Twitch isn't made by, endorsed by or affiliated with Twitch or Elgato.
