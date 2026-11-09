// Command parsing and matching. Pure functions, no Stream Deck, MCP or Twitch dependencies.

export const MAX_COMMAND_LENGTH = 50

// Zero-width characters and Unicode tag characters. Some chat clients append these to get around
// Twitch's duplicate-message check, so they're ignored when reading the command word.
const INVISIBLE = /[​-‍⁠﻿\u{E0000}-\u{E007F}]/gu

/**
 * Tidies a configured command for storage and comparison: trimmed, first word only, lower case.
 * Returns an empty string when there's nothing usable.
 * @param {unknown} value
 * @returns {string}
 */
export function normaliseCommand (value) {
  if (typeof value !== 'string') return ''
  const word = value.replace(INVISIBLE, '').trim().split(/\s+/)[0] ?? ''
  if (word.length > MAX_COMMAND_LENGTH) return ''
  return word.toLowerCase()
}

/**
 * Gets the first word of a chat message, lower-cased, for comparison with configured commands.
 * @param {unknown} text
 * @returns {string}
 */
export function firstWord (text) {
  if (typeof text !== 'string') return ''
  const word = text.replace(INVISIBLE, '').trimStart().split(/\s+/, 1)[0] ?? ''
  return word.toLowerCase()
}

/**
 * Whether a chat message invokes the command, i.e. the command is the message's first word.
 * Case-insensitive. `!lights on` matches `!lights`; `!lightsout` doesn't.
 * @param {unknown} text The chat message.
 * @param {unknown} command The configured command.
 * @returns {boolean}
 */
export function matchesCommand (text, command) {
  const wanted = normaliseCommand(command)
  return wanted !== '' && firstWord(text) === wanted
}
