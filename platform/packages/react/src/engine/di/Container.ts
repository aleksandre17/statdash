import type { InjectionToken } from './InjectionToken'

export interface Container {
  inject<T>(token: InjectionToken<T>): T
  provide<T>(token: InjectionToken<T>, value: T): void
  has<T>(token: InjectionToken<T>): boolean
}

export class MapContainer implements Container {
  // Keyed by description (string) — NOT by token object. HMR-safe.
  private readonly bindings = new Map<string, unknown>()

  inject<T>(token: InjectionToken<T>): T {
    if (!this.bindings.has(token.description)) {
      throw new Error(`Container: no binding for token '${token.description}'`)
    }
    return this.bindings.get(token.description) as T
  }

  provide<T>(token: InjectionToken<T>, value: T): void {
    this.bindings.set(token.description, value)
  }

  has<T>(token: InjectionToken<T>): boolean {
    return this.bindings.has(token.description)
  }
}
