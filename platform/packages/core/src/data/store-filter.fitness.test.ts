// ── FF-MULTIVALUE-WIRE — the ApiStore wire serializer agrees with resolveFilter ──
//
//  Root cause (multi-region cross-filter regression, LIVE ApiStore): a multi-select
//  resolves to ONE comma-joined ctx value (`region:'R2,R3'`). The `{$ctx}` /
//  `{$ne,$ctx}` branches of buildObsFilterParam used to emit `String(val)` → the
//  literal wire code `"R2,R3"`, which is not a member the observations route knows →
//  0 rows → the regional-comparison panel collapsed + duplicated the region bar.
//
//  The in-memory ExternalStore.resolveFilter ALREADY comma-split client-side, so the
//  WIRE serializer and the CLIENT resolver DISAGREED — the bug. The parity harness ran
//  over ExternalStore (client comma-split), which MASKED it. This fitness exercises the
//  ApiStore WIRE path directly and asserts the emitted filter is the OR-ARRAY shape the
//  route supports (never a literal "R2,R3"), and that an ApiStore double returns rows
//  for BOTH regions. splitMultiValue is the ONE decode both sides share (SSOT).
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildObsFilterParam, splitMultiValue, matchesFilter } from './store-filter'
import type { LeafFn }                          from './store-filter'
import { ApiStore }                             from './store-api'
import type { RawObsRow }                       from './store-api'
import { ExternalStore }                        from './store-impl'
import type { Observation }                     from '../sdmx'
import type { SectionContext }                  from '../core/context'
import { MEASURE_DIM }                          from '../core/context'
import type { StoreQuery }                      from './store'
import { queryReadObs }                         from '../registry/resolvers'

// ── buildObsFilterParam WIRE-path unit assertions ──────────────────────

// Parse the wire filter JSON buildObsFilterParam produces for a query + ctx.
function wireFilter(q: StoreQuery, dims: SectionContext['dims'], nonTimeDims: readonly string[] = []) {
  const json = buildObsFilterParam(q, { dims }, nonTimeDims)
  return JSON.parse(json ?? '{}') as Record<string, unknown>
}

describe('FF-MULTIVALUE-WIRE — buildObsFilterParam comma-string → OR-array', () => {

  it('$ctx multi-value: emits the ARRAY shape, NOT a literal "R2,R3"', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'region' } } },
      { region: 'R2,R3' },   // a multi-select resolves to one comma-joined ctx value
    )
    expect(filter['geo']).toEqual(['R2', 'R3'])          // OR-within-dim array
    expect(filter['geo']).not.toBe('R2,R3')              // never the unmatchable literal
  })

  it('$ne+$ctx multi-value: the positive $ctx scope is sent as an ARRAY', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'region', $ne: '_T' } } },
      { region: 'R2,R3' },
    )
    expect(filter['geo']).toEqual(['R2', 'R3'])
  })

  it('ctx baseline multi-value: a comma-joined ctx.dims pin also becomes an ARRAY', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA' },                    // no explicit filter → baseline path
      { geo: 'R2,R3' },
      ['geo'],
    )
    expect(filter['geo']).toEqual(['R2', 'R3'])
  })

  it('is GENERIC — the same split works for any dim (sector), never hardcoded', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA', filter: { sector: { $ctx: 'sec' } } },
      { sec: 'S13,S14,S15' },
    )
    expect(filter['sector']).toEqual(['S13', 'S14', 'S15'])
  })

  it('back-compat: a SINGLE value stays a scalar (no spurious array)', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'region' } } },
      { region: 'R2' },
    )
    expect(filter['geo']).toBe('R2')
  })

  it('whitespace/empties: trims members and drops empty segments', () => {
    const filter = wireFilter(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'region' } } },
      { region: ' R2 , , R3 ,' },
    )
    expect(filter['geo']).toEqual(['R2', 'R3'])
  })

  it('splitMultiValue is the shared SSOT decode', () => {
    expect(splitMultiValue('R2,R3')).toEqual(['R2', 'R3'])
    expect(splitMultiValue(' R2 , R3 ,')).toEqual(['R2', 'R3'])
    expect(splitMultiValue('R2')).toEqual(['R2'])
    expect(splitMultiValue(',,')).toEqual([])
  })
})

