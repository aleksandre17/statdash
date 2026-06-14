# data-store.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — DataStore: unified query() interface
 *
 * BLOCKER 1 resolution (M-5 applied: platform enhancement, not minimum fix).
 *
 * Pattern: Grafana DataSourceApi.query() · Cube.dev CubeApi.load() · Builder.io DataSource Plugin
 *
 * BEFORE: val(code, ctx): number  |  observe(query, ctx): Observation[]  ← two methods, interface split
 * AFTER:  query(q: StoreQuery, ctx): EngineRow[]                          ← single entry point
 *
 * Platform value added (M-5):
 *   'schema'     → Constructor palette: browsable indicator catalog (Phase 2)
 *   'distinct'   → filter dropdowns: unique dim values without full observe()
 *   batchQuery?  → Grafana targets[]: N+1 elimination, single HTTP round trip
 *   StoreCaps    → engine/Constructor adapts behavior per store capability
 *   runBatch()   → uniform batch API across all store implementations
 */

import type { Observation, ObsQuery, FilterValue }  from '../../../engine/core/src/sdmx'
import type { SectionContext }                       from '../../../engine/core/src/core/context'
import type { EngineRow }                            from '../../../engine/core/src/data/encoding'
import type { Classifier, DisplayMap }               from '../../../engine/core/src/sdmx'


// ═══════════════════════════════════════════════════════════════════════════
// StoreQuery — discriminated union (open for extension)
// ═══════════════════════════════════════════════════════════════════════════
//
// New capability = new discriminant. DataStore interface never changes.
// Downstream code (interpretSpec, resolvers, renderers) stays stable.

export type StoreQuery =
  | { type: 'val';      code: string }                          // OLAP cell sum → [{ value: number }]
  | { type: 'obs';      measure:  string | string[]             // multi-dim fetch → Observation[] rows
                        filter?:  Partial<Record<string, FilterValue>>
                        orderBy?: { field: string; dir: 'asc' | 'desc' } }
  | { type: 'schema'  }                                         // ✨ measures + metadata → Constructor palette
  | { type: 'distinct'; dim: string                             // ✨ unique dim values → filter dropdowns
                        filter?: Partial<Record<string, FilterValue>> }
// Future extension — interface unchanged:
//   | { type: 'sql';       query: string }
//   | { type: 'graphql';   query: string; variables?: Record<string, unknown> }
//   | { type: 'grpc';      method: string; request: unknown }


// ═══════════════════════════════════════════════════════════════════════════
// StoreCaps — capability declaration (Grafana plugin.meta pattern)
// ═══════════════════════════════════════════════════════════════════════════
//
// Engine reads caps before querying — adapts behavior:
//   caps.queryTypes.includes('schema') ? store.query({type:'schema'}, ctx) : []
//   caps.batching ? store.batchQuery(queries, ctx) : queries.map(q => store.query(q, ctx))
// Constructor reads caps to populate palette and feature flags.

export interface StoreCaps {
  /** Which StoreQuery types this store handles. Unknown types return []. */
  queryTypes: ReadonlyArray<StoreQuery['type']>
  /** True when batchQuery() sends one optimized round trip (not just map). */
  batching:   boolean
  /** True when store supports async/streaming (Phase 2 — WebSocket / SSE). */
  streaming:  boolean
}


// ═══════════════════════════════════════════════════════════════════════════
// DataStore — unified interface
// ═══════════════════════════════════════════════════════════════════════════

export interface DataStore {
  // Single entry point — Grafana DataSourceApi.query() / Cube.dev CubeApi.load()
  query(q: StoreQuery, ctx: SectionContext): EngineRow[]

  // ✨ Batch — Grafana targets[] pattern
  // When implemented: one HTTP round trip for all queries (ApiStore optimization).
  // When absent: runBatch() falls back to queries.map(q => store.query(q, ctx)).
  batchQuery?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]

  readonly caps?:        StoreCaps          // ✨ Engine + Constructor inspect this
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
}


// ═══════════════════════════════════════════════════════════════════════════
// Helpers — ergonomic wrappers (NOT on interface)
// ═══════════════════════════════════════════════════════════════════════════
//
// Resolvers, kpi.ts, RenderEngine call these — not store.query() directly.
// Decouples call sites from query shape. Easy to swap internally.

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
 * ✨ Batch runner — Grafana targets[] pattern.
 * Uses store.batchQuery() when available (caps.batching: true → one HTTP POST).
 * Falls back to sequential map for in-memory stores.
 * Use for prefetching all DataSpec requirements before rendering.
 */
export function runBatch(store: DataStore, queries: StoreQuery[], ctx: SectionContext): EngineRow[][] {
  if (store.batchQuery) return store.batchQuery(queries, ctx)
  return queries.map((q) => store.query(q, ctx))
}


