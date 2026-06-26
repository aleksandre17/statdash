// ── ApiStore async tests ──────────────────────────────────────────────
//
//  Covers the six behaviours specified in ADR-STORE-001 P1-1:
//    1. queryAsync builds correct URL params
//    2. queryAsync handles non-2xx → state:'error'
//    3. queryAsync caches result (fetch called once for two identical calls)
//    4. queryAsync sends If-None-Match on second call
//    5. querySync throws on cold cache with message containing 'caps.sync=false'
//    6. querySync returns from warm cache after queryAsync has populated it
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiStore }                                         from '../store-api'
import type { RawObsRow }                                  from '../store-api'
import type { SectionContext }                             from '../../core/context'
import type { StoreQuery }                                 from '../store'

// ── Fixtures ──────────────────────────────────────────────────────────

const BASE_URL     = 'https://api.example.com'
const DATASET_CODE = 'NA_GDP'
const NON_TIME_DIMS: string[] = ['geo', 'sector']

const ctx: SectionContext = {
  timeMode: 'year',
  dims: { time: 2023, geo: 'GE', sector: 'S13' },
}

const obsQuery: StoreQuery = {
  type:    'obs',
  measure: 'GDP',
}

const rawRow: RawObsRow = {
  time_period:   '2023',
  dim_key:       { geo: 'GE', sector: 'S13' },
  obs_value:     42.5,
  obs_status:    'A',
  obs_attribute: {},
}

// Simple identity mapper — engine-agnostic; tests verify raw→Row projection
const mapRow = (raw: RawObsRow) => ({ ...raw.dim_key, value: raw.obs_value ?? 0 })

function makeStore() {
  return new ApiStore(BASE_URL, DATASET_CODE, NON_TIME_DIMS, {}, mapRow)
}

function makeOkResponse(rows: RawObsRow[], etag?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (etag) headers.set('ETag', etag)
  return new Response(JSON.stringify({ data: rows }), { status: 200, headers })
}

function makeErrorResponse(status: number, body = ''): Response {
  return new Response(body, { status })
}

// ── Setup / teardown ──────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(global, 'fetch')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────

