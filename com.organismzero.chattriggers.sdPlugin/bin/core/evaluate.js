// Decides whether a chat message should run a trigger. Every check happens here, before anything
// runs, and in a fixed order: the cheap and certain ones first, the rate limit last so a token is
// only used when everything else has passed.

import { matchesCommand } from './commands.js'
import { getRoles, isAllowed } from './permissions.js'

/**
 * @typedef {object} ChatMessage
 * @property {string} text
 * @property {string} chatterId
 * @property {string} chatterName
 * @property {Record<string, string>} badges
 * @property {string} broadcasterId The channel the message was received in.
 * @property {string | null} [sourceBroadcasterId] Set during shared chat to the channel it was sent in.
 */

/**
 * Whether a message was sent in the connected channel itself. During shared chat, messages sent in
 * a partner channel are also delivered, and their badges describe the chatter's roles in that other
 * channel, so they must never run triggers.
 * @param {ChatMessage} message
 * @returns {boolean}
 */
export function isFromOwnChannel (message) {
  return !message.sourceBroadcasterId || message.sourceBroadcasterId === message.broadcasterId
}

/**
 * @typedef {{ run: true }
 *   | { run: false, reason: 'other-channel' | 'disabled' | 'no-match' | 'no-target' | 'broken' | 'not-allowed' | 'rate-limited' }
 *   | { run: false, reason: 'cooldown', scope: 'global' | 'user', remainingMs: number }} Decision
 */

/**
 * @param {ChatMessage} message
 * @param {{ id: string, settings: import('./settings.js').TriggerSettings, broken?: boolean }} trigger
 * @param {{ cooldowns: import('./cooldowns.js').Cooldowns, rateLimiter: import('./rate-limit.js').RateLimiter }} limits
 * @returns {Decision}
 */
export function evaluate (message, trigger, { cooldowns, rateLimiter }) {
  const { settings } = trigger
  if (!isFromOwnChannel(message)) return { run: false, reason: 'other-channel' }
  if (!matchesCommand(message.text, settings.command)) return { run: false, reason: 'no-match' }
  if (!settings.enabled) return { run: false, reason: 'disabled' }
  if (!settings.targetId) return { run: false, reason: 'no-target' }
  if (trigger.broken) return { run: false, reason: 'broken' }

  const roles = getRoles(message)
  if (!isAllowed(settings.allowed, roles)) return { run: false, reason: 'not-allowed' }

  const cooldown = cooldowns.check(trigger.id, message.chatterId, {
    globalSeconds: settings.globalCooldown,
    userSeconds: settings.userCooldown
  })
  if (!cooldown.ok) return { run: false, reason: 'cooldown', scope: cooldown.reason, remainingMs: cooldown.remainingMs }

  if (!rateLimiter.tryTake()) return { run: false, reason: 'rate-limited' }
  return { run: true }
}
