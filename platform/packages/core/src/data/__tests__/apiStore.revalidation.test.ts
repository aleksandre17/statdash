// ── ApiStore conditional-GET / 304 freshness re-validation ─────────────────────
//
//  ADR-STORE-001 P1-1 (the ETag capability) + the audit FINDING 1 restoration.
//
//  The dataset-level ETag is the validator for a cached slice's freshness (a
//  dataset-version bump invalidates every slice). queryAsync's freshness gate has
//  three cases:
//    FRESH (now < expiresAt)  → serve from cache, no network round-trip.
//    STALE (held, TTL elapsed)→ CONDITIONAL GET (If-None-Match: <dataset ETag>):
//                                 304 → reuse held rows + refresh TTL (no download);
//                                 200 → dataset moved, replace.
//    MISS  (never held)       → UNCONDITIONAL GET (sending the ETag here would
//                                 invite a 304-to-empty for an unheld slice — the
//                                 range/dynamics kpi-strip crash).
//
//  These tests exercise the REAL path: a 304 is only ever mocked AFTER a request
//  that legitimately carried If-None-Match (a 304 cannot occur unconditionally).
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiStore }                                         from '../store-api'
import type { RawObsRow }                                  from '../store-api'
import type { SectionContext }                             from '../../core/context'
import type { StoreQuery }                                 from '../store'

const BASE_URL     = 'https://api.example.com'
const DATASET_CODE = 'NA_GDP'
const NON_TIME_DIMS: string[] = ['geo', 'sector']

const ctx: SectionContext = {
  dims: { time: 2023, geo: 'GE', sector: 'S13' },
}

const obsQuery: StoreQuery = { type: 'obs', measure: 'GDP' }

const rawRow: RawObsRow = {
  time_period:   '2023',
  dim_key:       { geo: 'GE', sector: 'S13' },
  obs_value:     42.5,
  obs_status:    'A',
  obs_attribute: {},
}

const mapRow = (raw: RawObsRow) => ({ ...raw.dim_key, value: raw.obs_value ?? 0 })

function makeStore(ttlMs?: number) {
  return new ApiStore(BASE_URL, DATASET_CODE, NON_TIME_DIMS, {}, mapRow, undefined, {}, ttlMs)
}

function makeOkResponse(rows: RawObsRow[], etag?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (etag) headers.set('ETag', etag)
  return new Response(JSON.stringify({ data: rows }), { status: 200, headers })
}

beforeEach(() => { vi.spyOn(global, 'fetch') })
afterEach(() => { vi.restoreAllMocks() })

describe('ApiStore — ETag conditional-GET freshness re-validation', () => {

  it('a FRESH cache hit short-circuits before any network round-trip', async () => {
    // First call: 200 + ETag, caches slice A fresh (default 5-min TTL).
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], '"abc123"'))

    const store = makeStore()
    const r1    = await store.queryAsync(obsQuery, ctx)

    // Second identical call within TTL: served from cache, NO fetch, NO conditional.
    const r2 = await store.queryAsync(obsQuery, ctx)
    expect(fetch).toHaveBeenCalledOnce()
    expect(r2.meta?.cacheHit).toBe(true)
    expect(r2.data).toBe(r1.data)   // same array reference
  })

  it('a TRUE MISS fetches UNCONDITIONALLY (never sends a stale dataset ETag)', async () => {
    const etag = '"abc123"'
    // Slice A (time 2023): fresh 200 with ETag → seeds the dataset ETag.
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))

    const store = makeStore()
    await store.queryAsync(obsQuery, ctx)

    // Slice B (time 2022): a DIFFERENT, never-held slice. The dataset ETag is known,
    // but this slice is a MISS — sending If-None-Match here would invite a 304-to-empty
    // that never caches the slice (the range/dynamics kpi-strip crash). It MUST be an
    // unconditional GET that 200s and caches slice B.
    const ctxB: SectionContext = { dims: { time: 2022, geo: 'GE', sector: 'S13' } }
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))
    await store.queryAsync(obsQuery, ctxB)

    expect(fetch).toHaveBeenCalledTimes(2)
    const missHeaders = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>
    expect(missHeaders?.['If-None-Match']).toBeUndefined()

    // The post-warm synchronous read for slice B resolves from cache (never cold-throws).
    expect(() => store.querySync(obsQuery, ctxB)).not.toThrow()
    expect(store.querySync(obsQuery, ctxB).length).toBe(1)
  })

  it('a STALE slice IS re-validated: If-None-Match sent, 304 reuses rows + refreshes TTL', async () => {
    const etag  = '"v1"'
    const store = makeStore(0)   // ttl=0 → the cached slice is stale on the very next call

    // First call: 200 + ETag caches slice A (immediately stale, ttl=0).
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], etag))
    const r1 = await store.queryAsync(obsQuery, ctx)
    expect(r1.data.length).toBe(1)

    // Second call for the SAME slice: stale + held → a CONDITIONAL GET. The server has
    // not changed the dataset, so it answers 304 — legitimately conditional (the request
    // carried If-None-Match). The held rows are reused; no body is downloaded.
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))
    const r2 = await store.queryAsync(obsQuery, ctx)

    expect(fetch).toHaveBeenCalledTimes(2)
    const revalHeaders = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>
    expect(revalHeaders?.['If-None-Match']).toBe(etag)   // the conditional WAS sent
    expect(r2.state).toBe('done')
    expect(r2.meta?.cacheHit).toBe(true)
    expect(r2.data).toBe(r1.data)                         // SAME rows reused (not re-downloaded)
  })

  it('a STALE slice whose dataset moved gets a 200 that REPLACES the held rows', async () => {
    const store = makeStore(0)   // every cached slice is stale on the next call

    // First call: 200 caches one row, dataset ETag "v1".
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([rawRow], '"v1"'))
    await store.queryAsync(obsQuery, ctx)

    // Second call: stale → conditional GET. The dataset VERSION bumped, so the server
    // ignores the (now-old) validator and 200s with new rows + a new ETag → replace.
    const newRow: RawObsRow = { ...rawRow, obs_value: 99 }
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse([newRow, newRow], '"v2"'))
    const r2 = await store.queryAsync(obsQuery, ctx)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(r2.meta?.cacheHit).toBe(false)
    expect(r2.data.length).toBe(2)                        // replaced, not reused

    // The new validator is now stored — the next stale revalidation carries "v2".
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))
    await store.queryAsync(obsQuery, ctx)
    const headers = vi.mocked(fetch).mock.calls[2][1]?.headers as Record<string, string>
    expect(headers?.['If-None-Match']).toBe('"v2"')
  })

})
