// ── FF-VALUE-BINDING — per-measure / per-filter value scoping on async stores ──
//
//  Guards the class of bug where a KPI/panel renders DATA but the WRONG VALUE:
//  the per-measure (or per-approach) pin fails to scope the resolved value on the
//  live async ApiStore, so every pinned read collapses onto rows[0] of a broader,
//  multi-measure slice.
//
//  The existing config↔cube guard only checks pin EXISTENCE. This asserts pin
//  EFFECT: a KPI pinning measure=X must resolve X's value (not the first measure
//  in the slice), and two `query` specs differing ONLY by a filter pin must yield
//  DISTINCT requirements (else their specDimKey collides → the wrong panel's rows).
//
//  Mechanism under test:
//    • Bug A — ApiStore.toObsParams must thread a `val` query's `code` into the
//      wire MEASURE_DIM filter, so the server returns only that measure.
//    • Bug B — extractRequirements('query') must fold the non-time filter pins
//      into the requirement dims, so the cache identity is per-pin.
//
//  The fake "server" (mocked fetch) is FAITHFUL: it returns ONLY the rows whose
//  measure matches filter.measure (and approach matches filter.approach). If the
//  engine drops the pin, the server returns every measure and the read mis-binds —
//  exactly the live defect — and this test fails.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiStore }              from './store-api'
import type { RawObsRow }        from './store-api'
import { storeVal }              from './store'
import { interpretKpi }          from './kpi'
import type { KpiSpec }          from './kpi'
import { extractRequirements }   from './spec'
import { atTime }                from '../core/context'
import type { SectionContext }   from '../core/context'
import type { EngineRow }        from './encoding'
import type { DataSpec }         from '../config/data-spec'

// ── A faithful multi-measure server ────────────────────────────────────
//
//  Three distinct GDP measures live in the SAME (geo=GE, time=2025, approach=_Z)
//  slice — the real cause of the live bug. The server applies filter.measure and
//  filter.approach. Per-capita sorts FIRST in the raw set, so a pin-dropping read
//  returns 10296.5 for EVERY measure (the observed live symptom).

const SLICE: Record<string, number> = {
  'gdp-per-capita-usd':                      10296.5,   // rows[0] — the false answer
  'gross-domestic-product-at-current-prices': 104598.1, // the true GDP-total value
  'real-gdp-growth-rates':                     7.5,      // the true growth value
}

function rawRow(measure: string, value: number, approach = '_Z'): RawObsRow {
  return {
    time_period:  '2025',
    dim_key:      { measure, geo: 'GE', approach },
    obs_value:    value,
    obs_status:   'A',
    obs_attribute: {},
  }
}

/** Parse the wire filter param and return the rows a correct server would send. */
function serveFromFilter(url: string): RawObsRow[] {
  const qs        = url.split('?')[1] ?? ''
  const params    = new URLSearchParams(qs)
  const filterRaw = params.get('filter')
  const filter    = filterRaw ? JSON.parse(filterRaw) as Record<string, string> : {}

  let rows = Object.entries(SLICE).map(([m, v]) => rawRow(m, v))
  if (filter['measure'])  rows = rows.filter((r) => r.dim_key['measure']  === filter['measure'])
  if (filter['approach']) rows = rows.filter((r) => r.dim_key['approach'] === filter['approach'])
  return rows
}

function installServer(): { urls: string[] } {
  const urls: string[] = []
  const fetchMock = vi.fn(async (url: string) => {
    urls.push(url)
    return {
      ok:      true,
      status:  200,
      headers: { get: () => null },
      json:    async () => ({ data: serveFromFilter(url) }),
      text:    async () => '',
    } as unknown as Response
  })
  // @ts-expect-error test global
  globalThis.fetch = fetchMock
  return { urls }
}

const mapRow = (r: RawObsRow): EngineRow =>
  ({ measure: r.dim_key['measure'], value: r.obs_value, time: Number(r.time_period), ...r.dim_key } as EngineRow)

function makeStore(): ApiStore {
  return new ApiStore('http://test', 'GDP_ANNUAL', ['geo', 'approach', 'measure'], {}, mapRow)
}

