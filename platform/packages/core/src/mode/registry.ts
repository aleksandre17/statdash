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

export const modeRegistry = new ModeRegistryImpl()