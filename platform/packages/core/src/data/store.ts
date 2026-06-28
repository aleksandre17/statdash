// ── DataStore — contracts, helpers, and static default ────────────────
//
//  This file is the engine contract boundary:
//    StoreQuery   — discriminated union of all query types (open for extension)
//    StoreCaps    — capability declaration
//    DataStore    — the single unified interface (Grafana DataSourceApi pattern)
//    QueryResult  — async envelope (state + data + error + meta) [N34]
//    ResultMeta   — per-query diagnostics (cache, source, timing) [N34]
//    Requirement  — prefetch descriptor
//    storeVal/storeObs/runBatch — ergonomic wrappers used by resolvers
//    asyncFromSync — derive queryAsync from a synchronous querySync [N34]
//    staticStore  — empty default (no-op)
//
//  Concrete implementations (ApiStore, CachedStore, ExternalStore) live in
//  store-impl.ts. Filter helpers and DimResolver live in store-filter.ts.
//

import type { Classifier, DimVal, DisplayMap, FilterValue, Observation, ObsQuery } from '../sdmx'
import type { SectionContext }                                                       from '../core/context'
import type { EngineRow }                                                            from './encoding'
import type { MetadataPort }                                                         from '../core/provenance'
import type { FieldMeta, FieldSchema }                                               from './fieldSchema'
import { toFieldMeta }                                                               from './fieldSchema'

// re-export so callers can use Observation without touching store internals
export type { Observation } from '../sdmx'


// ══════════════════════════════════════════════════════════════════════
// Grain model — GENERIC per-dim LOD (Law 1: time is one lattice, not special)
// ══════════════════════════════════════════════════════════════════════
//
//  GrainLevel is a generic grain name on ANY dimension — 'year'|'quarter'|… on
//  the time axis, 'district'|'region'|… on a geo axis. The SAME machinery orders
//  every dim's grains; the time lattice is one registered entry, never a `'time'`
//  literal special-case (FF-GRAIN-GENERIC). The grain LATTICE + rollup-routing
//  (StoreCaps.grains, finer→coarser materialized-view fallback) is the additive
//  door layered on top of this port; here the type is what the point-read addresses.
export type GrainLevel = string

//  Aggregation applied when one coordinate matches MULTIPLE finer observations
//  (the implicit grain-rollup `_val` already performs as a sum). Default 'sum' is
//  byte-identical to today's OLAP cell sum.
export type RollupOp = 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last'


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
                        orderBy?: { field: string; dir: 'asc' | 'desc' }
                        limit?:   number }                       // optional row cap (P2-1 pagination)
  | { type: 'schema';   indicator?: string }                    // measures + metadata → Constructor palette
  | { type: 'distinct'; dim: string                              // unique dim values → filter dropdowns
                        filter?: Partial<Record<string, FilterValue>> }
  // ── valAt — declarative point read at an explicit coordinate + grain ──
  //  The OLAP cell sum `val` reads at `ctx.dims`; `valAt` reads at `ctx.dims ⊕ at`
  //  WITHOUT cloning ctx (the declarative analogue of `atTime(y, ctx)`), addressed
  //  by a GENERIC coordinate + GENERIC per-dim grain (Law 1 — never time-special).
  //  Default `rollup:'sum'` + no `grain` ≡ the implicit `_val` grain-sum at that
  //  coordinate (byte-identical anchor, FF-VALAT-COORD-IDENTICAL). `grain` requests
  //  an LOD (the finer→coarser rollup lattice is the additive door layered later).
  | { type:    'valAt'
      code:    string
      at?:     Partial<Record<string, DimVal>>                   // GENERIC coordinate override of ctx.dims
      grain?:  Record<string, GrainLevel>                        // GENERIC per-dim grain (LOD door)
      rollup?: RollupOp }                                        // finer→requested aggregation (default 'sum')


// ══════════════════════════════════════════════════════════════════════
// StoreCaps — capability declaration (Grafana plugin.meta pattern)
// ══════════════════════════════════════════════════════════════════════

