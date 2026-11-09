// Keeps tokens out of logs. Twurple's HTTP errors include the request URL, and Twitch's token
// endpoints take refresh tokens, device codes and access tokens as query parameters, so error
// messages from authentication calls must never be logged as they are.

const QUERY_SECRET = /\b(access_token|refresh_token|device_code|client_secret|code|token)=([^&\s"']+)/gi
const JSON_SECRET = /("(?:access_token|refresh_token|accessToken|refreshToken|device_code|deviceCode|client_secret)"\s*:\s*")[^"]*(")/gi
const AUTH_HEADER = /\b(Bearer|OAuth)\s+[A-Za-z0-9._~+/-]+=*/gi
const IRC_PASS = /\boauth:[A-Za-z0-9]+/gi

/**
 * Removes anything that looks like a credential from text.
 * @param {unknown} text
 * @returns {string}
 */
export function redactSecrets (text) {
  return String(text)
    .replace(QUERY_SECRET, '$1=[redacted]')
    .replace(JSON_SECRET, '$1[redacted]$2')
    .replace(AUTH_HEADER, '$1 [redacted]')
    .replace(IRC_PASS, 'oauth:[redacted]')
}

/**
 * A short, safe description of an error for logs and the UI. HTTP errors are reduced to their
 * status code and Twitch's message; the URL is never included.
 * @param {unknown} error
 * @returns {string}
 */
export function describeError (error) {
  if (error && typeof error === 'object' && typeof error.statusCode === 'number') {
    let detail = ''
    try {
      const body = JSON.parse(error.body)
      if (typeof body?.message === 'string') detail = body.message
    } catch {}
    detail = redactSecrets(detail).slice(0, 200)
    return detail ? `HTTP ${error.statusCode}: ${detail}` : `HTTP ${error.statusCode}`
  }
  const message = error instanceof Error ? error.message : String(error)
  return redactSecrets(message).split('\n')[0].slice(0, 300)
}

/**
 * The message Twitch put in an HTTP error body, e.g. `authorization_pending`. Empty if none.
 * @param {unknown} error
 * @returns {string}
 */
export function twitchErrorMessage (error) {
  if (!error || typeof error !== 'object' || typeof error.body !== 'string') return ''
  try {
    const body = JSON.parse(error.body)
    return typeof body?.message === 'string' ? body.message : ''
  } catch {
    return ''
  }
}
