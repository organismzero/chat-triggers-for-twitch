import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { firstWord, matchesCommand, normaliseCommand, MAX_COMMAND_LENGTH } from '../com.organismzero.chattriggers.sdPlugin/bin/core/commands.js'

describe('normaliseCommand', () => {
  it('lower-cases and trims', () => {
    assert.equal(normaliseCommand('  !Lights '), '!lights')
  })

  it('keeps only the first word', () => {
    assert.equal(normaliseCommand('!lights on'), '!lights')
  })

  it('returns empty for missing or non-string values', () => {
    assert.equal(normaliseCommand(undefined), '')
    assert.equal(normaliseCommand(null), '')
    assert.equal(normaliseCommand(42), '')
    assert.equal(normaliseCommand('   '), '')
  })

  it('rejects over-long commands', () => {
    assert.equal(normaliseCommand('!' + 'a'.repeat(MAX_COMMAND_LENGTH)), '')
    assert.equal(normaliseCommand('!' + 'a'.repeat(MAX_COMMAND_LENGTH - 1)).length, MAX_COMMAND_LENGTH)
    assert.equal(normaliseCommand('a'.repeat(MAX_COMMAND_LENGTH - 1)).length, MAX_COMMAND_LENGTH)
  })

  it('adds the ! prefix when it is left off', () => {
    assert.equal(normaliseCommand('lights'), '!lights')
    assert.equal(normaliseCommand('Lights on'), '!lights')
  })

  it('collapses repeated ! prefixes', () => {
    assert.equal(normaliseCommand('!!lights'), '!lights')
  })

  it('treats a lone ! as no command', () => {
    assert.equal(normaliseCommand('!'), '')
    assert.equal(normaliseCommand('!!!'), '')
  })
})

describe('firstWord', () => {
  it('takes the first whitespace-separated word', () => {
    assert.equal(firstWord('!LIGHTS please'), '!lights')
    assert.equal(firstWord('\t!lights\nnow'), '!lights')
  })

  it('ignores invisible characters added by chat clients', () => {
    assert.equal(firstWord('!lights \u{E0000}'), '!lights')
    assert.equal(firstWord('!lights\u{E0000}'), '!lights')
    assert.equal(firstWord('​!lights'), '!lights')
  })

  it('returns empty for non-strings', () => {
    assert.equal(firstWord(undefined), '')
  })
})

describe('matchesCommand', () => {
  it('matches the first word case-insensitively', () => {
    assert.ok(matchesCommand('!Lights', '!lights'))
    assert.ok(matchesCommand('!lights on please', '!LIGHTS'))
  })

  it('matches !command in chat when the setting has no !', () => {
    assert.ok(matchesCommand('!lights', 'lights'))
    assert.ok(matchesCommand('!LIGHTS now', 'Lights'))
  })

  it('does not match a chat message without the !', () => {
    assert.equal(matchesCommand('lights', 'lights'), false)
    assert.equal(matchesCommand('lights', '!lights'), false)
  })

  it('does not match a longer word that starts with the command', () => {
    assert.equal(matchesCommand('!lightsout', '!lights'), false)
  })

  it('does not match the command later in the message', () => {
    assert.equal(matchesCommand('please !lights', '!lights'), false)
  })

  it('never matches an empty command', () => {
    assert.equal(matchesCommand('', ''), false)
    assert.equal(matchesCommand('anything', ''), false)
    assert.equal(matchesCommand('anything', undefined), false)
  })
})
