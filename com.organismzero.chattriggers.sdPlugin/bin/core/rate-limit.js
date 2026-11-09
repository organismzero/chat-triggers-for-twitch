// A sliding-window rate limit across all triggers: a safety net if cooldowns are set too low or
// lots of different triggers are used at once.

export class RateLimiter {
  /** @type {number[]} */
  #times = []
  #now
  #maxEvents
  #windowMs

  /**
   * @param {{ maxEvents: number, windowSeconds: number }} limits
   * @param {() => number} [now] Clock in milliseconds, replaceable for tests.
   */
  constructor (limits, now = Date.now) {
    this.#now = now
    this.configure(limits)
  }

  /** @param {{ maxEvents: number, windowSeconds: number }} limits */
  configure ({ maxEvents, windowSeconds }) {
    this.#maxEvents = maxEvents
    this.#windowMs = windowSeconds * 1000
  }

  #prune (now) {
    while (this.#times.length > 0 && now - this.#times[0] >= this.#windowMs) this.#times.shift()
  }

  /** Whether another event is allowed now, without using it up. */
  canTake () {
    this.#prune(this.#now())
    return this.#times.length < this.#maxEvents
  }

  /**
   * Uses one event if the limit allows it.
   * @returns {boolean} Whether the event was allowed.
   */
  tryTake () {
    const now = this.#now()
    this.#prune(now)
    if (this.#times.length >= this.#maxEvents) return false
    this.#times.push(now)
    return true
  }
}
