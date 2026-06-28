// ── Store Implementations — sync in-memory stores ─────────────────────
//
//  CachedStore  — memoization wrapper over any DataStore
//  ExternalStore — in-memory Observation[] (config-file datasets)
//
//  ApiStore (async REST fetcher) lives in store-api.ts.
//  Filter-matching utilities and DimResolver live in store-filter.ts.
//  All three classes are re-exported from @statdash/engine.
//

import type { Classifier, DimVal, DisplayMap, ObsQuery, Observation }  from '../sdmx'
import type { SectionContext }                                          from '../core/context'
import { MEASURE_DIM }                                                  from '../core/context'
import type { EngineRow }                                              from './encoding'
import { storeVal, asyncFromSync }                                     from './store'
import type { DataStore, QueryResult, Requirement, ResultMeta, StoreCaps, StoreQuery } from './store'
import { dimKey, matchesFilter, matchesLeaves, DimResolver }           from './store-filter'
import type { LeafFn }                                                 from './store-filter'
import { roundAgg }                                                    from './round'
import { rollupValues }                                               from './grain'
import type { MetadataPort }                                           from '../core/provenance'


// ── CachedStore — memoization wrapper over any DataStore ──────────────
//
//  val queries:  keyed on `${code}:${dimKey(ctx)}` — no TTL (invalidate() clears).
//  obs queries:  keyed on a deterministic JSON fingerprint of (type, measure,
//                filter, orderBy, limit, ctx.dims) — TTL-based (default 5 min).
//
//  distinct/schema pass through; they are lightweight and rarely repeat with
//  identical inputs inside a single render cycle.

/** Stable cache key for obs queries: encodes every axis that affects result rows. */
function obsCacheKey(q: StoreQuery, ctx: SectionContext): string {
  if (q.type !== 'obs') {
    // Defensive: only called for obs, but produce a safe fallback
    return JSON.stringify({ type: q.type })
  }
  return JSON.stringify({
    type:    q.type,
    measure: q.measure,
    filter:  q.filter  ?? null,
    orderBy: q.orderBy ?? null,
    limit:   q.limit   ?? null,
    dims:    ctx.dims,
  })
}

export class CachedStore implements DataStore {
  readonly caps:  StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
  /**
   * Proxied provenance seam (P2-3). CachedStore is transparent over the source:
   * just as it forwards `classifiers`/`display`, it forwards the MetadataPort so
   * wrapping a store in CachedStore never hides its provenance. The port is a
   * pure read (no caching needed — the source resolved it once at build time).
   */
  readonly metadata?:    MetadataPort

  private valCache = new Map<string, number>()
  private readonly _obsCache = new Map<string, { rows: EngineRow[]; expiresAt: number }>()
  // In-flight queryAsync dedup — keyed identically to the cache it warms. A second
  // concurrent queryAsync for the same key (React StrictMode's double-invoke, or two
  // warm consumers naming the same slice) reuses the FIRST promise instead of firing
  // a second fetch that races/aborts the first. Settled entries are cleared so a real
  // re-fetch is never blocked, and a rejection still propagates (errors not suppressed).
  private readonly _inflight = new Map<string, Promise<QueryResult<EngineRow>>>()

  private readonly source: DataStore
  private readonly ttlMs: number

  constructor(
    source: DataStore,
    ttlMs: number = 5 * 60 * 1000,
  ) {
    this.source = source
    this.ttlMs  = ttlMs
    // Capability-transparent: inherit the wrapped source's sync/streaming flags
    // rather than hardcoding sync:true. A SYNC source (caps.sync !== false →
    // ExternalStore, staticStore) keeps caps.sync === true ⇒ byte-identical to
    // the legacy wrapper. An ASYNC source (ApiStore, caps.sync === false) is no
    // longer masked: the wrapper now ALSO reports sync:false so renderNode routes
    // it through useNodeRows' queryAsync suspend path instead of cold querySync.
    // streaming is likewise inherited (CachedStore does not proxy subscribe(), so
    // a streaming source still bypasses CachedStore upstream in resolveStore —
    // inheriting the flag keeps the cap honest if it ever is wrapped).
    this.caps        = {
      queryTypes: source.caps?.queryTypes ?? ['val', 'obs'],
      batching:   false,
      streaming:  source.caps?.streaming ?? false,
      sync:       source.caps?.sync ?? true,
    }
    this.classifiers = source.classifiers
    this.display     = source.display
    this.metadata    = source.metadata
  }

