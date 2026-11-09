import { redactSecrets } from '../core/redact.js'

// @d-fischer/logger levels, as used by Twurple: CRITICAL 0, ERROR 1, WARNING 2, INFO 3, DEBUG 4.
const ERROR = 1
const WARNING = 2

/**
 * Routes Twurple's logging through the plugin's logger, with credentials removed. Only warnings and
 * errors are kept, so logging stays quiet by default.
 * @param {{ debug: Function, warn: Function, error: Function }} logger
 * @returns {{ minLevel: string, custom: (level: number, message: string) => void }}
 */
export function twurpleLogger (logger) {
  return {
    minLevel: 'warning',
    custom: (level, message) => {
      const safe = redactSecrets(message)
      if (level <= ERROR) logger.error(safe)
      else if (level === WARNING) logger.warn(safe)
      else logger.debug(safe)
    }
  }
}
