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

  it('4 — sends If-None-Match on second call when ETag was received', async () => {
    const etag = '"abc123"'
    // First call: fresh response with ETag
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))

    const store = makeStore()
    await store.queryAsync(obsQuery, ctx)

    // Second call with different ctx so cache misses (forces a new fetch)
    const ctx2: SectionContext = { timeMode: 'year', dims: { time: 2022, geo: 'GE', sector: 'S13' } }
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([], etag))
    await store.queryAsync(obsQuery, ctx2)

    expect(fetch).toHaveBeenCalledTimes(2)
    const secondCallHeaders = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>
    expect(secondCallHeaders?.['If-None-Match']).toBe(etag)
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