export interface StoreCaps {
  queryTypes: ReadonlyArray<StoreQuery['type']>
  batching:   boolean
  streaming:  boolean
  /**
   * True ⟺ querySync() returns complete rows without I/O.
   * Gate for SSR / snapshot synchronous fast-lane [N34].
   * Absent → treated as true (Phase-1 convention: every existing store is sync).
   */
  sync?:      boolean
}


// ══════════════════════════════════════════════════════════════════════
// QueryResult + ResultMeta — async envelope [N34]
// ══════════════════════════════════════════════════════════════════════
//
//  Returned by queryAsync() / batchQueryAsync().
//  Sync stores wrap their result via asyncFromSync() below.

export interface ResultMeta {
  cacheHit?:   boolean
  source?:     string
  durationMs?: number
  totalRows?:  number
  /** True when the response limit was hit and more rows exist server-side. */
  truncated?:  boolean
}

export interface QueryResult<T = EngineRow> {
  state:  'loading' | 'done' | 'error'
  data:   T[]
  error?: string
  meta?:  ResultMeta
}

export type Unsubscribe = () => void


// ══════════════════════════════════════════════════════════════════════
// DataStore — unified interface
// ══════════════════════════════════════════════════════════════════════
//
//  Single entry point — Grafana DataSourceApi / Cube.dev CubeApi pattern.
//  Abstraction between interpretSpec and the data source.
//
//  querySync({type:'val', code}, ctx) — OLAP point read: returns [{ value: number }].
//    ctx.dims carries ALL dimensions (time, geo, sector, …).
//    ExternalStore matches every dim present in ctx.dims against obs fields.
//
//  querySync({type:'obs', measure, filter, orderBy}, ctx) — multi-dim query.
//    Returns Observation[] rows — one per matching (measure × dims) cell.
//    CtxRef filter values resolved against ctx.
//
//  queryAsync — async primary path; sync stores derive it via asyncFromSync().
//  subscribe  — optional live subscription (N34d); present ⟺ caps.streaming === true.
//

export interface DataStore {
  /**
   * Synchronous fast-lane. Returns rows immediately from in-memory state.
   * MUST be implemented by every sync-capable store (caps.sync !== false).
   * Used by: SSR, warm-then-read, interpretSpec, and useNodeRows' first-paint.
   * Renamed from query() — pure rename, same signature, same return.
   */
  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[]

  /**
   * Async primary path. Returns a QueryResult envelope.
   * Sync stores: micro-task wrap of querySync (state:'done' immediately).
   * Network stores: performs the fetch and resolves to 'done' | 'error'.
   * Optional: a sync-only store may omit this — the engine derives it via asyncFromSync().
   */
  queryAsync?(q: StoreQuery, ctx: SectionContext): Promise<QueryResult>

  /** Batch fast-lane (renamed for symmetry with querySync). */
  batchQuerySync?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]

  /** Async batch — Grafana targets[] in one round-trip. */
  batchQueryAsync?(queries: StoreQuery[], ctx: SectionContext): Promise<QueryResult[]>

  /**
   * Optional live subscription — see N34d.
   * Present ⟺ caps.streaming === true.
   */
  subscribe?(q: StoreQuery, ctx: SectionContext, onResult: (r: QueryResult) => void): Unsubscribe

  /**
   * Optional synchronous frame query with truncation metadata (P2-1 pagination).
   * When present, callers can apply a row cap and receive totalRows/truncated in
   * one call.  Absent → callers fall back to querySync + manual slicing.
   * Open for extension: new stores implement this; existing stores are unaffected.
   */
  queryFrame?(q: StoreQuery, ctx: SectionContext): { rows: EngineRow[]; meta: ResultMeta }

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
// Resolvers, kpi.ts, RenderEngine call these — not store.querySync() directly.

/** OLAP scalar — resolvers + kpi.ts + applyEncoding lookup callback. */
export function storeVal(store: DataStore, code: string, ctx: SectionContext): number {
  return (store.querySync({ type: 'val', code }, ctx)[0]?.['value'] as number) ?? 0
}

