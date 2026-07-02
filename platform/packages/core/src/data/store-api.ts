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
import { TIME_DIM }                                                    from '../core/context'
import { isUnsetTime }                                                 from '../core/time-dimension'
import type { EngineRow }                                              from './encoding'
import type { DataStore, QueryResult, ResultMeta, StoreCaps, StoreQuery } from './store'
import { matchesFilter, buildObsFilterParam } from './store-filter'
import { resolveCachedPointRead } from './store-api-pointread'
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

  // Per-slice cache entry. `expiresAt` drives freshness: a FRESH entry (now <
  // expiresAt) is served without a network round-trip; a STALE-but-present entry
  // (TTL elapsed) is re-validated with a conditional GET (If-None-Match: dataset
  // ETag) — a 304 reuses the held rows + refreshes the TTL, a 200 replaces them.
  // The dataset-level ETag is the correct validator for ANY slice's freshness: a
  // dataset-version bump invalidates every slice at once (server returns a new
  // ETag ⇒ 200 on the next revalidation of each slice).
  // `params` are the wire params the slice was fetched under (dataset, from/to,
  // filter). Retained so a point read (`val`/`valAt`) that misses on its exact key
  // can find an already-cached SUPERSET slice (a slice whose params constrain a
  // superset of the read's rows) and resolve the value from it by filter+sum — the
  // SAME matching ExternalStore uses (matchedValues). See resolvePointRead below.
  private readonly _cache = new Map<string, { rows: EngineRow[]; expiresAt: number; params: Record<string, string> }>()
  private readonly _eTags = new Map<string, string>()
  private readonly ttlMs: number

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
    ttlMs:        number = 5 * 60 * 1000,
  ) {
    this.baseUrl     = baseUrl
    this.datasetCode = datasetCode
    this.nonTimeDims = nonTimeDims
    this.classifiers = classifiers
    this.mapRow      = mapRow
    this.metadata    = metadata
    this.display     = display
    this.ttlMs       = ttlMs
  }

  // ── queryAsync — primary async path ──────────────────────────────

  async queryAsync(q: StoreQuery, ctx: SectionContext): Promise<QueryResult<EngineRow>> {
    const params   = this.toObsParams(q, ctx)
    const cacheKey = this.cacheKeyFor(q, ctx)

    // ── Freshness gate (conditional-GET / 304 revalidation) ───────────────────
    //
    // Three cases for the cached slice at `cacheKey`:
    //   FRESH (now < expiresAt)        → serve immediately, no network round-trip.
    //   STALE (entry present, expired) → re-validate with a CONDITIONAL GET
    //                                    (If-None-Match: <dataset ETag>). On 304
    //                                    the held rows are still current → reuse +
    //                                    refresh TTL (no re-download). On 200 the
    //                                    dataset moved → replace.
    //   MISS (no entry)                → nothing to validate → UNCONDITIONAL GET.
    //                                    Sending the ETag here would invite a
    //                                    304-to-empty for a never-held slice (the
    //                                    range/dynamics kpi-strip crash), so the
    //                                    conditional header is omitted on a miss.
    //
    // The ETag is dataset-level, which is the CORRECT validator for any slice: a
    // dataset-version bump changes the ETag, so the next revalidation of EVERY
    // stale slice 200s (replaces) rather than 304s (reuses).
    const cached = this._cache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return {
        state: 'done',
        data:  cached.rows,
        meta:  { totalRows: cached.rows.length, truncated: false, source: 'api', cacheHit: true },
      }
    }

    // STALE-but-present slice → conditional revalidation. The conditional header is
    // sent ONLY when we already HOLD the slice (so a 304 has rows to serve); a true
    // MISS stays unconditional.
    const headers: Record<string, string> = {}
    const storedETag = this._eTags.get(this.datasetCode)
    if (storedETag && cached) headers['If-None-Match'] = storedETag

    let res: Response
    try {
      res = await fetch(
        `${this.baseUrl}/api/stats/observations?${new URLSearchParams(params)}`,
        { headers },
      )
    } catch (err) {
      return { state: 'error', data: [], error: String(err) }
    }

    // 304 Not Modified — the held slice is still current. Reuse it and refresh its
    // TTL (a re-validated entry is fresh again). Reachable ONLY for a stale slice we
    // hold (the conditional header was sent because `cached` was present).
    if (res.status === 304 && cached) {
      cached.expiresAt = Date.now() + this.ttlMs
      return {
        state: 'done',
        data:  cached.rows,
        meta:  { totalRows: cached.rows.length, truncated: false, source: 'api', cacheHit: true },
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

    this._cache.set(cacheKey, { rows: ordered, expiresAt: Date.now() + this.ttlMs, params })
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
        rows: cached.rows,
        meta: {
          totalRows: cached.rows.length,
          truncated: cached.rows.length === limit,
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

  // ── querySync — warm-cache fast-lane ──────────────────────────────
  //
  //  A held slice resolves synchronously even when TTL-stale: querySync is the
  //  post-resume read after queryAsync warmed the cache. Freshness re-validation is
  //  queryAsync's job (network) — querySync must never throw on a slice we hold.
  //
  //  `val`/`valAt` are OLAP POINT READS, resolved by matching+summing over the
  //  cached rows (resolveCachedPointRead) rather than returned raw — because the
  //  read's per-coordinate key (e.g. the enumerated `time:yearᵢ` of a timeseries/
  //  growth `'all'`) DIFFERS from the unbounded slice C2 warmed (time stripped), so
  //  the exact key misses. We resolve it from that already-cached SUPERSET slice with
  //  the SAME matcher ExternalStore uses, so live and in-memory stores agree.
  //  `obs`/`schema`/`distinct` stay exact-key reads (raw rows) and cold-throw on miss.

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    if (q.type === 'val' || q.type === 'valAt') {
      const value = resolveCachedPointRead(
        this._cache, q, ctx, this.cacheKeyFor(q, ctx), this.toObsParams(q, ctx),
      )
      if (value === undefined) throw new Error(this.coldError(q, ctx))
      return [{ value }]
    }
    const cacheKey = this.cacheKeyFor(q, ctx)
    const cached   = this._cache.get(cacheKey)
    if (cached) return cached.rows
    throw new Error(this.coldError(q, ctx))
  }

  private coldError(q: StoreQuery, ctx: SectionContext): string {
    return (
      `ApiStore.querySync called cold (cache miss). ` +
      `This store has caps.sync=false — use queryAsync. ` +
      `cacheKey=${this.cacheKeyFor(q, ctx).slice(0, 80)}`
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

    // Non-time dim filters: ctx.dims baseline merged with q.filter overrides,
    // key-sorted for a deterministic wire param + insertion-order-invariant cache
    // identity. The full precedence + `$ne` client-side semantics live in the one
    // helper (buildObsFilterParam, store-filter.ts) shared as the SSOT.
    const filter = buildObsFilterParam(q, ctx, this.nonTimeDims)
    if (filter !== undefined) params['filter'] = filter

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