// ── ApiStore double — the wire array round-trips rows for BOTH regions ──

const BASE_URL     = 'https://api.example.com'
const DATASET_CODE = 'NA_GVA'
const NON_TIME_DIMS = ['geo', 'sector']
const mapRow = (raw: RawObsRow) => ({ ...raw.dim_key, value: raw.obs_value ?? 0 })

function makeStore() {
  return new ApiStore(BASE_URL, DATASET_CODE, NON_TIME_DIMS, {}, mapRow)
}

function okResponse(rows: RawObsRow[]): Response {
  return new Response(JSON.stringify({ data: rows }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => { vi.spyOn(global, 'fetch') })
afterEach(() => { vi.restoreAllMocks() })

describe('FF-MULTIVALUE-WIRE — ApiStore emits the array + returns both regions', () => {

  it('sends filter.geo as ["R2","R3"] and surfaces rows for BOTH regions', async () => {
    // The route reads the array as an OR-set (= ANY) → returns rows for both.
    vi.mocked(fetch).mockResolvedValueOnce(okResponse([
      { time_period: '2023', dim_key: { geo: 'R2', sector: '_T' }, obs_value: 10, obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: 'R3', sector: '_T' }, obs_value: 20, obs_status: 'A', obs_attribute: {} },
    ]))

    const store = makeStore()
    const res = await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: { geo: { $ctx: 'region' } } },
      { dims: { time: 2023, region: 'R2,R3' } },
    )

    // WIRE proof: the filter param is the array shape, not the literal "R2,R3".
    const url    = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    const filter = JSON.parse(url.searchParams.get('filter') ?? '{}')
    expect(filter['geo']).toEqual(['R2', 'R3'])

    // ROWS proof: both regions come back (0-rows collapse is gone).
    const geos = res.data.map((r) => (r as Record<string, unknown>)['geo'])
    expect(geos).toEqual(['R2', 'R3'])
  })
})

// ── FF-NECTXREF-MULTIVALUE — the CLIENT resolver honours a multi-value $ctx scope ──
//
//  Sibling bug to FF-MULTIVALUE-WIRE, on the OTHER side of the boundary: the CLIENT
//  predicate `matchesFilter`. Its NeCtxRef branch (`{$ne,$ctx}`) resolved the positive
//  $ctx scope with `expand ? expand(dim, ctxVal) : [ctxVal]` — it NEVER splitMultiValue'd
//  a comma-joined selection. So a 2-region pick `geo:'R3,R4'` produced the single
//  unmatchable leaf `['R3,R4']` → matchesLeaves(['R3,R4'],'R3') === false → EVERY real
//  row dropped → the multi-region comparison chart (geo:{$ctx,$ne:'_T'}) collapsed to [].
//  resolveFilter/matchedValues already comma-split via splitMultiValue (SSOT); this branch
//  diverged. It runs in BOTH ExternalStore._observe AND ApiStore.applyClientFilter, so a
//  static AND a live store both dropped rows. The wire fitness masked it (it only exercised
//  the SERIALIZER, never the client re-check). Fix: split ctxVal to the leaf SET, mirroring
//  resolveFilter exactly. splitMultiValue is the ONE decode shared across all three sites.

const NE_CTX_FILTER = { geo: { $ctx: 'geo', $ne: '_T' } } as const
const TWO_REGION_CTX: SectionContext = { dims: { geo: 'R3,R4' } }

