import type { RenderMiddleware } from './types'

class RenderMiddlewareRegistry {
  private mws: RenderMiddleware[] = []

  /** Register a middleware. Called before first render (in setupRegistrations). */
  use(mw: RenderMiddleware): this {
    this.mws.push(mw)
    return this
  }

  /** Retrieve all registered middlewares in registration order. */
  all(): RenderMiddleware[] {
    return this.mws
  }

  /** Remove all registered middlewares (useful in tests). */
  clear(): void {
    this.mws = []
  }
}

export const middlewareRegistry = new RenderMiddlewareRegistry()