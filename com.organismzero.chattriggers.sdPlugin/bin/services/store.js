// The plugin's global settings, cached in memory. Only the plugin writes them; the property
// inspectors send requests instead, so a stale copy in a property inspector can never overwrite a
// token that was refreshed in the meantime. Writes are queued so they land in order.

export class GlobalStore {
  /** @type {Record<string, unknown>} */
  #cache = {}
  #queue = Promise.resolve()
  #read
  #write
  #onError

  /**
   * @param {{ read: () => Promise<Record<string, unknown>>, write: (settings: Record<string, unknown>) => Promise<void>, onError?: (error: unknown) => void }} io
   */
  constructor ({ read, write, onError = () => {} }) {
    this.#read = read
    this.#write = write
    this.#onError = onError
  }

  #loaded = false

  async load () {
    this.#cache = (await this.#read()) ?? {}
    this.#loaded = true
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
    // Writing before loading would replace everything saved, including the Twitch sign-in.
    if (!this.#loaded) throw new Error('Global settings were updated before they were loaded')
    this.#cache = { ...this.#cache, ...patch }
    const snapshot = this.#cache
    this.#queue = this.#queue.then(() => this.#write(snapshot)).catch(error => this.#onError(error))
    return this.#queue
  }
}
