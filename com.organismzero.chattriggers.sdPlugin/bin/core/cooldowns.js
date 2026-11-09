// Per-trigger global and per-user cooldowns. Checking and recording are separate so a use only
// starts a cooldown once the action has actually been sent.

export class Cooldowns {
  /** @type {Map<string, { lastUse: number, users: Map<string, number> }>} */
  #triggers = new Map()
  #now

  /** @param {() => number} [now] Clock in milliseconds, replaceable for tests. */
  constructor (now = Date.now) {
    this.#now = now
  }

  /**
   * @param {string} triggerId
   * @param {string} userId
   * @param {{ globalSeconds: number, userSeconds: number }} limits
   * @returns {{ ok: true } | { ok: false, reason: 'global' | 'user', remainingMs: number }}
   */
  check (triggerId, userId, { globalSeconds, userSeconds }) {
    const entry = this.#triggers.get(triggerId)
    if (!entry) return { ok: true }
    const now = this.#now()

    const globalRemaining = entry.lastUse + globalSeconds * 1000 - now
    if (globalSeconds > 0 && globalRemaining > 0) {
      return { ok: false, reason: 'global', remainingMs: globalRemaining }
    }

    const userLastUse = entry.users.get(userId)
    if (userLastUse !== undefined && userSeconds > 0) {
      const userRemaining = userLastUse + userSeconds * 1000 - now
      if (userRemaining > 0) return { ok: false, reason: 'user', remainingMs: userRemaining }
    }

    return { ok: true }
  }

  /**
   * Records a use, starting both cooldowns. Expired per-user entries are pruned as it goes so the
   * map can't grow without bound in a busy chat.
   * @param {string} triggerId
   * @param {string} userId
   * @param {{ userSeconds: number }} limits
   */
  record (triggerId, userId, { userSeconds }) {
    const now = this.#now()
    let entry = this.#triggers.get(triggerId)
    if (!entry) {
      entry = { lastUse: now, users: new Map() }
      this.#triggers.set(triggerId, entry)
    }
    entry.lastUse = now

    const expiry = userSeconds * 1000
    for (const [id, lastUse] of entry.users) {
      if (now - lastUse >= expiry) entry.users.delete(id)
    }
    if (userSeconds > 0) entry.users.set(userId, now)
  }

  /** Forgets a trigger, e.g. when its key is removed. @param {string} triggerId */
  forget (triggerId) {
    this.#triggers.delete(triggerId)
  }
}
