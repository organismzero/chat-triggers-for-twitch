// Manual check of the MCP service against the running Stream Deck app, outside the plugin.
//   node scripts/mcp-smoke.js            lists the MCP Deck actions
//   node scripts/mcp-smoke.js <id>       also runs the action with that ID
import { McpService } from '../com.organismzero.chattriggers.sdPlugin/bin/services/mcp.js'
import { actionLabel } from '../com.organismzero.chattriggers.sdPlugin/bin/core/mcp-actions.js'

const logger = {
  debug: () => {},
  info: (...args) => console.log('[info]', ...args),
  warn: (...args) => console.warn('[warn]', ...args),
  error: (...args) => console.error('[error]', ...args)
}

const mcp = new McpService({ logger })
mcp.on('status', status => console.log('status:', status.state, status.message))

await mcp.start()
// The server connects to Stream Deck just after it starts; give it a moment, then list again.
await new Promise(resolve => setTimeout(resolve, 1500))
const actions = await mcp.refresh().catch(() => [])
for (const action of actions) console.log(`${action.id}  ${actionLabel(action)}`)

const id = process.argv[2]
if (id) console.log('execute:', await mcp.execute(id))

await mcp.stop()
