import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { describeError, redactSecrets, twitchErrorMessage } from '../com.organismzero.chattriggers.sdPlugin/bin/core/redact.js'

// Mirrors Twurple's HttpStatusCodeError, whose message includes the full request URL.
function httpError (statusCode, url, body) {
  const error = new Error(`Encountered HTTP status code ${statusCode}: Bad Request\n\nURL: ${url}\nMethod: POST\nBody:\n${body}`)
  error.statusCode = statusCode
  error.body = body
  return error
}

describe('redactSecrets', () => {
  it('redacts token query parameters', () => {
    const url = 'https://id.twitch.tv/oauth2/token?grant_type=refresh_token&client_id=abc&refresh_token=SECRET1&device_code=SECRET2'
    const redacted = redactSecrets(url)
    assert.doesNotMatch(redacted, /SECRET/)
    assert.match(redacted, /client_id=abc/)
    assert.match(redacted, /grant_type=refresh_token/)
  })

  it('redacts JSON token fields', () => {
    const json = '{"access_token":"SECRET1","refresh_token":"SECRET2","accessToken":"SECRET3","expires_in":100}'
    const redacted = redactSecrets(json)
    assert.doesNotMatch(redacted, /SECRET/)
    assert.match(redacted, /"expires_in":100/)
  })

  it('redacts authorisation headers and IRC passwords', () => {
    assert.doesNotMatch(redactSecrets('Authorization: Bearer abc123SECRET'), /SECRET/)
    assert.doesNotMatch(redactSecrets('Authorization: OAuth abc123SECRET'), /SECRET/)
    assert.doesNotMatch(redactSecrets('PASS oauth:abc123SECRET'), /SECRET/)
  })

  it('leaves ordinary text alone', () => {
    assert.equal(redactSecrets('Connected to #channel'), 'Connected to #channel')
  })
})

describe('describeError', () => {
  it('never includes the URL of an HTTP error', () => {
    const error = httpError(400, 'https://id.twitch.tv/oauth2/token?refresh_token=SECRET', '{"status":400,"message":"Invalid refresh token"}')
    assert.equal(describeError(error), 'HTTP 400: Invalid refresh token')
  })

  it('copes with non-JSON bodies', () => {
    assert.equal(describeError(httpError(502, 'https://x?access_token=SECRET', '<html>')), 'HTTP 502')
  })

  it('redacts and shortens other errors to their first line', () => {
    assert.equal(describeError(new Error('Failed: token=SECRET\nmore detail')), 'Failed: token=[redacted]')
    assert.equal(describeError('plain string'), 'plain string')
  })
})

describe('twitchErrorMessage', () => {
  it('reads the message from the body', () => {
    assert.equal(twitchErrorMessage(httpError(400, 'x', '{"status":400,"message":"authorization_pending"}')), 'authorization_pending')
  })

  it('returns empty when there is none', () => {
    assert.equal(twitchErrorMessage(new Error('x')), '')
    assert.equal(twitchErrorMessage(httpError(400, 'x', 'nope')), '')
    assert.equal(twitchErrorMessage(null), '')
  })
})
