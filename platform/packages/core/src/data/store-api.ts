// ── ApiStore — live GET /api/stats/observations fetcher ──────────────
//
//  Async-primary DataStore (caps.sync === false).
//
//  Design:
//    - Per-query result cache keyed on stable JSON(params).
//    - Per-dataset ETag cache for conditional GET (304 Not Modified).
//    - DI mapper (mapRow) keeps engine app-agnostic: callers supply the
//      RawObsRow → Row projection; engine never touches app field names.
//    - nonTimeDims drives which ctx.dims keys go into the filter param.
//    - limit defaults to 1000; truncated flag is set when rows === limit.
//
//  Ports & Adapters: this class IS the adapter boundary — mapRow is the
//  only place raw server shapes touch engine Row types.
//
//  querySync is supported only as a warm-cache read after queryAsync has
//  populated the cache. A cold querySync call is a caller bug (caps.sync
//  === false means the caller must use queryAsync) and throws descriptively.

import type { Classifier }                                             from '../sdmx'
import type { SectionContext }                                         from '../core/context'
import { TIME_DIM, MEASURE_DIM }                                       from '../core/context'
import type { EngineRow }                                              from './encoding'
import type { DataStore, QueryResult, ResultMeta, StoreCaps, StoreQuery } from './store'
import type { MetadataPort }                                           from '../core/provenance'


// ── RawObsRow — server contract shape ───────────────────────────────

/** Raw shape returned by GET /api/stats/observations (server contract). */
export interface RawObsRow {
  time_period:   string
  dim_key:       Record<string, string>
  obs_value:     number | null
  obs_status:    string
  obs_attribute: Record<string, unknown>
}


// ── isUnsetTime — "no time bound resolved yet" guard ─────────────────
//
//  An unset time dim means "unbounded → all periods" (the observations route
//  reads absent from/to as no filter). A spurious 0 / '0' / NaN must be treated
//  as unset too: otherwise it becomes from=0&to=0, which the route's
//  sdmxTimePeriod regex rejects (400). Comma-range strings ('2015,2020') and any
//  real period are NOT unset and pass through. Single-value 0 (number or string)
//  and NaN are unset.
function isUnsetTime(timeDim: unknown): boolean {
  if (timeDim === undefined || timeDim === null || timeDim === '') return true
  if (typeof timeDim === 'number') return timeDim === 0 || Number.isNaN(timeDim)
  const s = String(timeDim).trim()
  if (s === '' || s === '0') return true
  // A bare numeric string that parses to 0/NaN is unset; non-numeric (e.g. a
  // comma-range or period code like '2015-Q1') is a real bound, kept.
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s) === 0
  return false
}


// ── ApiStore ─────────────────────────────────────────────────────────

export class ApiStore implements DataStore {
  readonly caps: StoreCaps = {
    queryTypes: ['obs', 'val'],
    batching:   false,
    streaming:  false,
    sync:       false,   // async-primary: activates useNodeRows suspend path
  }

  private readonly _cache = new Map<string, EngineRow[]>()
  private readonly _eTags = new Map<string, string>()

  /**
   * Optional provenance seam (P2-3). When supplied, renderers reach dataset-level
   * provenance via `store.metadata?.provenance(code, ctx)` — the existing
   * MetadataPort contract, not a new one. Built by the app's store-builder from
   * GET /stats/datasets/:code (preliminary / version) so no per-render fetch is
   * needed. Absent ⇒ renderers degrade gracefully (no badge).
   */
  readonly metadata?: MetadataPort

  private readonly baseUrl:     string
  private readonly datasetCode: string
  private readonly nonTimeDims: string[]
  readonly classifiers:         Record<string, Classifier>
  private readonly mapRow:      (raw: RawObsRow) => EngineRow

  constructor(
    baseUrl:      string,
    datasetCode:  string,
    nonTimeDims:  string[],
    classifiers:  Record<string, Classifier> = {},
    mapRow:       (raw: RawObsRow) => EngineRow,
    metadata?:    MetadataPort,
  ) {
    this.baseUrl     = baseUrl
    this.datasetCode = datasetCode
    this.nonTimeDims = nonTimeDims
    this.classifiers = classifiers
    this.mapRow      = mapRow
    this.metadata    = metadata
  }

