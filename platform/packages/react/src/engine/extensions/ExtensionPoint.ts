/**
 * ExtensionPoint<T> — a typed slot plugins contribute into.
 *
 * Identity is by `id` (string), NOT by object reference — same rule as
 * InjectionToken. Survives Vite HMR and duplicate module copies.
 * T is the contribution result type (ReactNode for UI points).
 */
export class ExtensionPoint<T> {
  declare readonly __type: T
  readonly id: string
  constructor(id: string) { this.id = id }
}

export function createExtensionPoint<T>(id: string): ExtensionPoint<T> {
  return new ExtensionPoint<T>(id)
}

/**
 * A single contribution to an extension point.
 * `when`  — optional filter; absent means always contribute.
 * `order` — lower numbers render first.
 * `render` — produces the contribution (host context available).
 */
export interface Contribution<T, Ctx = unknown> {
  order?:  number
  when?:   (host: Ctx) => boolean
  render:  (host: Ctx) => T
}
