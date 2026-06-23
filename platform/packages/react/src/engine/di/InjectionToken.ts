/**
 * InjectionToken<T> — a typed DI key (Angular/NestJS/tsyringe pattern).
 *
 * The token IS the type: provide(token, value) and inject(token) are
 * correlated by construction — no UIComponentMap, no `declare module`,
 * no correlated-union cast.
 *
 * Identity is by `description` (string), NOT by object reference. This
 * survives Vite HMR and duplicate module copies (the platform has a
 * documented duplicate-module hazard). Two tokens with the same description
 * are treated as the same binding — therefore descriptions must be unique
 * (a fitness test enforces this).
 */
export class InjectionToken<T> {
  /** Phantom — never assigned; forces T to participate in assignability. */
  declare readonly __type: T

  constructor(readonly description: string) {}

  toString(): string { return `InjectionToken(${this.description})` }
}
