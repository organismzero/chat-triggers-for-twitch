// Who may use a trigger, worked out from the chatter's badges. Pure functions.

export const ROLES = Object.freeze(['broadcaster', 'moderator', 'vip', 'subscriber', 'everyone'])

export const DEFAULT_ALLOWED_ROLES = Object.freeze(['broadcaster', 'moderator'])

// Badge set IDs that grant each role. Founders are subscribers who subscribed early.
const BADGE_ROLES = {
  broadcaster: 'broadcaster',
  lead_moderator: 'moderator',
  moderator: 'moderator',
  vip: 'vip',
  subscriber: 'subscriber',
  founder: 'subscriber'
}

/**
 * Works out a chatter's roles in the channel.
 *
 * Broadcaster is decided by comparing user IDs rather than trusting the badge alone, since the
 * broadcaster can hide their badge.
 * @param {{ chatterId: string, broadcasterId: string, badges?: Record<string, string> | null }} chatter
 * @returns {Set<string>}
 */
export function getRoles ({ chatterId, broadcasterId, badges }) {
  const roles = new Set(['everyone'])
  if (chatterId && chatterId === broadcasterId) roles.add('broadcaster')
  for (const badge of Object.keys(badges ?? {})) {
    const role = BADGE_ROLES[badge]
    if (role === 'broadcaster') continue
    if (role) roles.add(role)
  }
  return roles
}

/**
 * Keeps only known roles, removing duplicates. Anything that isn't an array is treated as the default.
 * @param {unknown} value
 * @returns {string[]}
 */
export function normaliseAllowedRoles (value) {
  if (!Array.isArray(value)) return [...DEFAULT_ALLOWED_ROLES]
  return ROLES.filter(role => value.includes(role))
}

/**
 * Whether a chatter with the given roles may use a trigger that allows `allowedRoles`.
 * Roles are not hierarchical: each one the streamer wants must be ticked. An empty list allows nobody.
 * @param {Iterable<string>} allowedRoles
 * @param {Set<string>} chatterRoles
 * @returns {boolean}
 */
export function isAllowed (allowedRoles, chatterRoles) {
  for (const role of allowedRoles) {
    if (chatterRoles.has(role)) return true
  }
  return false
}
