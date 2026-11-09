// Connects to Stream Deck through the Elgato MCP Server, which this plugin starts as a child process
// and talks to over stdio. The server in turn connects to Stream Deck over a local named pipe (or
// Unix socket), reconnecting by itself if Stream Deck restarts or MCP Actions are switched off and
// on again. If the server process itself stops, it's restarted here with a growing delay.

import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ResourceListChangedNotificationSchema, ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { TOOL_EXECUTE, TOOL_LIST, isNotFound, parseExecutableActions, resultText } from '../core/mcp-actions.js'

const REQUEST_TIMEOUT_MS = 10_000
const MIN_RESTART_DELAY_MS = 2_000
const MAX_RESTART_DELAY_MS = 60_000

/** @returns {string} Path to the Elgato MCP Server's entry script. */
export function resolveBridgePath () {
  const require = createRequire(import.meta.url)
  return join(dirname(require.resolve('@elgato/mcp-server/package.json')), 'bin', 'index.js')
}

/**
 * @typedef {'stopped' | 'starting' | 'ready' | 'no-app' | 'down'} McpState
 *   ready: Stream Deck's tools are available.
 *   no-app: the server is running but Stream Deck isn't connected to it (MCP Actions off, or Stream Deck too old).
 *   down: the server process isn't running; a restart is scheduled.
 */

/**
 * @typedef {{ ok: true } | { ok: false, notFound: boolean, message: string }} ExecuteResult
 */

export class McpService extends EventEmitter {
  /** @type {Client | null} */
  #client = null
  /** @type {{ state: McpState, message: string }} */
  #status = { state: 'stopped', message: '' }
  /** @type {import('../core/mcp-actions.js').DeckAction[]} */
  #actions = []
  /** @type {Promise<import('../core/mcp-actions.js').DeckAction[]> | null} */
  #refreshing = null
  #restartDelay = MIN_RESTART_DELAY_MS
  #restartTimer = null
  #pollTimer = null
  #stopping = false
  #logger
  #bridgePath
  #pollMs
  #clientVersion

  /**
   * @param {object} options
   * @param {{ debug: Function, info: Function, warn: Function, error: Function }} options.logger
   * @param {string} [options.bridgePath]
   * @param {number} [options.pollMs] How often to re-list actions, as a fallback for missed change notifications.
   * @param {string} [options.clientVersion]
   */
  constructor ({ logger, bridgePath = resolveBridgePath(), pollMs = 30_000, clientVersion = '0.0.0' }) {
    super()
    this.#logger = logger
    this.#bridgePath = bridgePath
    this.#pollMs = pollMs
    this.#clientVersion = clientVersion
  }

