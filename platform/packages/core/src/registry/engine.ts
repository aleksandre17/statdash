// ── EngineRegistry — Strategy + Plugin Pattern (spec half) ────────────
//
//  Phase 8.1: chart interpretation moved to @statdash/charts (ChartRegistry).
//  EngineRegistry now owns ONLY DataSpec resolution.
//
//  Pattern: Grafana panel plugin registry, Vega-Lite mark registry,
//           Retool component registry, Builder.io plugin system.
//
//  Usage:
//    import { defaultRegistry } from '@statdash/engine'
//    defaultRegistry.registerSpec(mySpecResolver)   // extend / override (last wins)
//

import type { EngineRow } from '../data/encoding'
import type { ResolvableSpec }     from '../config/data-spec'
import type { SectionContext } from '../core/context'
import type { DataStore }          from '../data/store'

// ── SpecResolver — plugin interface for (Resolvable)Spec → EngineRow[] ─
//
//  Implement this to add a new DataSpec type or replace a built-in.
//  The type discriminant must match the spec's `type` exactly.
//
//  T extends ResolvableSpec (= public DataSpec ∪ internal lowering primitives like
//  `point-series`) so the registry can host both author-facing discriminants AND the
//  engine-internal desugar targets the convenience specs lower onto. The PUBLIC
//  vocabulary stays `DataSpec`; the internal primitives never reach the Constructor.
//
//  Resolvers return EngineRow[] — neutral records, no renderer concepts.
//  Encoding (field→channel mapping) happens at the renderer boundary.
//
export interface SpecResolver<T extends ResolvableSpec = ResolvableSpec> {
  /** Matches the spec's `type` — used as the registry key. */
  readonly type: T['type']
  resolve(spec: T, ctx: SectionContext, store: DataStore): EngineRow[]
}

// ── EngineRegistry ────────────────────────────────────────────────────

export class EngineRegistry {
  private readonly _specs  = new Map<string, SpecResolver>()

  /** Register a SpecResolver. Last registration wins. Fluent. */
  registerSpec<T extends ResolvableSpec>(resolver: SpecResolver<T>): this {
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
//    import { defaultRegistry } from '@statdash/engine'
//    defaultRegistry.registerSpec(myResolver)
//
//  For chart interpreter extension, use chartRegistry from @statdash/charts.
//
export const defaultRegistry = new EngineRegistry()