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
import type { EngineRow }                                              from './encoding'
import { storeVal }                                                    from './store'
import type { DataStore, Requirement, ResultMeta, StoreCaps, StoreQuery } from './store'
import { dimKey, matchesFilter, matchesLeaves, DimResolver }           from './store-filter'
import type { LeafFn }                                                 from './store-filter'
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

  constructor(
    private readonly source: DataStore,
    private readonly ttlMs: number = 5 * 60 * 1000,
  ) {
    this.caps        = {
      queryTypes: source.caps?.queryTypes ?? ['val', 'obs'],
      batching:   false,
      streaming:  false,
      sync:       true,
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
    }
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
      this._val(code, { timeMode: 'year', dims })
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
    queryTypes: ['val', 'obs', 'schema', 'distinct'],
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

  private _val(code: string, ctx: SectionContext): number {
    let sum = 0
    for (const o of this.observations) {
      if (String(o['measure'] ?? '') !== code) continue
      if (Number(o['isCarryForward'] ?? 0) === 1) continue
      let ok = true
      for (const [dim, val] of Object.entries(ctx.dims)) {
        if (val === '' || val === null || val === undefined) continue
        const obsVal = o[dim]
        if (obsVal === undefined) continue
        const leaves = typeof val === 'string' && val.includes(',')
          ? val.split(',').filter(Boolean).flatMap((p) => this.leafSet(dim, p))
          : this.leafSet(dim, val)
        if (!matchesLeaves(leaves, obsVal)) { ok = false; break }
      }
      if (ok) sum += Number(o['value'] ?? 0)
    }
    return Math.round(sum * 100) / 100
  }

  private _observe(query: ObsQuery, ctx: SectionContext): Observation[] {
    const measures = Array.isArray(query.measure) ? query.measure : [query.measure]
    const matchAll = measures.length === 1 && measures[0] === '*'

    let result = this.observations.filter((obs) => {
      if (!matchAll && !measures.includes(String(obs['measure'] ?? ''))) return false
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

      case 'obs':
        return this._observe(
          { measure: q.measure, filter: q.filter, orderBy: q.orderBy },
          ctx,
        ) as EngineRow[]

      case 'schema': {
        const seen = new Map<string, EngineRow>()
        for (const o of this.observations) {
          const m = String(o['measure'] ?? '')
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
