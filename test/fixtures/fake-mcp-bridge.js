// A stand-in for the Elgato MCP Server, for tests. It lists one MCP Deck action, and appends its
// process ID to a file so tests can check how many servers are left running.

import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Server } from '../../com.organismzero.chattriggers.sdPlugin/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js'
import { StdioServerTransport } from '../../com.organismzero.chattriggers.sdPlugin/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '../../com.organismzero.chattriggers.sdPlugin/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js'

const PID_FILE = join(tmpdir(), 'chat-triggers-fake-mcp-pids.txt')

appendFileSync(PID_FILE, `${process.pid}\n`)

const actions = [{ id: 'lights', title: 'Lights', pluginId: 'com.elgato.streamdeck.multiactions', description: { name: 'Multi Action' } }]
const tools = ['streamdeck__get_executable_actions', 'streamdeck__execute_action']
  .map(name => ({ name, inputSchema: { type: 'object' } }))

const server = new Server({ name: 'fake-elgato', version: '0.0.0' }, { capabilities: { tools: {} } })
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'streamdeck__get_executable_actions') {
    return { content: [{ type: 'text', text: JSON.stringify({ actions }) }] }
  }
  const found = actions.some(action => action.id === request.params.arguments?.id)
  return found
    ? { content: [{ type: 'text', text: '{"status":"ok"}' }] }
    : { content: [{ type: 'text', text: 'Action not found' }], isError: true }
})

// Slow to start, like the real one, so a test can act while the client is still connecting.
await new Promise(resolve => setTimeout(resolve, 300))
await server.connect(new StdioServerTransport())