  // ── queryAsync — primary async path ──────────────────────────────

  async queryAsync(q: StoreQuery, ctx: SectionContext): Promise<QueryResult<EngineRow>> {
    const params   = this.toObsParams(q, ctx)
    const cacheKey = JSON.stringify(params)

    // Warm read — return cached result immediately
    const cached = this._cache.get(cacheKey)
    if (cached) {
      return {
        state: 'done',
        data:  cached,
        meta:  { totalRows: cached.length, truncated: false, source: 'api', cacheHit: true },
      }
    }

    // Conditional GET: attach If-None-Match when we have a stored ETag
    const headers: Record<string, string> = {}
    const storedETag = this._eTags.get(this.datasetCode)
    if (storedETag) headers['If-None-Match'] = storedETag

    let res: Response
    try {
      res = await fetch(
        `${this.baseUrl}/api/stats/observations?${new URLSearchParams(params)}`,
        { headers },
      )
    } catch (err) {
      return { state: 'error', data: [], error: String(err) }
    }

    // 304 Not Modified — ETag matched; serve from existing cache entry
    if (res.status === 304) {
      const stale = this._cache.get(cacheKey) ?? ([] as EngineRow[])
      return {
        state: 'done',
        data:  stale,
        meta:  { totalRows: stale.length, truncated: false, source: 'api', cacheHit: true },
      }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { state: 'error', data: [], error: `HTTP ${res.status}: ${body}` }
    }

    // Store fresh ETag for future conditional requests
    const etag = res.headers.get('ETag')
    if (etag) this._eTags.set(this.datasetCode, etag)

    // Parse, map, order, cache
    const json    = await res.json() as { data: RawObsRow[] }
    const limit   = Number(params['limit'] ?? 1000)
    const rows    = json.data.map(raw => this.mapRow(raw))
    const ordered = this.applyOrderBy(rows, q)

    this._cache.set(cacheKey, ordered)
    return {
      state: 'done',
      data:  ordered,
      meta:  {
        totalRows: ordered.length,
        truncated: ordered.length === limit,
        source:    'api',
        cacheHit:  false,
      },
    }
  }

  // ── queryFrame — cache-read with truncation meta (P2-1) ──────────
  //
  //  Cache-read-only: if the cache is warm, return rows + meta.
  //  If cold, return empty + truncated:false — queryAsync must be called
  //  first for live stores (caps.sync === false).

  queryFrame(q: StoreQuery, ctx: SectionContext): { rows: EngineRow[]; meta: ResultMeta } {
    const cacheKey = JSON.stringify(this.toObsParams(q, ctx))
    const cached   = this._cache.get(cacheKey)
    if (cached) {
      const limit = (q as { limit?: number }).limit ?? 1000
      return {
        rows: cached,
        meta: {
          totalRows: cached.length,
          truncated: cached.length === limit,
          source:    'api',
          cacheHit:  true,
        },
      }
    }
    return {
      rows: [],
      meta: { totalRows: 0, truncated: false, source: 'api', cacheHit: false },
    }
  }

