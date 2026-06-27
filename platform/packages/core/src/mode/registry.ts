// ── ModeRegistry — open singleton (Grafana variableAdapters pattern) ─────
//
//  New mode: one modeRegistry.register() call in setupRegistrations.ts.
//  Zero engine changes. Zero renderer changes. Constructor palette updates automatically.
//

import type { ModeId, ModeDef } from './types'

class ModeRegistryImpl {
  private readonly defs = new Map<ModeId, ModeDef>()

  register(def: ModeDef): void {
    this.defs.set(def.id, def)
  }

  get(id: ModeId): ModeDef | undefined {
    return this.defs.get(id)
  }

  /** Constructor palette: all registered modes */
  list(): ModeDef[] {
    return [...this.defs.values()]
  }

  /** Resolve a declared id list to ModeDef[] (skips unknown ids gracefully) */
  resolve(ids: ModeId[]): ModeDef[] {
    return ids.flatMap(id => {
      const def = this.defs.get(id)
      return def ? [def] : []
    })
  }
}

// ── perspectiveRegistry — the CANONICAL name (VISION #3) ──────────────────────
//
//  A perspective KIND registers once, site-wide (the Grafana variableAdapters /
//  registry↔instance pattern): the shared label/icon vocabulary that every page's
//  PerspectiveDef references by id (FULLSTACK §4 — the site-scoped half). The
//  perspective axis refactor renames `mode` → `perspective` wholesale; this is the
//  registry's canonical name going forward.
//
//  `modeRegistry` is kept as a BACK-COMPAT ALIAS of the SAME singleton instance
//  (NOT a second registry) until System A retires in P6 — every existing
//  modeRegistry.register()/list()/resolve() call keeps working, identical behaviour,
//  zero migration. `perspectiveRegistry === modeRegistry` (one instance, two names).
export const perspectiveRegistry = new ModeRegistryImpl()

/** @deprecated Use `perspectiveRegistry`. Back-compat alias of the SAME singleton (retires in P6, VISION #3). */
export const modeRegistry = perspectiveRegistry