import type { Classifier, ClassifierEntry, CtxRef, DimVal, DisplayMap, FilterValue, NeCtxRef, NeRef, Observation, ObsQuery } from '../sdmx'
import type { SectionContext }                                                                   from '../core/context'
import type { EngineRow }                                                                        from './encoding'

// re-export so callers can use ExternalStore without touching store internals
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


// ── Filter helpers (used by ExternalStore / ApiStore query implementations) ──

type LeafFn = (dim: string, val: DimVal) => DimVal[]

function matchesLeaves(leaves: DimVal[], obsVal: DimVal | undefined): boolean {
  if (obsVal === undefined) return false
  for (const l of leaves) if (String(l) === String(obsVal)) return true
  return false
}

// Returns null = wildcard (skip this dimension filter).
function resolveFilter(fv: FilterValue, ctx: SectionContext, expand?: LeafFn, dim?: string): DimVal[] | null {
  if (Array.isArray(fv)) return fv as DimVal[]
  if (typeof fv === 'object' && '$ctx' in (fv as object)) {
    const val = ctx.dims[(fv as CtxRef).$ctx]
    if (val === '' || val === null || val === undefined) return null          // wildcard
    if (typeof val === 'string' && val.includes(',')) {
      const parts = val.split(',').filter(Boolean) as DimVal[]
      return expand && dim ? parts.flatMap((p) => expand(dim, p)) : parts
    }
    return expand && dim ? expand(dim, val) : [val as DimVal]
  }
  return [fv as DimVal]
}

function matchesFilter(
  obs: Record<string, DimVal>,
  filter: Partial<Record<string, FilterValue>>,
  ctx: SectionContext,
  expand?: LeafFn,
): boolean {
  for (const [dim, fv] of Object.entries(filter)) {
    if (fv === undefined) continue
    if (typeof fv === 'object' && !Array.isArray(fv) && '$ne' in (fv as object)) {
      const ne = fv as NeRef | NeCtxRef
      if (String(obs[dim]) === String(ne.$ne)) return false
      if ('$ctx' in ne) {
        const ctxVal = ctx.dims[(ne as NeCtxRef).$ctx]
        if (ctxVal !== '' && ctxVal !== null && ctxVal !== undefined) {
          const leaves = expand ? expand(dim, ctxVal) : [ctxVal]
          if (!matchesLeaves(leaves, obs[dim])) return false
        }
      }
      continue
    }
    const allowed = resolveFilter(fv, ctx, expand, dim)
    if (allowed === null) continue
    if (!matchesLeaves(allowed, obs[dim])) return false
  }
  return true
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

// ── Dim key helper ────────────────────────────────────────────────────

function dimKey(ctx: SectionContext): string {
  return Object.entries(ctx.dims)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
}


// ── 1. StaticStore — empty default ────────────────────────────────────

export const staticStore: DataStore = {
  query():     EngineRow[] { return [] },
  caps: { queryTypes: [], batching: false, streaming: false },
}


// ── 2. ApiStore — REST API + local cache ──────────────────────────────

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


// ── 3. CachedStore — memoization wrapper over any DataStore ───────────

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


// ── 4. DimResolver — per-dim code↔id translator with hierarchy ─────────
//
//  Pure structural service built from a Classifier. Handles:
//    - code → id (for query-time input translation)
//    - id   → code (for observe() output translation)
//    - code → descendant ids (rollup expansion)
//
//  Classifier keys are stringified ids; parents are ids (stringified).
//  Kimball surrogate-key semantics: facts reference ids; API boundary sees codes.

class DimResolver {
  private readonly codeToId = new Map<string, DimVal>()
  private readonly idToCode = new Map<string, DimVal>()
  private readonly descIds  = new Map<string, string[]>()

  constructor(classifier: Classifier) {
    const pairs: Array<[string, ClassifierEntry]> = Array.isArray(classifier)
      ? classifier.map(e => [String(e.code), e])
      : Object.entries(classifier)

    const children = new Map<string, string[]>()
    for (const [id, entry] of pairs) {
      this.codeToId.set(String(entry.code), this.castIdLike(id))
      this.idToCode.set(id, entry.code)
      if (entry.parent !== undefined) {
        const p = String(entry.parent)
        const arr = children.get(p) ?? []
        arr.push(id)
        children.set(p, arr)
      }
    }
    const walk = (id: string, acc: Set<string>): void => {
      if (acc.has(id)) return
      acc.add(id)
      for (const c of children.get(id) ?? []) walk(c, acc)
    }
    for (const [id] of pairs) {
      const acc = new Set<string>()
      walk(id, acc)
      this.descIds.set(id, [...acc])
    }
  }

  private castIdLike(id: string): DimVal {
    if (/^-?\d+$/.test(id)) return Number(id)
    return id
  }

  leafIds(code: DimVal): DimVal[] {
    const id = this.codeToId.get(String(code))
    if (id === undefined) return [code]
    const desc = this.descIds.get(String(id))
    if (!desc) return [id]
    return desc.map((d) => this.castIdLike(d))
  }

  codeOf(id: DimVal): DimVal {
    return this.idToCode.get(String(id)) ?? id
  }
}


// ── 5. ExternalStore — wraps any Observation[] (external datasets) ────
//
//  query({type:'val'}, ctx) — OLAP cell sum: matches measure + ALL dims in
//    ctx.dims, sums obs_value across matching rows. Standard OLAP slice.
//    isCarryForward observations excluded (SNA T-account dedup).
//
//  query({type:'obs'}, ctx) — multi-dim query with CtxRef resolution.
//
//  query({type:'schema'}, ctx) — unique (measure, label, color, unit) tuples.
//    Constructor palette: browsable indicator catalog.
//
//  query({type:'distinct', dim}, ctx) — unique dim values, optionally filtered.
//    Filter dropdowns: unique values without full obs scan.

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

  private leafSet = (dim: string, val: DimVal): DimVal[] => {
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