// ── Store Implementations ──────────────────────────────────────────────
//
//  Concrete DataStore implementations:
//    ApiStore      — REST API + local cache (production)
//    CachedStore   — memoization wrapper over any DataStore
//    ExternalStore — in-memory Observation[] (config-file datasets)
//
//  Filter-matching utilities and DimResolver live in store-filter.ts.
//  All three classes are re-exported from @geostat/engine.
//

import type { Classifier, DimVal, DisplayMap, ObsQuery, Observation }  from '../sdmx'
import type { SectionContext }                                          from '../core/context'
import type { EngineRow }                                              from './encoding'
import { storeVal }                                                    from './store'
import type { DataStore, Requirement, StoreCaps, StoreQuery }          from './store'
import { dimKey, matchesFilter, matchesLeaves, DimResolver }           from './store-filter'
import type { LeafFn }                                                 from './store-filter'


// ── ApiStore — REST API + local cache ────────────────────────────────

export class ApiStore implements DataStore {
  readonly caps: StoreCaps = {
    queryTypes: ['val', 'obs'],
    batching:   true,
    streaming:  false,
  }

  private cache = new Map<string, number>()

  constructor(private baseUrl: string) {}

  private _val(code: string, ctx: SectionContext): number {
    return this.cache.get(`${code}:${dimKey(ctx)}`) ?? 0
  }

  private _observe(query: ObsQuery, ctx: SectionContext): Observation[] {
    const measures = Array.isArray(query.measure) ? query.measure : [query.measure]
    const result: Observation[] = []

    for (const [key, rawValue] of this.cache.entries()) {
      const colonIdx = key.indexOf(':')
      const code     = key.slice(0, colonIdx)
      if (!measures.includes(code)) continue

      const dimPairs = key.slice(colonIdx + 1).split(',')
      const obs: Record<string, DimVal> = { measure: code, value: rawValue }
      for (const pair of dimPairs) {
        const eq = pair.indexOf('=')
        if (eq > 0) obs[pair.slice(0, eq)] = pair.slice(eq + 1)
      }
      if (obs['time']) obs['time'] = Number(obs['time'])

      if (query.filter && !matchesFilter(obs, query.filter, ctx)) continue
      result.push(obs as Observation)
    }

    if (query.orderBy) {
      const { field, dir } = query.orderBy
      result.sort((a, b) => {
        const av = Number(a[field] ?? 0), bv = Number(b[field] ?? 0)
        return dir === 'asc' ? av - bv : bv - av
      })
    }

    return result
  }

  query(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    switch (q.type) {
      case 'val': return [{ value: this._val(q.code, ctx) }]
      case 'obs': return this._observe({ measure: q.measure, filter: q.filter, orderBy: q.orderBy }, ctx) as EngineRow[]
      default:    return []
    }
  }

  async prefetch(reqs: Requirement[]): Promise<void> {
    if (reqs.length === 0) return

    const key = (r: Requirement) =>
      `${r.code}:${Object.entries(r.dims).sort().map(([k, v]) => `${k}=${v}`).join(',')}`
    const unique = [...new Map(reqs.map((r) => [key(r), r])).values()]

    const res = await fetch(`${this.baseUrl}/indicators/values`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requests: unique }),
    })

    if (!res.ok) throw new Error(`ApiStore: ${res.status} ${res.statusText}`)

    const data: Record<string, number> = await res.json()
    for (const [k, value] of Object.entries(data)) this.cache.set(k, value)
  }

  invalidate(code?: string): void {
    if (code) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${code}:`)) this.cache.delete(key)
      }
    } else {
      this.cache.clear()
    }
  }
}


// ── CachedStore — memoization wrapper over any DataStore ──────────────

export class CachedStore implements DataStore {
  readonly caps:  StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>

  private valCache = new Map<string, number>()

  constructor(private source: DataStore) {
    this.caps        = {
      queryTypes: source.caps?.queryTypes ?? ['val', 'obs'],
      batching:   false,
      streaming:  false,
    }
    this.classifiers = source.classifiers
    this.display     = source.display
  }

  private _val(code: string, ctx: SectionContext): number {
    const key = `${code}:${dimKey(ctx)}`
    if (!this.valCache.has(key)) {
      this.valCache.set(key, storeVal(this.source, code, ctx))
    }
    return this.valCache.get(key)!
  }

  query(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    switch (q.type) {
      case 'val':      return [{ value: this._val(q.code, ctx) }]
      case 'obs':
      case 'schema':
      case 'distinct': return this.source.query(q, ctx)
    }
  }

  warm(reqs: Requirement[]): void {
    for (const { code, dims } of reqs) {
      this._val(code, { timeMode: 'year', dims })
    }
  }

  invalidate(code?: string): void {
    if (code) {
      for (const key of this.valCache.keys()) {
        if (key.startsWith(`${code}:`)) this.valCache.delete(key)
      }
    } else {
      this.valCache.clear()
    }
  }
}


// ── ExternalStore — wraps any Observation[] (config-file datasets) ────
//
//  query({type:'val'}, ctx) — OLAP cell sum: matches measure + ALL dims in
//    ctx.dims, sums obs_value across matching rows.
//    isCarryForward observations excluded (SNA T-account dedup).
//
//  query({type:'obs'}, ctx) — multi-dim query with CtxRef resolution.
//  query({type:'schema'}, ctx) — unique (measure, label, color, unit) tuples.
//  query({type:'distinct', dim}, ctx) — unique dim values, optionally filtered.

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

  query(q: StoreQuery, ctx: SectionContext): EngineRow[] {
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