const baseCtx: SectionContext = { timeMode: 'year', dims: { time: 2025, geo: 'GE', approach: '_Z' } }

let savedFetch: typeof globalThis.fetch
beforeEach(() => { savedFetch = globalThis.fetch })
afterEach(()  => { globalThis.fetch = savedFetch; vi.restoreAllMocks() })

// ── Bug A — per-measure value scoping on the async store ───────────────

describe('FF-VALUE-BINDING · Bug A — val query scopes by its measure', () => {
  it('storeVal resolves the PINNED measure, not rows[0] of the slice', async () => {
    const store = makeStore()
    installServer()
    // Warm each measure's cell (the async-store contract: warm then read).
    for (const code of Object.keys(SLICE)) {
      await store.queryAsync({ type: 'val', code }, baseCtx)
    }
    // Each read must return ITS OWN measure's value — proof the pin scopes.
    expect(storeVal(store, 'gdp-per-capita-usd',                       baseCtx)).toBe(10296.5)
    expect(storeVal(store, 'gross-domestic-product-at-current-prices', baseCtx)).toBe(104598.1)
    expect(storeVal(store, 'real-gdp-growth-rates',                    baseCtx)).toBe(7.5)
  })

  it('the val measure code is on the wire (server can scope it)', async () => {
    const store = makeStore()
    const { urls } = installServer()
    await store.queryAsync({ type: 'val', code: 'gross-domestic-product-at-current-prices' }, baseCtx)
    expect(decodeURIComponent(urls[0]!)).toContain('gross-domestic-product-at-current-prices')
  })

  it('end-to-end: three KPIs pinning distinct measures resolve distinct values', async () => {
    const store = makeStore()
    installServer()

    const mkKpi = (id: string, measure: string): KpiSpec => ({
      id, label: id, unit: '', color: '#000',
      value: { type: 'point', measure, format: 'decimal1', filter: { geo: 'GE', approach: '_Z' } },
    })
    const specs = [
      mkKpi('total',   'gross-domestic-product-at-current-prices'),
      mkKpi('growth',  'real-gdp-growth-rates'),
      mkKpi('percap',  'gdp-per-capita-usd'),
    ]

    // Warm exactly the cells the KPI value-resolution will read.
    for (const s of specs) {
      const c = { ...baseCtx, dims: { ...baseCtx.dims } }
      await store.queryAsync({ type: 'val', code: (s.value as { measure: string }).measure }, atTime(2025, c))
    }

    // Compare on the numeric content (formatter may add locale separators).
    const num = (s: string): number => Number(s.replace(/[^\d.-]/g, ''))
    const values = specs.map((s) => num(interpretKpi(s, baseCtx, store).value))
    // The defect would collapse all three onto 10296.5. They must be distinct + correct.
    expect(values[0]).toBe(104598.1)
    expect(values[1]).toBe(7.5)
    expect(values[2]).toBe(10296.5)
    expect(new Set(values).size).toBe(3)
  })
})

// ── Bug B — per-filter requirement identity (specDimKey distinctness) ──

describe('FF-VALUE-BINDING · Bug B — query filter scopes the cache identity', () => {
  const prod: DataSpec = {
    type: 'query',
    query: { measure: '*', filter: { geo: 'GE', approach: 'PROD' } },
    encoding: { label: 'label', value: 'value' },
  } as DataSpec
  const exp: DataSpec = {
    type: 'query',
    query: { measure: '*', filter: { geo: 'GE', approach: 'EXP' } },
    encoding: { label: 'label', value: 'value' },
  } as DataSpec

  it('two query specs differing only by approach yield DISTINCT requirements', () => {
    const ctx: SectionContext = { timeMode: 'year', dims: { time: 2025, geo: 'GE' } }
    const rp = extractRequirements(prod, ctx)
    const re = extractRequirements(exp, ctx)
    // The pin must surface in req.dims so specDimKey (built from these) cannot collide.
    expect(JSON.stringify(rp)).not.toEqual(JSON.stringify(re))
    expect(rp[0]!.dims).toMatchObject({ approach: 'PROD' })
    expect(re[0]!.dims).toMatchObject({ approach: 'EXP' })
  })
})
