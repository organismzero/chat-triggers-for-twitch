# Changelog

All notable changes to Chat Triggers for Twitch. Versions follow the plugin manifest.

## 1.0.0 — first release

- **Trigger key:** runs an action or multi-action from the MCP Deck when a chat command is used. Set the command, the action, who can use it (broadcaster, moderators, VIPs, subscribers or everyone), a cooldown and a per-user cooldown. Press the key to test it; hold it to turn it on or off.
- **Status key:** shows whether chat and MCP are connected, and your channel. Press it to sign in or reconnect. Its settings hold sign-in, the global rate limit, the hold time, debug logging and the list of remembered triggers.
- **Safety:** chat only decides whether a trigger runs, never what runs. Permissions, cooldowns and a global rate limit (5 actions per 10 seconds by default) are checked before anything runs. Messages from other channels during shared chat are ignored.
- **Sign-in:** Twitch's device code sign-in, read-only chat access only. A failed token refresh caused by a network problem is retried instead of signing you out.
- **Keys that are hidden** on another page or profile keep working, and are remembered across restarts. Deleted keys can be forgotten from the Status key's settings.
- Windows only for now; macOS hasn't been tested.
