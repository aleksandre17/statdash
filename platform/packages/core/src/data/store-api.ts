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

import type { Classifier, DisplayMap }                                 from '../sdmx'
import type { SectionContext }                                         from '../core/context'
import { TIME_DIM, MEASURE_DIM }                                       from '../core/context'
import { isUnsetTime }                                                 from '../core/time-dimension'
import type { EngineRow }                                              from './encoding'
import type { DataStore, QueryResult, ResultMeta, StoreCaps, StoreQuery } from './store'
import { matchesFilter } from './store-filter'
import type { DimVal, FilterValue } from '../sdmx'
import type { MetadataPort }                                           from '../core/provenance'


// ── RawObsRow — server contract shape ───────────────────────────────

/**
 * Raw shape returned by GET /api/stats/observations (server contract).
 *
 * `obs_value` is `string | number | null`: pg serializes a `numeric` column as
 * a STRING to preserve precision, so the wire carries "42367.21"; a suppressed
 * cell is `null`. The injected `mapRow` (the app's `fromStatsObsRow`) coerces it
 * to a real `number | null` at the adapter seam — the engine never does value
 * math on a raw row, so it stays type-faithful to the wire here and lets the ACL
 * own the coercion (Ports & Adapters).
 */
export interface RawObsRow {
  time_period:   string
  dim_key:       Record<string, string>
  obs_value:     string | number | null
  obs_status:    string
  obs_attribute: Record<string, unknown>
}


