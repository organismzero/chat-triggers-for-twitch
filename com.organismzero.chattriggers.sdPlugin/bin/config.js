// Values shared across the plugin.

/**
 * Client ID of the "Chat Triggers" application in the Twitch developer console, registered as a
 * public client. A client ID isn't a secret; public clients have no client secret at all.
 */
export const TWITCH_CLIENT_ID = ''

/** `user:read:chat` is the only scope needed: the plugin reads chat and never sends anything. */
export const TWITCH_SCOPES = Object.freeze(['user:read:chat'])

export const PLUGIN_UUID = 'com.organismzero.chattriggers'

export const ACTION_UUIDS = Object.freeze({
  trigger: `${PLUGIN_UUID}.trigger`,
  status: `${PLUGIN_UUID}.status`
})