  // ── querySync — warm-cache fast-lane only ─────────────────────────

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    const cacheKey = JSON.stringify(this.toObsParams(q, ctx))
    const cached   = this._cache.get(cacheKey)
    if (cached) return cached
    throw new Error(
      `ApiStore.querySync called cold (cache miss). ` +
      `This store has caps.sync=false — use queryAsync. ` +
      `cacheKey=${cacheKey.slice(0, 80)}`,
    )
  }

  // ── toObsParams — StoreQuery → URL param record ───────────────────
  //
  //  dataset — this.datasetCode
  //  from/to — time bounds from ctx.dims['time'] (single year → both equal)
  //  filter  — JSON of non-time dim values merged from ctx.dims + q.filter
  //  limit   — q.limit if present, else 1000

  private toObsParams(q: StoreQuery, ctx: SectionContext): Record<string, string> {
    const params: Record<string, string> = { dataset: this.datasetCode }

    // Time bounds. An UNSET time dim means "unbounded → all periods": the
    // observations route reads absent from/to as no filter. We must omit BOTH
    // bounds when time is unset — crucially treating 0 / '0' / NaN as unset too
    // (a spurious 0 would become from=0&to=0 → the sdmxTimePeriod regex 400s).
    // Defense-in-depth pair with autoParse's no-value sentinel (filter-eval.ts):
    // an unresolved year-select never poisons the query with a fake period 0.
    const timeDim = ctx.dims[TIME_DIM]
    if (!isUnsetTime(timeDim)) {
      const timeStr = String(timeDim)
      if (timeStr.includes(',')) {
        const [from, to] = timeStr.split(',')
        params['from'] = from.trim()
        params['to']   = to.trim()
      } else {
        params['from'] = timeStr
        params['to']   = timeStr
      }
    }

    // Non-time dim filters: ctx.dims baseline, q.filter overrides. The canonical
    // wire shape (observations route · dim-filter.ts) is a JSON object whose value
    // per dim is EITHER a scalar (AND containment) OR a JSON ARRAY (OR within the
    // dim — the SDMX multi-value key selection, e.g. a cross-region panel sending
    // geo ∈ {R2,R3}). We preserve arrays AS arrays here (no comma-join collapse):
    // the route reads `["R2","R3"]` as the OR-set, which `,`-joining would have
    // flattened into the single literal value "R2,R3" (an unmatchable code).
    const filterRecord: Record<string, string | string[]> = {}

    for (const dim of this.nonTimeDims) {
      const ctxVal = ctx.dims[dim]
      if (ctxVal !== undefined && ctxVal !== '' && ctxVal !== null) {
        filterRecord[dim] = String(ctxVal)
      }
    }

    // A `val` query is an OLAP point-read for ONE measure: its `code` IS the
    // measure-dim selection (ExternalStore._val matches obs[MEASURE_DIM] === code).
    // The async store MUST pin it on the wire — otherwise the server returns every
    // measure in the (time × dims) slice and the caller's storeVal reads rows[0],
    // collapsing every per-measure KPI onto whichever measure sorts first.
    // This pin is the val SSOT (MEASURE_DIM); it wins over any inherited ctx value.
    if (q.type === 'val') {
      filterRecord[MEASURE_DIM] = q.code
    }

    if (q.type === 'obs' && q.filter) {
      for (const [dim, fv] of Object.entries(q.filter)) {
        if (dim === TIME_DIM || fv === undefined || fv === null) continue
        if (typeof fv === 'object' && !Array.isArray(fv) && '$ctx' in (fv as object)) {
          const ref = (fv as { $ctx: string }).$ctx
          const val = ctx.dims[ref]
          if (val !== undefined && val !== '' && val !== null) filterRecord[dim] = String(val)
        } else if (Array.isArray(fv)) {
          // Multi-value selection → keep the array (OR within the dim). Empty arrays
          // are dropped: an empty selection scopes nothing and would 0-match every row.
          const vals = (fv as Array<string | number>).map((v) => String(v))
          if (vals.length > 0) filterRecord[dim] = vals
        } else {
          filterRecord[dim] = String(fv)
        }
      }
    }

    if (Object.keys(filterRecord).length > 0) {
      params['filter'] = JSON.stringify(filterRecord)
    }

    params['limit'] = String((q as { limit?: number }).limit ?? 1000)
    return params
  }

  // ── applyOrderBy — client-side sort (mirrors ExternalStore) ──────

  private applyOrderBy(rows: EngineRow[], q: StoreQuery): EngineRow[] {
    if (q.type !== 'obs' || !q.orderBy) return rows
    const { field, dir } = q.orderBy
    return [...rows].sort((a, b) => {
      const av = Number((a as Record<string, unknown>)[field] ?? 0)
      const bv = Number((b as Record<string, unknown>)[field] ?? 0)
      return dir === 'asc' ? av - bv : bv - av
    })
  }
}