// isUnsetTime is the SSOT predicate in core/time-dimension.ts — toObsParams and
// extractRequirements both import it so the warm/read-key invariant (GAP 4) rests
// on ONE definition, never two copies that can drift.


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
  /**
   * Display overlay (GAP 5) — the UI/presentation channel `resolveDisplayRef`
   * joins at consumer-facing `{ $d: '<dim>' }` refs (id → label/color/order).
   * Mirrors `classifiers` (structural). The store-builder constructs it from the
   * SAME classifier rows it already fetched (no second endpoint, no duplication),
   * keyed by `code` to match resolveDisplayRef's join over array-form classifiers.
   * Absent ⇒ a `$d` ref returns `{ code }` only (the pre-GAP-5 behaviour).
   */
  readonly display:             Record<string, DisplayMap>
  private readonly mapRow:      (raw: RawObsRow) => EngineRow

  constructor(
    baseUrl:      string,
    datasetCode:  string,
    nonTimeDims:  string[],
    classifiers:  Record<string, Classifier> = {},
    mapRow:       (raw: RawObsRow) => EngineRow,
    metadata?:    MetadataPort,
    display:      Record<string, DisplayMap> = {},
  ) {
    this.baseUrl     = baseUrl
    this.datasetCode = datasetCode
    this.nonTimeDims = nonTimeDims
    this.classifiers = classifiers
    this.mapRow      = mapRow
    this.metadata    = metadata
    this.display     = display
  }

  // ── queryAsync — primary async path ──────────────────────────────

  async queryAsync(q: StoreQuery, ctx: SectionContext): Promise<QueryResult<EngineRow>> {
    const params   = this.toObsParams(q, ctx)
    const cacheKey = this.cacheKeyFor(q, ctx)

    // Warm read — return cached result immediately
    const cached = this._cache.get(cacheKey)
    if (cached) {
      return {
        state: 'done',
        data:  cached,
        meta:  { totalRows: cached.length, truncated: false, source: 'api', cacheHit: true },
      }
    }

    // Conditional GET: send If-None-Match ONLY when THIS slice is already cached.
    // The ETag is dataset-level, but each (from,to,filter) slice is its OWN cache
    // entry. A 304 = "your cached copy of THIS resource is fresh" — usable only if we
    // HOLD that slice. Sending it for a never-fetched slice invites a 304 whose branch
    // returns [] WITHOUT caching → the post-warm querySync(val, thatSlice) cold-throws
    // (the range/dynamics kpi-strip crash: first slice 200s, later slices 304 to empty).
    const headers: Record<string, string> = {}
    const storedETag = this._eTags.get(this.datasetCode)
    if (storedETag && this._cache.has(cacheKey)) headers['If-None-Match'] = storedETag

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

    // Parse, map, client-filter (the wire-inexpressible operators), order, cache.
    const json    = await res.json() as { data: RawObsRow[] }
    const limit   = Number(params['limit'] ?? 1000)
    const rows    = json.data.map(raw => this.mapRow(raw))
    const filtered = this.applyClientFilter(rows, q, ctx)
    const ordered = this.applyOrderBy(filtered, q)

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
    const cacheKey = this.cacheKeyFor(q, ctx)
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
    const cacheKey = this.cacheKeyFor(q, ctx)
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
        const isObj = typeof fv === 'object' && !Array.isArray(fv)
        if (isObj && '$ne' in (fv as object)) {
          // `$ne` (exclusion) is a CLIENT-SIDE operator: the observations route's
          // filter schema accepts only scalars and arrays-of-scalars (dim-filter.ts
          // expresses `@>` containment + `= ANY`, never `<>`), so it would REJECT an
          // object value — and the old `else` branch String()-ified it to the
          // unmatchable literal "[object Object]" (the empty regional map). We must
          // NOT put `$ne` on the wire. If the ref ALSO carries a `$ctx` positive
          // scope, that scalar IS wire-expressible — send it (narrow the fetch); the
          // `$ne` exclusion is then applied to the returned rows by applyClientFilter
          // (the SSOT matchesFilter predicate). A pure `{$ne}` sends NO dim filter
          // (fetch the broader set) and excludes client-side.
          const ne = fv as { $ne: unknown; $ctx?: string }
          if (ne.$ctx !== undefined) {
            const val = ctx.dims[ne.$ctx]
            if (val !== undefined && val !== '' && val !== null) filterRecord[dim] = String(val)
          }
        } else if (isObj && '$ctx' in (fv as object)) {
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
      // Canonical (key-sorted) serialization. The filter object is assembled from
      // multiple sources in a source-dependent ORDER (nonTimeDims loop, then the val
      // measure pin, then q.filter) — so two reads of the SAME logical slice can emit
      // the same dims in a DIFFERENT insertion order. Since this string is BOTH the
      // wire param AND (via cacheKeyFor) the cache identity, an order-unstable JSON
      // would make the warm key and the synchronous read key diverge for one slice →
      // querySync cold-throw (the range/dynamics kpi-strip crash). Sorting keys makes
      // the key insertion-order-invariant (SSOT for cache identity) and the wire
      // request deterministic. Values (incl. array OR-sets) are untouched.
      const sorted: Record<string, string | string[]> = {}
      for (const k of Object.keys(filterRecord).sort()) sorted[k] = filterRecord[k]
      params['filter'] = JSON.stringify(sorted)
    }

    params['limit'] = String((q as { limit?: number }).limit ?? 1000)
    return params
  }

  // ── cacheKeyFor — cache identity = wire params + client-side $ne discriminant ──
  //
  //  The cached entry holds the rows AFTER applyClientFilter, so the cache key MUST
  //  reflect the `$ne` exclusion — otherwise two queries that resolve to the SAME
  //  wire slice but DIFFERENT exclusions (`geo:{$ne:'_T'}` vs `geo:{$ne:'R2'}`)
  //  collide and the second reads the first's filtered rows (the dropped-pin class
  //  of bug). `$ne` never reaches the wire params (the route can't express it), so
  //  we fold it into the key here. A query with no `$ne` yields exactly the wire
  //  params key (byte-identical to the pre-fix key — no cache churn).
  private cacheKeyFor(q: StoreQuery, ctx: SectionContext): string {
    const params = this.toObsParams(q, ctx)
    const ne: Record<string, unknown> = {}
    if (q.type === 'obs' && q.filter) {
      for (const [dim, fv] of Object.entries(q.filter)) {
        if (fv !== null && typeof fv === 'object' && !Array.isArray(fv) && '$ne' in (fv as object)) {
          const r = fv as { $ne: unknown; $ctx?: string }
          // Resolve a $ctx-scoped exclusion to its concrete value so the key reflects
          // the ACTUAL excluded code, not the unresolved ref (mirrors matchesFilter).
          ne[dim] = r.$ctx !== undefined ? { $ne: r.$ne, ctx: ctx.dims[r.$ctx] } : { $ne: r.$ne }
        }
      }
    }
    return Object.keys(ne).length > 0
      ? JSON.stringify({ params, ne })
      : JSON.stringify(params)
  }

  // ── applyClientFilter — exclusion ($ne) the wire route can't express ─────
  //
  //  The observations route scopes via containment (@>) + array membership
  //  (= ANY) only — NO `<>`. So a `$ne` (exclusion) filter is resolved HERE,
  //  client-side, over the returned rows using the SSOT predicate matchesFilter
  //  (store-filter.ts — the SAME predicate ExternalStore uses, so static and live
  //  stores honour `$ne` identically). Only `$ne`-bearing dims are post-filtered;
  //  scalar/array dims were already scoped server-side, so this is a cheap pass
  //  that re-checks just the exclusion (matchesFilter on a scalar that already
  //  matched is a no-op). A query with no `$ne` returns rows untouched.
  //
  private applyClientFilter(rows: EngineRow[], q: StoreQuery, ctx: SectionContext): EngineRow[] {
    if (q.type !== 'obs' || !q.filter) return rows
    const neFilter: Partial<Record<string, FilterValue>> = {}
    for (const [dim, fv] of Object.entries(q.filter)) {
      if (fv !== null && typeof fv === 'object' && !Array.isArray(fv) && '$ne' in (fv as object)) {
        neFilter[dim] = fv as FilterValue
      }
    }
    if (Object.keys(neFilter).length === 0) return rows
    return rows.filter((row) => matchesFilter(row as Record<string, DimVal>, neFilter, ctx))
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
