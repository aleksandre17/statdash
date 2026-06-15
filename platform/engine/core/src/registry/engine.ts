// ── EngineRegistry — Strategy + Plugin Pattern (spec half) ────────────
//
//  Phase 8.1: chart interpretation moved to @geostat/charts (ChartRegistry).
//  EngineRegistry now owns ONLY DataSpec resolution.
//
//  Pattern: Grafana panel plugin registry, Vega-Lite mark registry,
//           Retool component registry, Builder.io plugin system.
//
//  Usage:
//    import { defaultRegistry } from '@geostat/engine'
//    defaultRegistry.registerSpec(mySpecResolver)   // extend / override (last wins)
//

import type { EngineRow } from '../data/encoding'
import type { DataSpec }           from '../config/section'
import type { SectionContext } from '../core/context'
import type { DataStore }          from '../data/store'

// ── SpecResolver — plugin interface for DataSpec → EngineRow[] ────────
//
//  Implement this to add a new DataSpec type or replace a built-in.
//  The type discriminant must match DataSpec.type exactly.
//
//  Resolvers return EngineRow[] — neutral records, no renderer concepts.
//  Encoding (field→channel mapping) happens at the renderer boundary.
//
export interface SpecResolver<T extends DataSpec = DataSpec> {
  /** Matches DataSpec.type — used as the registry key. */
  readonly type: T['type']
  resolve(spec: T, ctx: SectionContext, store: DataStore): EngineRow[]
}

// ── EngineRegistry ────────────────────────────────────────────────────

export class EngineRegistry {
  private readonly _specs  = new Map<string, SpecResolver>()

  /** Register a SpecResolver. Last registration wins. Fluent. */
  registerSpec<T extends DataSpec>(resolver: SpecResolver<T>): this {
    this._specs.set(resolver.type as string, resolver as SpecResolver)
    return this
  }

  spec(type: string): SpecResolver | undefined  { return this._specs.get(type)  }

  /** All registered DataSpec type keys — used by Constructor + validateDataSpec. */
  specTypes(): string[]  { return [...this._specs.keys()]  }

  hasSpec(type: string): boolean  { return this._specs.has(type)  }
}

// ── defaultRegistry — pre-populated with all built-in spec resolvers ──
//
//  Extend at application level without touching engine source:
//    import { defaultRegistry } from '@geostat/engine'
//    defaultRegistry.registerSpec(myResolver)
//
//  For chart interpreter extension, use chartRegistry from @geostat/charts.
//
export const defaultRegistry = new EngineRegistry()