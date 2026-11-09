// Normalises settings that come from the property inspectors, which can be missing, partial or
// the wrong type (text fields store strings). Pure functions.

import { normaliseCommand } from './commands.js'
import { normaliseAllowedRoles } from './permissions.js'

export const MAX_COOLDOWN_SECONDS = 24 * 60 * 60

export const TRIGGER_DEFAULTS = Object.freeze({
  globalCooldown: 10,
  userCooldown: 30
})

export const OPTION_LIMITS = Object.freeze({
  rateLimitCount: { min: 1, max: 100, fallback: 5 },
  rateLimitWindow: { min: 1, max: 3600, fallback: 10 },
  longPressMs: { min: 300, max: 3000, fallback: 600 }
})

/**
 * Reads a number within bounds, falling back when the value is missing or not a number.
 * @param {unknown} value
 * @param {{ min: number, max: number, fallback: number }} limits
 * @returns {number}
 */
export function boundedNumber (value, { min, max, fallback }) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

/**
 * @typedef {object} TriggerSettings
 * @property {string} command Normalised command, e.g. `!lights`. Empty when not set.
 * @property {string} targetId MCP Deck action ID. Empty when not set.
 * @property {string} targetLabel The target's title when it was chosen, shown if it later disappears.
 * @property {string[]} allowed Roles that may use the trigger.
 * @property {number} globalCooldown Seconds.
 * @property {number} userCooldown Seconds.
 * @property {boolean} enabled
 */

/**
 * @param {Record<string, unknown> | undefined | null} raw
 * @returns {TriggerSettings}
 */
export function normaliseTriggerSettings (raw) {
  const settings = raw ?? {}
  return {
    command: normaliseCommand(settings.command),
    targetId: typeof settings.targetId === 'string' ? settings.targetId.trim() : '',
    targetLabel: typeof settings.targetLabel === 'string' ? settings.targetLabel : '',
    allowed: normaliseAllowedRoles(settings.allowed),
    globalCooldown: boundedNumber(settings.globalCooldown, { min: 0, max: MAX_COOLDOWN_SECONDS, fallback: TRIGGER_DEFAULTS.globalCooldown }),
    userCooldown: boundedNumber(settings.userCooldown, { min: 0, max: MAX_COOLDOWN_SECONDS, fallback: TRIGGER_DEFAULTS.userCooldown }),
    enabled: settings.enabled !== false
  }
}

/**
 * @typedef {object} PluginOptions
 * @property {number} rateLimitCount Most actions run across all triggers in one window.
 * @property {number} rateLimitWindow Window length in seconds.
 * @property {number} longPressMs How long a key must be held to toggle a trigger.
 */

/**
 * @param {Record<string, unknown> | undefined | null} raw
 * @returns {PluginOptions}
 */
export function normaliseOptions (raw) {
  const options = raw ?? {}
  return {
    rateLimitCount: Math.round(boundedNumber(options.rateLimitCount, OPTION_LIMITS.rateLimitCount)),
    rateLimitWindow: boundedNumber(options.rateLimitWindow, OPTION_LIMITS.rateLimitWindow),
    longPressMs: Math.round(boundedNumber(options.longPressMs, OPTION_LIMITS.longPressMs))
  }
}