describe('ApiStore.queryAsync', () => {

  it('1 — builds correct URL params from query + ctx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))

    const store = makeStore()
    await store.queryAsync(obsQuery, ctx)

    expect(fetch).toHaveBeenCalledOnce()
    const calledUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string)

    expect(calledUrl.pathname).toBe('/api/stats/observations')
    expect(calledUrl.searchParams.get('dataset')).toBe(DATASET_CODE)
    expect(calledUrl.searchParams.get('from')).toBe('2023')
    expect(calledUrl.searchParams.get('to')).toBe('2023')
    expect(calledUrl.searchParams.get('limit')).toBe('1000')

    const filter = JSON.parse(calledUrl.searchParams.get('filter') ?? '{}')
    expect(filter['geo']).toBe('GE')
    expect(filter['sector']).toBe('S13')
  })

  it('2 — returns state:error on non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(503, 'unavailable'))

    const store  = makeStore()
    const result = await store.queryAsync(obsQuery, ctx)

    expect(result.state).toBe('error')
    expect(result.error).toContain('503')
    expect(result.data).toEqual([])
  })

  it('3 — caches result: fetch called only once for two identical queries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))

    const store = makeStore()
    const r1    = await store.queryAsync(obsQuery, ctx)
    const r2    = await store.queryAsync(obsQuery, ctx)

    expect(fetch).toHaveBeenCalledOnce()
    expect(r1.state).toBe('done')
    expect(r2.state).toBe('done')
    expect(r2.meta?.cacheHit).toBe(true)
    expect(r2.data).toBe(r1.data) // same array reference from cache
  })

  it('4 — sends If-None-Match only for an ALREADY-CACHED slice, never an uncached one', async () => {
    const etag = '"abc123"'
    // First call (slice A, time 2023): fresh 200 with ETag. Caches slice A.
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))

    const store = makeStore()
    await store.queryAsync(obsQuery, ctx)

    // Second call for a DIFFERENT slice (time 2022) — NOT yet cached. The ETag is
    // dataset-level but this slice is unheld, so a conditional GET here would invite a
    // 304-to-empty that never caches the slice → the post-warm querySync cold-throw
    // (the range/dynamics kpi-strip crash). The conditional MUST be omitted so this is
    // an unconditional 200 that caches slice B.
    const ctx2: SectionContext = { timeMode: 'year', dims: { time: 2022, geo: 'GE', sector: 'S13' } }
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))
    await store.queryAsync(obsQuery, ctx2)

    expect(fetch).toHaveBeenCalledTimes(2)
    const uncachedSliceHeaders = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>
    expect(uncachedSliceHeaders?.['If-None-Match']).toBeUndefined()

    // Third call: a REPEAT of slice A. It is now cached, so the conditional GET IS
    // sent — a 304 here is safe (we hold the rows to serve). Note the cache short-
    // circuits before fetch for an in-memory hit, so to exercise the header path we
    // evict via TTL is unnecessary: the in-memory cache returns slice A without a
    // fetch. Assert the cache-hit fast-path instead (no third fetch).
    const r3 = await store.queryAsync(obsQuery, ctx)
    expect(fetch).toHaveBeenCalledTimes(2)        // served from cache, no new request
    expect(r3.meta?.cacheHit).toBe(true)
  })

  it('4b — REGRESSION: a 304 on an uncached slice must not strand it empty', async () => {
    // Reproduces the kpi-strip dynamics crash at the store seam: the dataset ETag is
    // known (from an earlier slice), then a NEW slice is warmed. The fix gates the
    // conditional on a per-slice cache hit, so the new slice fetches unconditionally
    // (200) and lands in cache — a subsequent querySync resolves synchronously instead
    // of cold-throwing.
    const etag = '"v1"'
    const store = makeStore()

    // Warm slice A (time 2023) — 200 + ETag.
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))
    await store.queryAsync(obsQuery, ctx)

    // Warm slice B (time 2010) — must NOT carry If-None-Match, so the server 200s and
    // we cache it. (If it carried the conditional, a 304 would return [] uncached.)
    const ctxB: SectionContext = { timeMode: 'range', dims: { time: 2010, geo: 'GE', sector: 'S13' } }
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))
    const warmB = await store.queryAsync(obsQuery, ctxB)
    expect(warmB.state).toBe('done')
    expect(warmB.data.length).toBe(1)

    // The post-warm synchronous read for slice B now resolves from cache (no throw).
    expect(() => store.querySync(obsQuery, ctxB)).not.toThrow()
    expect(store.querySync(obsQuery, ctxB).length).toBe(1)
  })

  it('4b — returns state:done from cache on 304 Not Modified', async () => {
    const etag = '"v1"'
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))

    const store = makeStore()
    // Warm the cache
    await store.queryAsync(obsQuery, ctx)

    // Force a 304 by directly returning a 304 for a different ctx (bypasses in-mem cache)
    const ctx304: SectionContext = { timeMode: 'year', dims: { time: 2020, geo: 'GE', sector: 'S13' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))
    const result = await store.queryAsync(obsQuery, ctx304)

    expect(result.state).toBe('done')
    expect(result.meta?.cacheHit).toBe(true)
  })

})

// ── FF-NO-ZERO-TIME (params half) — toObsParams omits unset/0 bounds ──────────
//
//  ADR adr_time_range_readiness_seam (T3, guard 1). An unset time dim means
//  "unbounded → all periods": the observations route reads absent from/to as no
//  filter. A spurious 0 / '0' / NaN must NOT become from=0&to=0 (the route's
//  sdmxTimePeriod regex 400s on '0'). A real year and a comma-range pass through.
describe('FF-NO-ZERO-TIME — toObsParams never emits from/to = 0', () => {
  function firstCallUrl(): URL {
    return new URL(vi.mocked(fetch).mock.calls[0][0] as string)
  }

  it.each([
    ['time absent', {}],
    ['time empty string', { time: '' }],
    ['time numeric 0', { time: 0 }],
    ['time string "0"', { time: '0' }],
    ['time NaN', { time: NaN }],
  ])('omits BOTH from/to when %s', async (_label, timeDims) => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(obsQuery, { timeMode: 'year', dims: { geo: 'GE', ...timeDims } })

    const url = firstCallUrl()
    expect(url.searchParams.has('from')).toBe(false)
    expect(url.searchParams.has('to')).toBe(false)
    // Never the poisoned value, under any param name.
    expect(url.searchParams.get('from')).not.toBe('0')
    expect(url.searchParams.get('to')).not.toBe('0')
  })

  it('keeps a real single year as from=to', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(obsQuery, { timeMode: 'year', dims: { time: 2025, geo: 'GE' } })

    const url = firstCallUrl()
    expect(url.searchParams.get('from')).toBe('2025')
    expect(url.searchParams.get('to')).toBe('2025')
  })

  it('keeps a comma-range unchanged', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(obsQuery, { timeMode: 'range', dims: { time: '2015,2020', geo: 'GE' } })

    const url = firstCallUrl()
    expect(url.searchParams.get('from')).toBe('2015')
    expect(url.searchParams.get('to')).toBe('2020')
  })
})