describe('FF-NECTXREF-MULTIVALUE — matchesFilter restricts to the leaf SET, not one literal', () => {

  it('matches BOTH picked regions, excludes the unpicked leaf AND the $ne total', () => {
    // ctxVal = 'R3,R4' (a 2-region multi-select). No expand (identity leaf set).
    const match = (geo: string) =>
      matchesFilter({ measure: 'GVA', geo }, NE_CTX_FILTER, TWO_REGION_CTX)

    expect(match('R3')).toBe(true)   // picked  → in the leaf set
    expect(match('R4')).toBe(true)   // picked  → in the leaf set
    expect(match('R7')).toBe(false)  // unpicked → outside the leaf set
    expect(match('_T')).toBe(false)  // $ne total → excluded regardless
  })

  it('is GENERIC — the same split holds for any dim (sector) with an expand', () => {
    // A hierarchy expand is threaded through per-member (identity here).
    const expand: LeafFn = (_dim, v) => [v]
    const filter = { sector: { $ctx: 'sec', $ne: '_Z' } } as const
    const ctx: SectionContext = { dims: { sec: 'S13,S14' } }
    const match = (sector: string) => matchesFilter({ measure: 'GVA', sector }, filter, ctx, expand)

    expect(match('S13')).toBe(true)
    expect(match('S14')).toBe(true)
    expect(match('S15')).toBe(false)
    expect(match('_Z')).toBe(false)
  })

  // ── Store 1/2 — ExternalStore._observe (static, in-memory) ──────────
  it('ExternalStore: a 2-region selection over an ALL-region store resolves R3+R4 (not [])', () => {
    const obs: Observation[] = [
      { measure: 'GVA', geo: 'R3', value: 30 },
      { measure: 'GVA', geo: 'R4', value: 40 },
      { measure: 'GVA', geo: 'R7', value: 70 },
      { measure: 'GVA', geo: '_T', value: 99 },
    ]
    const store = new ExternalStore(obs)
    const rows  = store.querySync(
      { type: 'obs', measure: 'GVA', filter: NE_CTX_FILTER },
      TWO_REGION_CTX,
    )
    const geos = rows.map((r) => (r as Record<string, unknown>)['geo'])
    expect(geos).toEqual(['R3', 'R4'])          // both picked regions — NOT the empty collapse
  })

  // ── Store 2/2 — ApiStore.applyClientFilter (live, over a fetched superset) ──
  it('ApiStore: applyClientFilter keeps R3+R4 from a superset, drops R7 and _T', async () => {
    // The route returns a superset (incl. the unpicked R7 + the _T total the wire $ctx
    // array may over-include); the CLIENT re-check must keep only the picked leaf set.
    vi.mocked(fetch).mockResolvedValueOnce(okResponse([
      { time_period: '2023', dim_key: { geo: 'R3', sector: '_T' }, obs_value: 30, obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: 'R4', sector: '_T' }, obs_value: 40, obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: 'R7', sector: '_T' }, obs_value: 70, obs_status: 'A', obs_attribute: {} },
      { time_period: '2023', dim_key: { geo: '_T', sector: '_T' }, obs_value: 99, obs_status: 'A', obs_attribute: {} },
    ]))

    const store = makeStore()
    const res = await store.queryAsync(
      { type: 'obs', measure: 'GVA', filter: NE_CTX_FILTER },
      { dims: { geo: 'R3,R4' } },
    )

    const geos = res.data.map((r) => (r as Record<string, unknown>)['geo'])
    expect(geos).toEqual(['R3', 'R4'])          // client re-check restricts to the leaf set
  })
})

// ── FF-OBS-MEASURE-PIN — an obs query's top-level measure scopes the wire filter ──
//
//  Root cause (CONFIRMED-LIVE, card 0104, GDP charts 1/2 rendered a foreign series):
//  buildObsFilterParam pinned MEASURE_DIM for a `val` query but NOT for an `obs` query.
//  The metric-ref path (resolveQueryMeasures → queryReadObs) keeps the measure TOP-LEVEL
//  (`{type:'obs', measure:'gdp.current', filter:{geo,approach}}`), NOT inside q.filter —
//  so the wire filter went out measure-LESS, the store fetched the covering {geo,approach}
//  slice (ALL measures), and the chart collapsed each time coordinate to a last-wins
//  measure. Two sibling `query` charts with the SAME dims + DIFFERENT measure hit the
//  SAME (measure-less) key → identical rows → identical series (the lie). The val branch
//  proved the shape; this asserts the obs branch pins MEASURE_DIM through the SAME helper.
//
//  Faithful to the runtime path: builds the StoreQuery via `queryReadObs` — the exact SSOT
//  the QueryResolver read + the async warm both derive their (measure,filter) key from.