/**
 * OLAP point read at an EXPLICIT coordinate (+ optional grain) — the declarative
 * analogue of `storeVal(code, atTime(y, ctx))`. `at` overrides `ctx.dims` for this
 * read ONLY (no ctx cloning), so `storeValAt(store, code, { [TIME_DIM]: y }, ctx)`
 * reproduces the pinned-year read GENERICALLY (Law 1 — any dim, e.g. `{ geo:'GE' }`,
 * not just time). The single seam resolvers call so they never touch the port.
 *
 * Default (rollup 'sum', no grain) is BYTE-IDENTICAL to the implicit `_val`
 * grain-sum at that coordinate, so it routes through the existing `val` query at the
 * merged coordinate — keeping EVERY store (incl. the async ApiStore, which warms
 * `val`/`obs` only) serving it unchanged. An explicit rollup op / grain (the LOD
 * door) issues the `valAt` port query instead. FF-VALAT-COORD-IDENTICAL.
 */
export function storeValAt(
  store:   DataStore,
  code:    string,
  at:      Partial<Record<string, DimVal>>,
  ctx:     SectionContext,
  grain?:  Record<string, GrainLevel>,
  rollup?: RollupOp,
): number {
  if (!grain && (rollup === undefined || rollup === 'sum')) {
    // Default point read ≡ an OLAP `val` cell sum at ctx.dims ⊕ at — route through
    // the existing `val` query so async/raw stores stay byte-identical (warm-key safe).
    const keys = Object.keys(at)
    const merged: SectionContext = keys.length === 0
      ? ctx
      // `at` is Partial (values may be undefined); the matching loop skips unset
      // dims, so the cast is sound — undefined keys never narrow a coordinate.
      : { ...ctx, dims: { ...ctx.dims, ...at } as Record<string, DimVal> }
    return storeVal(store, code, merged)
  }
  const q: StoreQuery = { type: 'valAt', code, at, grain, rollup }
  return (store.querySync(q, ctx)[0]?.['value'] as number) ?? 0
}

/** Multi-dim query — resolvers that need Observation[]. */
export function storeObs(store: DataStore, q: ObsQuery, ctx: SectionContext): Observation[] {
  return store.querySync(
    { type: 'obs', measure: q.measure, filter: q.filter, orderBy: q.orderBy },
    ctx,
  ) as Observation[]
}

/** Schema query ergonomic wrapper. Returns [] on any error (stores not implementing schema queries throw). */
export function storeSchema(
  store:      DataStore,
  ctx:        SectionContext,
  indicator?: string,
): FieldMeta[] {
  try {
    const rows = store.querySync({ type: 'schema', indicator }, ctx)
    // Enrich each row with derived suggestedEncodings. Idempotent: a store that
    // already populated suggestedEncodings is preserved as-is. [P3-2]
    return (rows as unknown as Array<FieldMeta & FieldSchema>).map((row) =>
      row.suggestedEncodings ? (row as FieldMeta) : toFieldMeta(row),
    )
  } catch {
    return []
  }
}

/**
 * Batch runner — Grafana targets[] pattern.
 * Uses store.batchQuerySync() when available (one HTTP POST).
 * Falls back to sequential map for in-memory stores.
 */
export function runBatch(store: DataStore, queries: StoreQuery[], ctx: SectionContext): EngineRow[][] {
  if (store.batchQuerySync) return store.batchQuerySync(queries, ctx)
  return queries.map((q) => store.querySync(q, ctx))
}


// ── asyncFromSync — N34 helper ────────────────────────────────────────
//
//  Derives a Promise<QueryResult>-returning queryAsync from a synchronous
//  querySync. Wraps in a micro-task so callers always get a Promise, but
//  for in-memory stores the result is available in the same microtask flush.
//  Used by N34b to auto-provide queryAsync on sync-only stores.

export function asyncFromSync(
  store: DataStore,
): (q: StoreQuery, ctx: SectionContext) => Promise<QueryResult> {
  return async (q, ctx) => {
    try {
      const data = store.querySync(q, ctx)
      return { state: 'done', data, meta: { cacheHit: false } }
    } catch (e) {
      return { state: 'error', data: [], error: e instanceof Error ? e.message : String(e) }
    }
  }
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
  querySync(): EngineRow[] { return [] },
  caps: { queryTypes: [], batching: false, streaming: false, sync: true },
}