  private _val(code: string, ctx: SectionContext): number {
    const key = `${code}:${dimKey(ctx)}`
    if (!this.valCache.has(key)) {
      this.valCache.set(key, storeVal(this.source, code, ctx))
    }
    return this.valCache.get(key)!
  }

  private _obs(q: StoreQuery & { type: 'obs' }, ctx: SectionContext): EngineRow[] {
    const key   = obsCacheKey(q, ctx)
    const entry = this._obsCache.get(key)
    if (entry && Date.now() < entry.expiresAt) return entry.rows
    const rows = this.source.querySync(q, ctx)
    this._obsCache.set(key, { rows, expiresAt: Date.now() + this.ttlMs })
    return rows
  }

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    switch (q.type) {
      case 'val':      return [{ value: this._val(q.code, ctx) }]
      case 'obs':      return this._obs(q, ctx)
      case 'schema':
      case 'distinct': return this.source.querySync(q, ctx)
      case 'valAt': {
        // Default (sum + no grain) ≡ a `val` cell sum at ctx.dims ⊕ at — serve from the
        // SAME valCache keyed on the merged coordinate (warm/read share one slot). An
        // explicit rollup op / grain (LOD door) delegates to the source's `valAt` port.
        if (!q.grain && (q.rollup === undefined || q.rollup === 'sum')) {
          const merged = q.at ? { ...ctx, dims: { ...ctx.dims, ...q.at } as Record<string, DimVal> } : ctx
          return [{ value: this._val(q.code, merged) }]
        }
        return this.source.querySync(q, ctx)
      }
    }
  }

  // ── queryAsync — async primary path (capability-transparent) ──────────
  //
  //  Delegates to source.queryAsync (deriving it from source.querySync via
  //  asyncFromSync when the source is sync-only) and memoizes the resolved rows
  //  into the SAME caches querySync reads. This is the Cache-Aside warm step
  //  (ADR-STORE-001): awaiting queryAsync once populates the obs/val cache so a
  //  subsequent querySync(q, ctx) for the same key returns synchronously instead
  //  of throwing on a cold async source.
  //
  //  Memoization (obs queries): the resolved rows are written into _obsCache under
  //  obsCacheKey — the SAME key CachedStore.querySync reads — so a warmed obs query
  //  is served from this wrapper's cache on the next sync read.
  //
  //  val queries: delegated to source.queryAsync to warm the SOURCE's own cache
  //  (e.g. ApiStore keys val/obs identically on the request params). The wrapper's
  //  valCache is NOT written here because the source — not the wrapper — defines a
  //  val's aggregation; CachedStore._val (sync) recomputes it via storeVal against
  //  the now-warm source, keeping the OLAP-sum semantics intact. This avoids
  //  caching a raw first-row value as if it were the aggregate.
  async queryAsync(q: StoreQuery, ctx: SectionContext): Promise<QueryResult<EngineRow>> {
    // Dedup concurrent identical fetches (StrictMode double-invoke / two warm
    // consumers naming the same slice). Key on the full (q, ctx.dims) fingerprint
    // — for obs this is exactly obsCacheKey (the cache key the result lands under);
    // val/distinct/schema get their own stable key. A pending fetch is shared; once
    // it settles the entry is cleared so a later read can re-fetch (no stale lock).
    const flightKey = q.type === 'obs'
      ? obsCacheKey(q, ctx)
      : JSON.stringify({ q, dims: ctx.dims })

    const pending = this._inflight.get(flightKey)
    if (pending) return pending

    const run = this.source.queryAsync
      ? (qq: StoreQuery) => this.source.queryAsync!(qq, ctx)
      : (qq: StoreQuery) => asyncFromSync(this.source)(qq, ctx)

    const flight = run(q).then((result) => {
      // Memoize a done obs result into the SAME cache querySync reads.
      if (result.state === 'done' && q.type === 'obs') {
        this._obsCache.set(obsCacheKey(q, ctx), {
          rows:      result.data,
          expiresAt: Date.now() + this.ttlMs,
        })
      }
      return result
    })

    // Clear the in-flight slot on settle (resolve OR reject) — never lock out a
    // future fetch, never swallow a rejection (the caller still awaits `flight`).
    this._inflight.set(flightKey, flight)
    flight.finally(() => { this._inflight.delete(flightKey) })

    return flight
  }

  queryFrame(q: StoreQuery, ctx: SectionContext): { rows: EngineRow[]; meta: ResultMeta } {
    if (this.source.queryFrame) {
      return this.source.queryFrame(q, ctx)
    }
    const rows = this.querySync(q, ctx)
    return {
      rows,
      meta: { totalRows: rows.length, truncated: false, source: 'cached', cacheHit: false },
    }
  }

  warm(reqs: Requirement[]): void {
    for (const { code, dims } of reqs) {
      // SectionContext is dims-only here — the cache key is dims-derived (dimKey),
      // and the active perspective never enters a store read.
      this._val(code, { dims })
    }
  }

  invalidate(datasetCode?: string): void {
    if (datasetCode) {
      for (const key of this.valCache.keys()) {
        if (key.startsWith(`${datasetCode}:`)) this.valCache.delete(key)
      }
      for (const key of this._obsCache.keys()) {
        if (key.includes(datasetCode)) this._obsCache.delete(key)
      }
    } else {
      this.valCache.clear()
      this._obsCache.clear()
    }
  }
}


