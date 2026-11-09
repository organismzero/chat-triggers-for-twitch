// The plugin's global settings, cached in memory. Only the plugin writes them; the property
// inspectors send requests instead, so a stale copy in a property inspector can never overwrite a
// token that was refreshed in the meantime. Writes are queued so they land in order.

export class GlobalStore {
  /** @type {Record<string, unknown>} */
  #cache = {}
  #queue = Promise.resolve()
  #read
  #write

  /**
   * @param {{ read: () => Promise<Record<string, unknown>>, write: (settings: Record<string, unknown>) => Promise<void> }} io
   */
  constructor ({ read, write }) {
    this.#read = read
    this.#write = write
  }

  async load () {
    this.#cache = (await this.#read()) ?? {}
    return this.#cache
  }

  /** @returns {Record<string, unknown>} */
  get () {
    return this.#cache
  }

  /**
   * Shallow-merges top-level keys and saves.
   * @param {Record<string, unknown>} patch
   */
  update (patch) {
    this.#cache = { ...this.#cache, ...patch }
    const snapshot = this.#cache
    this.#queue = this.#queue.then(() => this.#write(snapshot)).catch(() => {})
    return this.#queue
  }
}