describe('FF-OBS-MEASURE-PIN — the top-level obs measure lands in the wire filter', () => {

  it('single measure: the metric-ref query pins MEASURE_DIM as a scalar', () => {
    // queryReadObs is what QueryResolver feeds storeObs (resolveMeasureRef + default-dim
    // merge). A raw code (no registered metric) round-trips byte-identically here.
    const q = queryReadObs({ measure: 'gdp.current', filter: { geo: 'GE', approach: 'B1GQ' } })
    const filter = wireFilter(q, {})
    expect(filter[MEASURE_DIM]).toBe('gdp.current')   // measure is SCOPED, not dropped
    expect(filter['geo']).toBe('GE')
    expect(filter['approach']).toBe('B1GQ')
  })

  it('array measure: a multi-measure obs query pins the OR-set (route reads it = ANY)', () => {
    const q = queryReadObs({ measure: ['gdp.current', 'gdp.perCapita'], filter: { geo: 'GE' } })
    const filter = wireFilter(q, {})
    expect(filter[MEASURE_DIM]).toEqual(['gdp.current', 'gdp.perCapita'])
  })

  it("wildcard '*': NO measure pin — the metric-swap $ctx-into-filter supplies the scope", () => {
    // The perspective metric-swap pattern rides measure:'*' + filter[MEASURE_DIM]:{$ctx}.
    // measurePin('*') → undefined, so the wildcard never pins a literal '*' (0 rows); the
    // q.filter[MEASURE_DIM] $ctx below still scopes it to the active dim value.
    const noScope = wireFilter({ type: 'obs', measure: '*', filter: { geo: 'GE' } }, {})
    expect(noScope[MEASURE_DIM]).toBeUndefined()

    const viaCtx = wireFilter(
      { type: 'obs', measure: '*', filter: { [MEASURE_DIM]: { $ctx: 'measure' } } },
      { measure: 'gdp.current' },
    )
    expect(viaCtx[MEASURE_DIM]).toBe('gdp.current')   // the explicit $ctx pin wins
  })

  it('an explicit q.filter[MEASURE_DIM] overrides the top-level measure pin', () => {
    // Precedence: the measure pin lands BEFORE the q.filter loop, so an explicit filter
    // measure (rare, but legal) wins — mirroring "explicit config > metric default".
    const filter = wireFilter(
      { type: 'obs', measure: 'gdp.current', filter: { [MEASURE_DIM]: 'gdp.perCapita' } },
      {},
    )
    expect(filter[MEASURE_DIM]).toBe('gdp.perCapita')
  })

  it('val branch stays byte-identical: a concrete code still pins MEASURE_DIM scalar', () => {
    // The shared helper must not perturb the confirmed-correct val/KPI path.
    const filter = wireFilter({ type: 'val', code: 'gdp.current' }, {})
    expect(filter[MEASURE_DIM]).toBe('gdp.current')
  })
})

// ── FF-QUERY-RENDER-TRUTH — sibling obs charts, same dims / diff measure ⇒ DISTINCT ──
//
//  The gate that was MISSING while the bug shipped green. warm-key ≡ read-key (both derive
//  from buildObsFilterParam) held the cache CONSISTENT even when it was measure-WRONG, so
//  no consistency fitness could bite. This asserts TRUTH: two ApiStore obs reads that share
//  {geo,approach} but request DIFFERENT measures must send DIFFERENT wire filters and
//  surface DIFFERENT series. The server double is measure-AWARE (honours filter.measure) —
//  so a regression to a measure-LESS key makes BOTH URLs identical → the double returns the
//  same covering rows → the series collapse to equal → this test RED. Impossible to slip.

