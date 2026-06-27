// ── perspectiveRegistry — open singleton (Grafana variableAdapters pattern) ──
//
//  A perspective KIND registers once, site-wide: the shared label/icon vocabulary
//  the Constructor palette discovers. New perspective: one perspectiveRegistry
//  .register() call in setupRegistrations.ts. Zero engine/renderer changes.
//
//  Note: the geostat page perspective-bar derives its toggle labels/icons from the
//  authored PerspectiveDef (decision B, P5.2) — NOT this registry. The registry is
//  the Constructor's perspective palette (capability discovery), and the boot-time
//  home for a site's manifest-declared perspective vocabulary.
//

import type { PerspectiveId, PerspectiveOption } from './types'

class PerspectiveRegistryImpl {
  private readonly defs = new Map<PerspectiveId, PerspectiveOption>()

  register(def: PerspectiveOption): void {
    this.defs.set(def.id, def)
  }

  get(id: PerspectiveId): PerspectiveOption | undefined {
    return this.defs.get(id)
  }

  /** Constructor palette: all registered perspectives */
  list(): PerspectiveOption[] {
    return [...this.defs.values()]
  }

  /** Resolve a declared id list to PerspectiveOption[] (skips unknown ids gracefully) */
  resolve(ids: PerspectiveId[]): PerspectiveOption[] {
    return ids.flatMap(id => {
      const def = this.defs.get(id)
      return def ? [def] : []
    })
  }
}

export const perspectiveRegistry = new PerspectiveRegistryImpl()
