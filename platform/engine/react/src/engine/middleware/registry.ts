import type { RenderMiddleware } from './types'

class RenderMiddlewareRegistry {
  private mws: RenderMiddleware[] = []

  /** Register a middleware. Called before first render (in setupRegistrations). */
  use(mw: RenderMiddleware): this {
    this.mws.push(mw)
    return this
  }

  /**
   * Retrieve all registered middlewares as an immutable snapshot, sorted by
   * priority ascending (lower number = runs first).  Middlewares without a
   * priority value sort after those that have one (treated as Infinity).
   */
  all(): readonly RenderMiddleware[] {
    const sorted = [...this.mws].sort(
      (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity),
    )
    return Object.freeze(sorted)
  }

  /** Remove all registered middlewares (useful in tests). */
  clear(): void {
    this.mws = []
  }
}

export const middlewareRegistry = new RenderMiddlewareRegistry()