const GDP_DATASET = 'NA_GDP'
const GDP_DIMS    = ['geo', 'approach']

// A measure-aware server: returns ONLY the rows whose measure matches the wire filter's
// MEASURE_DIM pin (the real route's `= ANY` containment). A measure-LESS filter ⇒ it would
// return the whole covering slice (all measures) — exactly the covering-collapse bug.
const GDP_FACTS: RawObsRow[] = [
  { time_period: '2015', dim_key: { geo: 'GE', approach: 'B1GQ', measure: 'gdp.current'   }, obs_value: 33935, obs_status: 'A', obs_attribute: {} },
  { time_period: '2016', dim_key: { geo: 'GE', approach: 'B1GQ', measure: 'gdp.current'   }, obs_value: 35800, obs_status: 'A', obs_attribute: {} },
  { time_period: '2015', dim_key: { geo: 'GE', approach: 'B1GQ', measure: 'gdp.perCapita' }, obs_value:  9100, obs_status: 'A', obs_attribute: {} },
  { time_period: '2016', dim_key: { geo: 'GE', approach: 'B1GQ', measure: 'gdp.perCapita' }, obs_value:  9600, obs_status: 'A', obs_attribute: {} },
]

function gdpServer(): void {
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url    = new URL(String(input))
    const filter = JSON.parse(url.searchParams.get('filter') ?? '{}') as Record<string, unknown>
    const pin    = filter[MEASURE_DIM]
    const pins   = pin === undefined ? null : Array.isArray(pin) ? pin.map(String) : [String(pin)]
    // null pin = measure-less request (the bug) → the covering slice (ALL measures).
    const rows   = pins === null ? GDP_FACTS : GDP_FACTS.filter((r) => pins.includes(r.dim_key.measure))
    return Promise.resolve(okResponse(rows))
  })
}

const gdpMapRow = (raw: RawObsRow) => ({ ...raw.dim_key, time: Number(raw.time_period), value: raw.obs_value ?? 0 })

describe('FF-QUERY-RENDER-TRUTH — same dims, different measure ⇒ distinct wire + series', () => {

  it('two sibling obs reads scope to their OWN measure and render DIFFERENT series', async () => {
    gdpServer()
    const store = new ApiStore(BASE_URL, GDP_DATASET, GDP_DIMS, {}, gdpMapRow)
    const ctx: SectionContext = { dims: { geo: 'GE', approach: 'B1GQ' } }

    // Chart 1 (nominal ₾) and Chart 2 (per-capita $): SAME dims, DIFFERENT measure — the
    // exact live GDP-page shape. Built via queryReadObs (the runtime SSOT key path).
    const q1 = queryReadObs({ measure: 'gdp.current'   })
    const q2 = queryReadObs({ measure: 'gdp.perCapita' })
    const r1 = await store.queryAsync(q1, ctx)
    const r2 = await store.queryAsync(q2, ctx)

    // WIRE proof — each request carried its own measure (never a shared measure-less key).
    const urls = vi.mocked(fetch).mock.calls.map((c) => new URL(String(c[0])))
    const pins = urls.map((u) => JSON.parse(u.searchParams.get('filter') ?? '{}')[MEASURE_DIM])
    expect(pins).toContain('gdp.current')
    expect(pins).toContain('gdp.perCapita')

    // RENDER-TRUTH — the two series are DISTINCT (the covering-collapse lie is dead).
    const v1 = r1.data.map((r) => (r as Record<string, unknown>)['value'])
    const v2 = r2.data.map((r) => (r as Record<string, unknown>)['value'])
    expect(v1).toEqual([33935, 35800])       // nominal ₾
    expect(v2).toEqual([9100, 9600])         // per-capita $
    expect(v1).not.toEqual(v2)               // the class this gate forever forbids
  })
})