// ═══════════════════════════════════════════════════════════════════════════
// Concrete class caps — per store type
// ═══════════════════════════════════════════════════════════════════════════

// staticStore — noop, no data
const STATIC_CAPS: StoreCaps = { queryTypes: [], batching: false, streaming: false }

// ExternalStore — in-memory, full surface
const EXTERNAL_CAPS: StoreCaps = {
  queryTypes: ['val', 'obs', 'schema', 'distinct'],  // all 4 — full dataset in memory
  batching:   false,                                  // no HTTP — batching has no benefit
  streaming:  false,
}

// ApiStore — REST + cache, partial surface
const API_CAPS: StoreCaps = {
  queryTypes: ['val', 'obs'],   // no schema/distinct — cache is partial, not full dataset
  batching:   true,             // prefetch sends one POST for all requirements ✅
  streaming:  false,
}

// CachedStore — wraps any store, forwards caps
function buildCachedCaps(source: DataStore): StoreCaps {
  return {
    queryTypes: source.caps?.queryTypes ?? ['val', 'obs'],
    batching:   false,   // cache wrapper doesn't add batch capability
    streaming:  false,
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Usage examples — call sites
// ═══════════════════════════════════════════════════════════════════════════

declare const store:   DataStore
declare const ctx:     SectionContext
declare const stores:  Record<string, DataStore>

// ── val: OLAP scalar lookup (resolver / kpi.ts pattern) ─────────────────
const gdpValue: number = storeVal(store, 'B1G', ctx)
// → store.query({ type: 'val', code: 'B1G' }, ctx)[0].value

// ── obs: multi-dim query (QueryResolver pattern) ─────────────────────────
const timeseries: Observation[] = storeObs(store, {
  measure: 'B1G',
  filter:  { geo: { $ctx: 'geo' } },
  orderBy: { field: 'time', dir: 'asc' },
}, ctx)
// → store.query({ type: 'obs', measure: 'B1G', filter: {...}, orderBy: {...} }, ctx)

// ── applyEncoding lookup — pct.of denominator (RenderEngine pattern) ─────
// applyEncoding(raw, spec.encoding, (code) => storeVal(store, code, ctx))

// ── ✨ schema: indicator catalog (Constructor palette — Phase 2) ──────────
const indicators: EngineRow[] = store.query({ type: 'schema' }, ctx)
// → [{ measure: 'B1G', label: 'მთლიანი დამატებული ღირებულება', color: '#0080BE', unit: 'მლნ ₾' }, ...]
// Constructor reads this to populate the indicator picker in the drag-and-drop panel.

// ── ✨ distinct: unique dim values (filter dropdown — year-select / geo-select) ──
const regions: EngineRow[] = store.query({ type: 'distinct', dim: 'geo' }, ctx)
// → [{ value: 'GE-TB', label: 'თბილისი' }, { value: 'GE-KA', label: 'კახეთი' }, ...]
// FilterControl uses this instead of full observe() — only unique values, no aggregation.

const years: EngineRow[] = store.query({
  type:   'distinct',
  dim:    'time',
  filter: { geo: { $ctx: 'geo' } },   // years available for current region
}, ctx)

// ── ✨ caps: engine adapts behavior ─────────────────────────────────────────
function safeSchema(s: DataStore, c: SectionContext): EngineRow[] {
  if (!s.caps?.queryTypes.includes('schema')) return []
  return s.query({ type: 'schema' }, c)
}

// ── ✨ runBatch: N+1 elimination — prefetch all requirements ─────────────────
const queries: StoreQuery[] = [
  { type: 'val', code: 'B1G' },
  { type: 'val', code: 'P3'  },
  { type: 'obs', measure: ['D1', 'D2'], filter: { time: { $ctx: 'time' } } },
]
// ApiStore: single HTTP POST  → returns [[...], [...], [...]]
// ExternalStore: sequential map → same result, no HTTP overhead
const results: EngineRow[][] = runBatch(store, queries, ctx)


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// ❌ store.val(code, ctx)     → storeVal(store, code, ctx)
// ❌ store.observe(q, ctx)    → storeObs(store, q, ctx)
// ❌ store.query() in config  → DataSpec in config = declarative. query() in renderer/interpretSpec only.
// ❌ call query() for schema if store.caps?.queryTypes doesn't include 'schema'

// ✅ storeVal / storeObs helpers everywhere val/observe is needed
// ✅ runBatch() for multi-query prefetch (ApiStore optimizes, ExternalStore maps)
// ✅ check caps before optional queries (schema, distinct)
// ✅ new capability = new discriminant in StoreQuery — interface never changes
```
