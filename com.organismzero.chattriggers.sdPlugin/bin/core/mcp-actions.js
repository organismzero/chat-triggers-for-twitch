// Parses responses from the Stream Deck tools exposed through the Elgato MCP Server. Pure functions.
//
// Verified against Stream Deck 7.5 with @elgato/mcp-server 0.1.8. `streamdeck__get_executable_actions`
// returns one text block holding JSON:
//   { actions: [{ id, title, pluginId, numberOfStates, currentState, description: { name, description, id, controllers } }] }
// `id` is a UUID that survives moving the key and renaming it, but not deleting and re-adding it.

export const TOOL_LIST = 'streamdeck__get_executable_actions'
export const TOOL_EXECUTE = 'streamdeck__execute_action'

/**
 * @typedef {object} DeckAction
 * @property {string} id Stable identifier used to execute the action.
 * @property {string} title The title the user gave the key on the MCP Deck (may be empty).
 * @property {string} typeName The kind of action, e.g. "Multi Action" or "Website".
 * @property {string} pluginId
 */

/**
 * Gets the text of the first text block in a tool result.
 * @param {{ content?: Array<{ type: string, text?: string }> }} result
 * @returns {string}
 */
export function resultText (result) {
  const block = result?.content?.find(item => item.type === 'text')
  return typeof block?.text === 'string' ? block.text : ''
}

/**
 * @param {{ content?: Array<{ type: string, text?: string }>, isError?: boolean }} result
 * @returns {DeckAction[]}
 */
export function parseExecutableActions (result) {
  if (result?.isError) throw new Error(resultText(result) || 'Listing MCP Deck actions failed')
  let data
  try {
    data = JSON.parse(resultText(result))
  } catch {
    throw new Error('Unexpected response when listing MCP Deck actions')
  }
  if (!Array.isArray(data?.actions)) throw new Error('Unexpected response when listing MCP Deck actions')

  return data.actions
    .filter(action => typeof action?.id === 'string' && action.id !== '')
    .map(action => ({
      id: action.id,
      title: typeof action.title === 'string' ? action.title.trim() : '',
      typeName: typeof action.description?.name === 'string' ? action.description.name : '',
      pluginId: typeof action.pluginId === 'string' ? action.pluginId : ''
    }))
}

/**
 * A label for choosing an action in a list, e.g. "Lights on — Multi Action".
 * @param {DeckAction} action
 * @returns {string}
 */
export function actionLabel (action) {
  const title = action.title.replace(/\s+/g, ' ')
  if (title && action.typeName) return `${title} — ${action.typeName}`
  return title || action.typeName || action.id
}

/**
 * Whether an execute_action result means the action no longer exists on the MCP Deck.
 * @param {{ content?: Array<{ type: string, text?: string }>, isError?: boolean }} result
 */
export function isNotFound (result) {
  return Boolean(result?.isError) && /not found/i.test(resultText(result))
}
