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
import { buildObsFilterParam, splitMultiValue } from './store-filter'
import { ApiStore }                             from './store-api'
import type { RawObsRow }                       from './store-api'
import type { SectionContext }                  from '../core/context'
import type { StoreQuery }                      from './store'

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