  get status () { return this.#status }

  get actions () { return this.#actions }

  /** Starts the MCP server and connects to it. Safe to call when already running. */
  async start () {
    if (this.#client) return
    this.#stopping = false
    clearTimeout(this.#restartTimer)
    this.#setStatus('starting', 'Starting the Elgato MCP Server…')

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.#bridgePath],
      stderr: 'pipe'
    })
    this.#forwardServerLog(transport.stderr)

    const client = new Client({ name: 'chat-triggers', version: this.#clientVersion })
    client.onclose = () => {
      if (this.#client === client) this.#handleClosed('The Elgato MCP Server stopped')
    }
    client.onerror = (error) => this.#logger.debug(`MCP transport error: ${error.message}`)
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => { this.refresh().catch(() => {}) })
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => { this.refresh().catch(() => {}) })

    try {
      await client.connect(transport)
    } catch (error) {
      this.#logger.error(`Couldn't start the Elgato MCP Server: ${error.message}`)
      this.#handleClosed('Couldn\'t start the Elgato MCP Server')
      return
    }

    this.#client = client
    this.#logger.info('Connected to the Elgato MCP Server')
    await this.refresh().catch(() => {})

    clearInterval(this.#pollTimer)
    this.#pollTimer = setInterval(() => { this.refresh().catch(() => {}) }, this.#pollMs)
    this.#pollTimer.unref?.()
  }

  /** Stops the MCP server and any scheduled restart. */
  async stop () {
    this.#stopping = true
    clearTimeout(this.#restartTimer)
    clearInterval(this.#pollTimer)
    const client = this.#client
    this.#client = null
    this.#setActions([])
    this.#setStatus('stopped', '')
    await client?.close().catch(() => {})
  }

  /** Stops and starts the server again, e.g. when the user asks to reconnect. */
  async restart () {
    await this.stop()
    this.#restartDelay = MIN_RESTART_DELAY_MS
    await this.start()
  }

  /**
   * Re-lists the actions on the MCP Deck. Concurrent calls share one request.
   * @returns {Promise<import('../core/mcp-actions.js').DeckAction[]>}
   */
  refresh () {
    this.#refreshing ??= this.#refresh().finally(() => { this.#refreshing = null })
    return this.#refreshing
  }

  async #refresh () {
    const client = this.#client
    if (!client) return []
    try {
      const { tools } = await client.listTools(undefined, { timeout: REQUEST_TIMEOUT_MS })
      if (!tools.some(tool => tool.name === TOOL_LIST) || !tools.some(tool => tool.name === TOOL_EXECUTE)) {
        this.#setActions([])
        this.#setStatus('no-app', 'Stream Deck isn\'t connected to MCP. Turn on Enable MCP Actions in Stream Deck preferences.')
        return []
      }
      const result = await client.callTool({ name: TOOL_LIST, arguments: {} }, undefined, { timeout: REQUEST_TIMEOUT_MS })
      const actions = parseExecutableActions(result)
      this.#restartDelay = MIN_RESTART_DELAY_MS
      this.#setActions(actions)
      this.#setStatus('ready', actions.length === 0 ? 'The MCP Deck has no actions yet' : '')
      return actions
    } catch (error) {
      // A refresh still in flight when the connection closes isn't worth a warning.
      if (this.#client !== client) throw error
      this.#logger.warn(`Couldn't list MCP Deck actions: ${error.message}`)
      if (this.#status.state !== 'ready') {
        this.#setStatus('no-app', 'Couldn\'t list MCP Deck actions. Check that Enable MCP Actions is on in Stream Deck preferences.')
      }
      throw error
    }
  }

  /**
   * Runs an action on the MCP Deck. Only the action's ID is sent; nothing from chat is passed on.
   * Stream Deck returns as soon as the action has started, so this doesn't wait for multi-actions
   * to finish.
   * @param {string} id
   * @returns {Promise<ExecuteResult>}
   */
  async execute (id) {
    const client = this.#client
    if (!client || this.#status.state === 'down') return { ok: false, notFound: false, message: 'The Elgato MCP Server isn\'t running' }
    if (this.#status.state === 'no-app') return { ok: false, notFound: false, message: this.#status.message }
    try {
      const result = await client.callTool({ name: TOOL_EXECUTE, arguments: { id } }, undefined, { timeout: REQUEST_TIMEOUT_MS })
      if (isNotFound(result)) {
        this.refresh().catch(() => {})
        return { ok: false, notFound: true, message: 'The action is no longer on the MCP Deck' }
      }
      if (result.isError) return { ok: false, notFound: false, message: resultText(result) || 'The action couldn\'t be run' }
      return { ok: true }
    } catch (error) {
      return { ok: false, notFound: false, message: error.message }
    }
  }

  #handleClosed (message) {
    clearInterval(this.#pollTimer)
    this.#client = null
    this.#setActions([])
    if (this.#stopping) return
    const delay = this.#restartDelay
    this.#restartDelay = Math.min(this.#restartDelay * 2, MAX_RESTART_DELAY_MS)
    this.#setStatus('down', `${message}. Retrying in ${Math.round(delay / 1000)} s.`)
    this.#logger.warn(`${message}; restarting in ${delay} ms`)
    clearTimeout(this.#restartTimer)
    this.#restartTimer = setTimeout(() => { this.start().catch(() => {}) }, delay)
    this.#restartTimer.unref?.()
  }

  /** The server logs to stderr; errors and warnings are kept, the rest only at debug level. */
  #forwardServerLog (stream) {
    if (!stream) return
    let buffered = ''
    stream.setEncoding?.('utf8')
    stream.on('data', (chunk) => {
      buffered += chunk
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        if (/\b(ERROR|WARN)\b/.test(line)) this.#logger.warn(line)
        else this.#logger.debug(line)
      }
    })
  }

  #setStatus (state, message) {
    if (this.#status.state === state && this.#status.message === message) return
    this.#status = { state, message }
    this.emit('status', this.#status)
  }

  #setActions (actions) {
    const changed = JSON.stringify(actions) !== JSON.stringify(this.#actions)
    this.#actions = actions
    if (changed) this.emit('actions', actions)
  }
}
