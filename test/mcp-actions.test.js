import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { actionLabel, isNotFound, parseExecutableActions } from '../com.organismzero.chattriggers.sdPlugin/bin/core/mcp-actions.js'

// Shape captured from Stream Deck 7.5.1 via @elgato/mcp-server 0.1.8.
const sample = {
  content: [{
    type: 'text',
    text: JSON.stringify({
      actions: [
        {
          currentState: 0,
          description: { controllers: [['Keypad']], description: 'Open URL', id: 'c819', name: 'Website' },
          id: '84ea8b8d-62bb-4ff6-a757-648678af5ead',
          numberOfStates: 1,
          pluginId: 'com.elgato.streamdeck.system.website',
          title: 'Elgato Website'
        },
        {
          currentState: 0,
          description: { controllers: [['Keypad']], description: 'Execute multiple actions', id: 'ffe1', name: 'Multi Action' },
          id: 'd6cfc7e3-8433-4147-8a2e-9ab487f21ef3',
          numberOfStates: 1,
          pluginId: 'com.elgato.streamdeck.multiactions',
          title: 'Launch Claude\nand type'
        }
      ]
    })
  }]
}

describe('parseExecutableActions', () => {
  it('reads the actions from the tool result', () => {
    assert.deepEqual(parseExecutableActions(sample), [
      { id: '84ea8b8d-62bb-4ff6-a757-648678af5ead', title: 'Elgato Website', typeName: 'Website', pluginId: 'com.elgato.streamdeck.system.website' },
      { id: 'd6cfc7e3-8433-4147-8a2e-9ab487f21ef3', title: 'Launch Claude\nand type', typeName: 'Multi Action', pluginId: 'com.elgato.streamdeck.multiactions' }
    ])
  })

  it('skips entries without an ID', () => {
    const result = { content: [{ type: 'text', text: '{"actions":[{"title":"x"},{"id":"a"}]}' }] }
    assert.deepEqual(parseExecutableActions(result), [{ id: 'a', title: '', typeName: '', pluginId: '' }])
  })

  it('throws on errors and unexpected shapes', () => {
    assert.throws(() => parseExecutableActions({ isError: true, content: [{ type: 'text', text: 'No Elgato apps connected.' }] }), /No Elgato apps/)
    assert.throws(() => parseExecutableActions({ content: [{ type: 'text', text: 'not json' }] }), /Unexpected/)
    assert.throws(() => parseExecutableActions({ content: [{ type: 'text', text: '{}' }] }), /Unexpected/)
    assert.throws(() => parseExecutableActions({}), /Unexpected/)
  })
})

describe('actionLabel', () => {
  it('combines title and type, flattening line breaks in key titles', () => {
    const [website, multi] = parseExecutableActions(sample)
    assert.equal(actionLabel(website), 'Elgato Website — Website')
    assert.equal(actionLabel(multi), 'Launch Claude and type — Multi Action')
  })

  it('falls back when there is no title', () => {
    assert.equal(actionLabel({ id: 'x', title: '', typeName: 'Hotkey', pluginId: '' }), 'Hotkey')
    assert.equal(actionLabel({ id: 'x', title: '', typeName: '', pluginId: '' }), 'x')
  })
})

describe('isNotFound', () => {
  it('recognises a missing action', () => {
    assert.ok(isNotFound({ isError: true, content: [{ type: 'text', text: 'Action not found' }] }))
  })

  it('ignores successes and other errors', () => {
    assert.equal(isNotFound({ content: [{ type: 'text', text: '{"status":"ok"}' }] }), false)
    assert.equal(isNotFound({ isError: true, content: [{ type: 'text', text: 'No Elgato apps connected.' }] }), false)
  })
})
