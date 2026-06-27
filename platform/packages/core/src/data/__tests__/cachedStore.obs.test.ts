// ── CachedStore obs-cache + TTL tests ────────────────────────────────
//
//  Covers the behaviours added in P2-6:
//    1. obs query hits source once; second identical call returns cached rows
//    2. val path is unaffected (still delegates to source)
//    3. distinct/schema pass through on every call (not cached)
//    4. TTL expiry causes a fresh source call
//    5. invalidate(datasetCode) clears obs entries containing that code
//    6. invalidate() with no arg clears everything
//    7. queryFrame proxies to source.queryFrame when present
//    8. queryFrame falls back to querySync + basic meta when source has none
//    9. ttlMs=Infinity never expires (static store pattern)
//   10. constructor is backward-compatible: new CachedStore(source) still works
//

import { describe, it, expect, vi } from 'vitest'
import { CachedStore }                           from '../store-impl'
import type { DataStore, ResultMeta, StoreQuery } from '../store'
import type { SectionContext }                    from '../../core/context'
import type { EngineRow }                         from '../encoding'

// ── Fixtures ──────────────────────────────────────────────────────────

const ctx: SectionContext = {
  dims: { time: 2023, geo: 'GE', sector: 'S13' },
}

const obsQ: StoreQuery = { type: 'obs', measure: 'GDP' }
const valQ: StoreQuery = { type: 'val', code: 'GDP' }
const distinctQ: StoreQuery = { type: 'distinct', dim: 'geo' }
const schemaQ: StoreQuery   = { type: 'schema' }

const obsRows: EngineRow[]    = [{ measure: 'GDP', value: 100 }]
const valRows: EngineRow[]    = [{ value: 42 }]
const distRows: EngineRow[]   = [{ value: 'GE', label: 'Georgia' }]
const schemaRows: EngineRow[] = [{ measure: 'GDP', label: 'Gross Domestic Product' }]