// ── ExternalStore — wraps any Observation[] (config-file datasets) ────
//
//  querySync({type:'val'}, ctx) — OLAP cell sum: matches measure + ALL dims in
//    ctx.dims, sums obs_value across matching rows.
//    isCarryForward observations excluded (SNA T-account dedup).
//
//  querySync({type:'obs'}, ctx) — multi-dim query with CtxRef resolution.
//  querySync({type:'schema'}, ctx) — unique (measure, label, color, unit) tuples.
//  querySync({type:'distinct', dim}, ctx) — unique dim values, optionally filtered.

export interface ExternalStoreOptions {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}

export class ExternalStore implements DataStore {
  readonly observations: Observation[]
  readonly classifiers:  Record<string, Classifier>
  readonly display:      Record<string, DisplayMap>
  readonly caps: StoreCaps = {
    queryTypes: ['val', 'obs', 'schema', 'distinct', 'valAt'],
    batching:   false,
    streaming:  false,
    sync:       true,
  }

  private readonly resolvers: Record<string, DimResolver>

  constructor(observations: Observation[], options?: ExternalStoreOptions) {
    this.observations = observations
    this.classifiers  = options?.classifiers ?? {}
    this.display      = options?.display     ?? {}
    this.resolvers    = {}
    for (const [dim, classifier] of Object.entries(this.classifiers)) {
      this.resolvers[dim] = new DimResolver(classifier)
    }
  }

  private leafSet: LeafFn = (dim, val) => {
    const r = this.resolvers[dim]
    return r ? r.leafIds(val) : [val]
  }

  private toCodeView(obs: Observation): Observation {
    const dims = Object.keys(this.resolvers)
    if (dims.length === 0) return obs
    const out: Record<string, DimVal> = { ...obs }
    for (const dim of dims) {
      if (out[dim] !== undefined) out[dim] = this.resolvers[dim].codeOf(out[dim])
    }
    return out as Observation
  }

