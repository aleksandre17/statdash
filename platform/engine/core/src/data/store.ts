// ── DataStore — contracts, helpers, and static default ────────────────
//
//  This file is the engine contract boundary:
//    StoreQuery   — discriminated union of all query types (open for extension)
//    StoreCaps    — capability declaration
//    DataStore    — the single unified interface (Grafana DataSourceApi pattern)
//    Requirement  — prefetch descriptor
//    storeVal/storeObs/runBatch — ergonomic wrappers used by resolvers
//    staticStore  — empty default (no-op)
//
//  Concrete implementations (ApiStore, CachedStore, ExternalStore) live in
//  store-impl.ts. Filter helpers and DimResolver live in store-filter.ts.
//

import type { Classifier, DimVal, DisplayMap, FilterValue, Observation, ObsQuery } from '../sdmx'
import type { SectionContext }                                                       from '../core/context'
import type { EngineRow }                                                            from './encoding'
import type { MetadataPort }                                                         from '../core/provenance'

// re-export so callers can use Observation without touching store internals
export type { Observation } from '../sdmx'


// ══════════════════════════════════════════════════════════════════════
// StoreQuery — discriminated union (open for extension)
// ══════════════════════════════════════════════════════════════════════
//
// New capability = new discriminant. DataStore interface never changes.
// Grafana DataSourceApi.query() · Cube.dev CubeApi.load() pattern.

export type StoreQuery =
  | { type: 'val';      code: string }                           // OLAP cell sum → [{ value: number }]
  | { type: 'obs';      measure:  string | string[]              // multi-dim fetch → Observation[] rows
                        filter?:  Partial<Record<string, FilterValue>>
                        orderBy?: { field: string; dir: 'asc' | 'desc' } }
  | { type: 'schema'  }                                          // measures + metadata → Constructor palette
  | { type: 'distinct'; dim: string                              // unique dim values → filter dropdowns
                        filter?: Partial<Record<string, FilterValue>> }


// ══════════════════════════════════════════════════════════════════════
// StoreCaps — capability declaration (Grafana plugin.meta pattern)
// ══════════════════════════════════════════════════════════════════════

export interface StoreCaps {
  queryTypes: ReadonlyArray<StoreQuery['type']>
  batching:   boolean
  streaming:  boolean
}


// ══════════════════════════════════════════════════════════════════════
// DataStore — unified interface
// ══════════════════════════════════════════════════════════════════════
//
//  Single entry point — Grafana DataSourceApi.query() / Cube.dev CubeApi.load().
//  Abstraction between interpretSpec and the data source.
//
//  query({type:'val', code}, ctx) — OLAP point read: returns [{ value: number }].
//    ctx.dims carries ALL dimensions (time, geo, sector, …).
//    ExternalStore matches every dim present in ctx.dims against obs fields.
//
//  query({type:'obs', measure, filter, orderBy}, ctx) — multi-dim query.
//    Returns Observation[] rows — one per matching (measure × dims) cell.
//    CtxRef filter values resolved against ctx.
//

export interface DataStore {
  query(q: StoreQuery, ctx: SectionContext): EngineRow[]
  batchQuery?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]
  readonly caps?:        StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
  /**
   * Optional provenance seam — store exposes per-indicator metadata.
   * Implemented optionally; renderers access via `store.metadata?.provenance(code, ctx)`.
   * Reference: roadmap Layer 9.2 [N14].
   */
  readonly metadata?:    MetadataPort
}


// ══════════════════════════════════════════════════════════════════════
// Helpers — ergonomic wrappers (NOT on interface)
// ══════════════════════════════════════════════════════════════════════
//
// Resolvers, kpi.ts, RenderEngine call these — not store.query() directly.

/** OLAP scalar — resolvers + kpi.ts + applyEncoding lookup callback. */
export function storeVal(store: DataStore, code: string, ctx: SectionContext): number {
  return (store.query({ type: 'val', code }, ctx)[0]?.['value'] as number) ?? 0
}

/** Multi-dim query — resolvers that need Observation[]. */
export function storeObs(store: DataStore, q: ObsQuery, ctx: SectionContext): Observation[] {
  return store.query(
    { type: 'obs', measure: q.measure, filter: q.filter, orderBy: q.orderBy },
    ctx,
  ) as Observation[]
}

/**
 * Batch runner — Grafana targets[] pattern.
 * Uses store.batchQuery() when available (one HTTP POST).
 * Falls back to sequential map for in-memory stores.
 */
export function runBatch(store: DataStore, queries: StoreQuery[], ctx: SectionContext): EngineRow[][] {
  if (store.batchQuery) return store.batchQuery(queries, ctx)
  return queries.map((q) => store.query(q, ctx))
}


// ── Requirement ───────────────────────────────────────────────────────
//
//  { code, dims } pair extracted from a DataSpec before fetching.
//  Used by ApiStore.prefetch() and CachedStore.warm() to batch-load
//  exactly the values a spec needs — no over-fetching, no N+1.

export interface Requirement {
  code: string
  dims: Record<string, DimVal>
}


// ── staticStore — empty default (no-op) ──────────────────────────────

export const staticStore: DataStore = {
  query():     EngineRow[] { return [] },
  caps: { queryTypes: [], batching: false, streaming: false },
}