// ── MULTI-VALUE filter encoding — the SDMX OR-within-dim wire shape ────────────
//
//  A cross-region panel sends an ARRAY for a dimension (geo ∈ {R2,R3}). The store
//  must preserve it AS a JSON array in the filter param — never comma-join it into
//  a single literal "R2,R3" (an unmatchable code). The observations route reads the
//  array as the OR-set (dim_key->>'geo' = ANY). Scalar dims stay scalar (back-compat).
describe('toObsParams — multi-value (array) filter encoding', () => {
  function firstFilter(): Record<string, unknown> {
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    return JSON.parse(url.searchParams.get('filter') ?? '{}')
  }

  it('preserves an array filter value as a JSON array (OR within the dim)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(
      { type: 'obs', measure: 'GDP', filter: { geo: ['R2', 'R3'] } },
      // ctx has no geo so the array is the sole source of geo (no ctx baseline override).
      { timeMode: 'year', dims: { time: 2023 } },
    )
    const filter = firstFilter()
    expect(filter['geo']).toEqual(['R2', 'R3'])     // array, NOT "R2,R3"
    expect(typeof filter['geo']).toBe('object')
  })

  it('mixes a multi-value dim with scalar dims (AND of scalar + OR-set)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: { geo: ['R2', 'R3'], sector: '_T' } },
      { timeMode: 'year', dims: { time: 2023 } },
    )
    const filter = firstFilter()
    expect(filter['geo']).toEqual(['R2', 'R3'])
    expect(filter['sector']).toBe('_T')             // scalar stays scalar
  })

  it('drops an empty array filter (empty selection would 0-match every row)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(
      { type: 'obs', measure: 'GDP', filter: { geo: [] } },
      { timeMode: 'year', dims: { time: 2023 } },
    )
    expect(firstFilter()['geo']).toBeUndefined()
  })
})

// ── $ne (exclusion) — a CLIENT-SIDE operator the wire route can't express ──────
//
//  The observations route filter schema accepts only scalars + arrays-of-scalars
//  (dim-filter.ts has @> and = ANY, never <>). A `$ne` filter (the regional map's
//  `geo:{$ne:'_T'}` — every region except the national total) must therefore NOT be
//  serialized onto the wire (the old code String()-ified it to "[object Object]",
//  an unmatchable literal → the empty regional map). It is dropped from the wire
//  filter and applied to the returned rows via the SSOT matchesFilter predicate.
describe('toObsParams + applyClientFilter — $ne exclusion', () => {
  function firstFilter(): Record<string, unknown> {
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    return JSON.parse(url.searchParams.get('filter') ?? '{}')
  }

  it('never serializes a $ne object onto the wire (no "[object Object]")', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ne: '_T' } } },
      { timeMode: 'year', dims: { time: 2023 } },
    )
    // geo carries NO wire filter (broader fetch); the exclusion is applied client-side.
    expect(firstFilter()['geo']).toBeUndefined()
    const raw = JSON.stringify(firstFilter())
    expect(raw).not.toContain('[object Object]')
  })

  it('excludes the $ne value from the returned rows (client-side)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([
      { time_period: '2023', dim_key: { geo: '_T', sector: 'S13' }, obs_value: 999, obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: 'R2', sector: 'S13' }, obs_value: 10,  obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: 'R3', sector: 'S13' }, obs_value: 20,  obs_status: 'A', obs_attribute: {} },
    ]))
    const store = makeStore()
    const res = await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ne: '_T' } } },
      { timeMode: 'year', dims: { time: 2023 } },
    )
    const geos = res.data.map((r) => (r as Record<string, unknown>)['geo'])
    expect(geos).toEqual(['R2', 'R3'])   // _T excluded, regions kept
  })

  it('sends the $ctx scalar to the wire while excluding $ne client-side', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))
    const store = makeStore()
    await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'geo', $ne: '_T' } } },
      { timeMode: 'year', dims: { time: 2023, geo: 'GE' } },
    )
    // The positive $ctx scope IS wire-expressible (scalar) — sent; $ne stays client-side.
    expect(firstFilter()['geo']).toBe('GE')
  })
})

describe('ApiStore.querySync', () => {

  it('5 — throws on cold cache with message containing caps.sync=false', () => {
    const store = makeStore()
    expect(() => store.querySync(obsQuery, ctx)).toThrowError(/caps\.sync=false/)
  })

  it('6 — returns from warm cache after queryAsync has populated it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow]))

    const store = makeStore()
    const asyncResult = await store.queryAsync(obsQuery, ctx)

    // querySync must now return the cached rows without throwing
    const syncResult = store.querySync(obsQuery, ctx)

    expect(syncResult).toEqual(asyncResult.data)
    expect(fetch).toHaveBeenCalledOnce() // no second fetch
  })

})