  // _matchedValues — the obs-value list at a coordinate (the matching loop SSOT).
  //  Shared by `_val` (OLAP cell sum) and `_valAt` (point read at an explicit
  //  coordinate). Coordinate = a generic dims map; no dimension is privileged.
  private _matchedValues(code: string, dims: Record<string, DimVal>): number[] {
    const out: number[] = []
    for (const o of this.observations) {
      if (String(o[MEASURE_DIM] ?? '') !== code) continue
      if (Number(o['isCarryForward'] ?? 0) === 1) continue
      let ok = true
      for (const [dim, val] of Object.entries(dims)) {
        if (val === '' || val === null || val === undefined) continue
        const obsVal = o[dim]
        if (obsVal === undefined) continue
        const leaves = typeof val === 'string' && val.includes(',')
          ? val.split(',').filter(Boolean).flatMap((p) => this.leafSet(dim, p))
          : this.leafSet(dim, val)
        if (!matchesLeaves(leaves, obsVal)) { ok = false; break }
      }
      if (ok) out.push(Number(o['value'] ?? 0))
    }
    return out
  }

  private _val(code: string, ctx: SectionContext): number {
    // reduce-from-0 is byte-identical to the legacy `sum += …` running total.
    return roundAgg(this._matchedValues(code, ctx.dims).reduce((a, b) => a + b, 0))
  }

  // _valAt — point read at ctx.dims ⊕ at (generic coordinate, Law 1). `grain` is the
  //  additive LOD door; `rollup` aggregates the matched cells (default 'sum' = OLAP cell,
  //  byte-identical). `at` is Partial (undefined values are skipped by _matchedValues).
  private _valAt(q: Extract<StoreQuery, { type: 'valAt' }>, ctx: SectionContext): number {
    const dims = q.at ? { ...ctx.dims, ...q.at } as Record<string, DimVal> : ctx.dims
    return roundAgg(rollupValues(this._matchedValues(q.code, dims), q.rollup))
  }

  private _observe(query: ObsQuery, ctx: SectionContext): Observation[] {
    const measures = Array.isArray(query.measure) ? query.measure : [query.measure]
    const matchAll = measures.length === 1 && measures[0] === '*'

    let result = this.observations.filter((obs) => {
      if (!matchAll && !measures.includes(String(obs[MEASURE_DIM] ?? ''))) return false
      if (query.filter && !matchesFilter(obs as Record<string, DimVal>, query.filter, ctx, this.leafSet)) return false
      return true
    })

    if (query.orderBy) {
      const { field, dir } = query.orderBy
      result = [...result].sort((a, b) => {
        const av = Number(a[field] ?? 0), bv = Number(b[field] ?? 0)
        return dir === 'asc' ? av - bv : bv - av
      })
    }

    return result.map((o) => this.toCodeView(o))
  }

  queryFrame(q: StoreQuery, ctx: SectionContext): { rows: EngineRow[]; meta: ResultMeta } {
    const all   = this.querySync(q, ctx)
    const limit = (q as { limit?: number }).limit ?? Infinity
    const rows  = limit < Infinity ? all.slice(0, limit) : all
    return {
      rows,
      meta: {
        totalRows: all.length,
        truncated: all.length > rows.length,
        source:    'static',
        cacheHit:  false,
      },
    }
  }

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    switch (q.type) {
      case 'val':
        return [{ value: this._val(q.code, ctx) }]

      case 'valAt':
        return [{ value: this._valAt(q, ctx) }]

      case 'obs':
        return this._observe(
          { measure: q.measure, filter: q.filter, orderBy: q.orderBy },
          ctx,
        ) as EngineRow[]

      case 'schema': {
        const seen = new Map<string, EngineRow>()
        for (const o of this.observations) {
          const m = String(o[MEASURE_DIM] ?? '')
          if (m && !seen.has(m)) {
            seen.set(m, {
              measure: m,
              label:   o['label']  ?? m,
              color:   o['color']  ?? '',
              unit:    o['unit']   ?? '',
            })
          }
        }
        return [...seen.values()]
      }

      case 'distinct': {
        const seen = new Set<string>()
        const result: EngineRow[] = []
        for (const o of this.observations) {
          const raw = o[q.dim]
          if (raw === undefined) continue
          if (q.filter && !matchesFilter(o as Record<string, DimVal>, q.filter, ctx, this.leafSet)) continue
          const code = String(this.resolvers[q.dim]?.codeOf(raw) ?? raw)
          if (seen.has(code)) continue
          seen.add(code)
          result.push({ value: code, label: code })
        }
        return result
      }
    }
  }
}