function makeSource(overrides: Partial<DataStore> = {}): DataStore {
  return {
    querySync: vi.fn((q: StoreQuery) => {
      if (q.type === 'obs')      return obsRows
      if (q.type === 'val')      return valRows
      if (q.type === 'distinct') return distRows
      if (q.type === 'schema')   return schemaRows
      return []
    }),
    caps: { queryTypes: ['val', 'obs', 'schema', 'distinct'], batching: false, streaming: false, sync: true },
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('CachedStore — obs caching (P2-6)', () => {

  it('1 — obs query hits source once; second identical call returns cached rows', () => {
    const source = makeSource()
    const store  = new CachedStore(source)

    const r1 = store.querySync(obsQ, ctx)
    const r2 = store.querySync(obsQ, ctx)

    expect(source.querySync).toHaveBeenCalledOnce()
    expect(r1).toBe(r2) // same array reference from cache
  })

  it('2 — val path is unaffected (delegates to source, result still memoised)', () => {
    const source = makeSource()
    const store  = new CachedStore(source)

    const r1 = store.querySync(valQ, ctx)
    const r2 = store.querySync(valQ, ctx)

    expect(r1).toEqual([{ value: 42 }])
    // val memoises too (existing behaviour preserved)
    expect(source.querySync).toHaveBeenCalledOnce()
    expect(r2[0]).toEqual({ value: 42 })
  })

  it('3 — distinct and schema pass through on every call (not obs-cached)', () => {
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(distinctQ, ctx)
    store.querySync(distinctQ, ctx)
    store.querySync(schemaQ,   ctx)
    store.querySync(schemaQ,   ctx)

    // 4 calls: distinct × 2 + schema × 2
    expect(source.querySync).toHaveBeenCalledTimes(4)
  })

  it('4 — TTL expiry causes a fresh source call', () => {
    vi.useFakeTimers()
    const source = makeSource()
    const store  = new CachedStore(source, 1000) // 1 second TTL

    store.querySync(obsQ, ctx)
    expect(source.querySync).toHaveBeenCalledOnce()

    // Advance past TTL
    vi.advanceTimersByTime(1001)
    store.querySync(obsQ, ctx)

    expect(source.querySync).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('5 — invalidate(datasetCode) clears obs entries containing that code', () => {
    // Seed obs cache with a key that will contain 'NA_GDP'
    const obsWithDataset: StoreQuery = { type: 'obs', measure: 'NA_GDP' }
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(obsWithDataset, ctx)
    expect(source.querySync).toHaveBeenCalledOnce()

    store.invalidate('NA_GDP')

    // Cache cleared — next call hits source again
    store.querySync(obsWithDataset, ctx)
    expect(source.querySync).toHaveBeenCalledTimes(2)
  })

  it('5b — invalidate(datasetCode) does not clear obs entries for a different dataset', () => {
    const obsA: StoreQuery = { type: 'obs', measure: 'NA_GDP' }
    const obsB: StoreQuery = { type: 'obs', measure: 'CPI' }
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(obsA, ctx)
    store.querySync(obsB, ctx)
    expect(source.querySync).toHaveBeenCalledTimes(2)

    // Only invalidate the 'NA_GDP' dataset
    store.invalidate('NA_GDP')

    // obsB should still be cached
    store.querySync(obsA, ctx) // cache miss → +1
    store.querySync(obsB, ctx) // cache hit  → +0

    expect(source.querySync).toHaveBeenCalledTimes(3)
  })

  it('6 — invalidate() with no arg clears all obs and val caches', () => {
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(obsQ, ctx)
    store.querySync(valQ, ctx)
    expect(source.querySync).toHaveBeenCalledTimes(2)

    store.invalidate()

    store.querySync(obsQ, ctx)
    store.querySync(valQ, ctx)
    expect(source.querySync).toHaveBeenCalledTimes(4)
  })

  it('7 — queryFrame proxies to source.queryFrame when present', () => {
    const meta: ResultMeta = { totalRows: 1, truncated: false, source: 'api', cacheHit: true }
    const sourceWithFrame: DataStore = makeSource({
      queryFrame: vi.fn(() => ({ rows: obsRows, meta })),
    })
    const store = new CachedStore(sourceWithFrame)

    const result = store.queryFrame!(obsQ, ctx)

    expect(sourceWithFrame.queryFrame).toHaveBeenCalledOnce()
    expect(result.rows).toBe(obsRows)
    expect(result.meta).toBe(meta)
  })

  it('8 — queryFrame falls back to querySync + basic meta when source has no queryFrame', () => {
    const source = makeSource() // no queryFrame
    const store  = new CachedStore(source)

    const result = store.queryFrame!(obsQ, ctx)

    expect(result.rows).toEqual(obsRows)
    expect(result.meta.totalRows).toBe(obsRows.length)
    expect(result.meta.truncated).toBe(false)
    expect(result.meta.source).toBe('cached')
  })

  it('9 — ttlMs=Infinity never expires (static store pattern)', () => {
    vi.useFakeTimers()
    const source = makeSource()
    const store  = new CachedStore(source, Infinity)

    store.querySync(obsQ, ctx)

    // Advance a very long time
    vi.advanceTimersByTime(Number.MAX_SAFE_INTEGER)
    store.querySync(obsQ, ctx)

    // Still only one source call — Infinity TTL never expires
    expect(source.querySync).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('10 — backward-compatible: new CachedStore(source) works without ttlMs arg', () => {
    const source = makeSource()
    // Must not throw; default ttlMs = 5 minutes
    expect(() => new CachedStore(source)).not.toThrow()

    const store = new CachedStore(source)
    const rows  = store.querySync(obsQ, ctx)
    expect(rows).toEqual(obsRows)
  })

  it('cache key is sensitive to ctx.dims — different dims = different cache entry', () => {
    const ctx2: SectionContext = { dims: { time: 2022, geo: 'GE', sector: 'S13' } }
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(obsQ, ctx)
    store.querySync(obsQ, ctx2)

    // Two different ctx → two source calls
    expect(source.querySync).toHaveBeenCalledTimes(2)
  })

  it('cache key is sensitive to query measure — different measure = different cache entry', () => {
    const obsGDP: StoreQuery = { type: 'obs', measure: 'GDP' }
    const obsGNI: StoreQuery = { type: 'obs', measure: 'GNI' }
    const source = makeSource()
    const store  = new CachedStore(source)

    store.querySync(obsGDP, ctx)
    store.querySync(obsGNI, ctx)

    expect(source.querySync).toHaveBeenCalledTimes(2)
  })

})
