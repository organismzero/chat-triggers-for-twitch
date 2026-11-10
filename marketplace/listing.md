# Marketplace listing

Text for the Elgato Maker Console. The images in this folder are made by `npm run marketplace` and `npm run images`.

## Name

Chat Triggers for Twitch

## Short description (first 250 characters must be plain text)

Let your Twitch chat press your Stream Deck keys. Give each Trigger key a command such as !lights, pick an action or multi-action, and choose who can use it and how often. When the command appears in chat, the action runs.

## Description (250 to 1,500 characters)

Let your Twitch chat press your Stream Deck keys. Give each Trigger key a command such as !lights, pick an action or multi-action, and choose who can use it and how often. When the command appears in chat, the action runs.

Each Trigger key is one command. Choose who can use it (the broadcaster, moderators, VIPs, subscribers or everyone), set a cooldown for everyone and another for each person, and turn it on or off by holding the key. Press the key to test the action. Keys flash when they run and show when they're off, offline or missing their action.

A Status key shows whether chat and Stream Deck are connected, and reconnects when pressed.

Chat only decides whether an action runs, never what runs: nothing from a chat message is passed on. Permissions, cooldowns and a global rate limit are checked first. Chat Triggers signs in with read-only chat access and never posts in your chat. To reply in chat, add a step from another plugin to the multi-action you trigger.

Requirements:
- Stream Deck 7.4 or later on Windows 10 or later
- Enable MCP Actions turned on in Stream Deck preferences, with the actions you want to trigger placed on the MCP Deck
- A Twitch account

Not affiliated with Twitch or Elgato.

## Release notes, 1.0.0

First release. Trigger keys run MCP Deck actions and multi-actions from chat commands, with permissions, cooldowns and a global rate limit. A Status key shows the chat and MCP connection and handles sign-in. Windows only for now.

## Images

| File | Use |
| --- | --- |
| `app-icon.png` | App icon, 288 × 288 |
| `thumbnail.png` | Thumbnail, 1920 × 960 |
| `gallery-1-chat.png` | Gallery: a chat command running a key |
| `gallery-2-settings.png` | Gallery: Trigger settings |
| `gallery-3-states.png` | Gallery: key states |
| `gallery-4-safety.png` | Gallery: safety |

## Links

- Privacy policy: https://github.com/organismzero/chat-triggers-for-twitch/blob/main/PRIVACY.md
- Support: https://github.com/organismzero/chat-triggers-for-twitch/issues
- Source: https://github.com/organismzero/chat-triggers-for-twitch
