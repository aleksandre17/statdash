// @vitest-environment node
//
// ── stats-api adapter tests (P2-3) ──────────────────────────────────────────
//
//  Pins the boundary normalization of SDMX OBS_STATUS in fromStatsObsRow.
//  The DB persists upper-case codes ('P','E','R','C'); the engine convention is
//  lower-case for non-normal codes ('p','e','r','c') with 'A' (normal) staying
//  upper. The single adapter seam must canonicalize so downstream provenance
//  never has to case-fold (Postel's Law).
//
//  Moved here in G3.0 with the adapter it pins — the SSOT stats wire seam now
//  lives in @statdash/plugins/datasources (shared by runner + Constructor).
//

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fromStatsObsRow, fromStatsClassifiers, fetchObservations } from './stats-api'
import type { RawStatsObsRow, StatsClassifierRow } from './stats-api'

const raw = (over: Partial<RawStatsObsRow>): RawStatsObsRow => ({
  time_period:   '2023',
  dim_key:       { measure: 'gdp', geo: 'GE' },
  obs_value:     100,
  obs_status:    'A',
  obs_attribute: {},
  ...over,
})

describe('fromStatsObsRow — OBS_STATUS normalization', () => {
  it('lower-cases preliminary P → p', () => {
    expect(fromStatsObsRow(raw({ obs_status: 'P' })).obsStatus).toBe('p')
  })

  it('lower-cases estimate / revised / confidential', () => {
    expect(fromStatsObsRow(raw({ obs_status: 'E' })).obsStatus).toBe('e')
    expect(fromStatsObsRow(raw({ obs_status: 'R' })).obsStatus).toBe('r')
    expect(fromStatsObsRow(raw({ obs_status: 'C' })).obsStatus).toBe('c')
  })

  it('keeps normal A upper-case (not displayed)', () => {
    expect(fromStatsObsRow(raw({ obs_status: 'A' })).obsStatus).toBe('A')
  })

  it('passes through an already-lower-case p unchanged', () => {
    expect(fromStatsObsRow(raw({ obs_status: 'p' })).obsStatus).toBe('p')
  })

  it('passes through an unrecognized code untouched (forward-compatible)', () => {
    expect(fromStatsObsRow(raw({ obs_status: 'X9' })).obsStatus).toBe('X9')
  })

  it('preserves dim_key, value and parsed time generically (Law 1)', () => {
    const obs = fromStatsObsRow(raw({ obs_value: 42, time_period: '2023-Q2' }))
    expect(obs.measure).toBe('gdp')
    expect(obs.geo).toBe('GE')
    expect(obs.value).toBe(42)
    expect(obs.time).toBe(2023.25)
  })
})

// ── FF-OBS-NUMERIC — value is number|null (never string), seqPos lifted (GAP 3) ──
//
//  pg serializes `numeric` as a STRING ("42367.21"); passing it verbatim makes
//  every aggregate{sum}/pct/growth do string math (NaN/concat). The seam must
//  coerce to a real number while preserving null (suppressed ≠ 0). seq_pos lives
//  in obs_attribute (snake) and must surface as camelCase seqPos so the accounts
//  `sort by:'seqPos'` + `seqPos>0` carry-forward filter read a present field.
describe('FF-OBS-NUMERIC — fromStatsObsRow value coercion + attribute lift', () => {
  it('coerces a pg numeric STRING to a real number', () => {
    const obs = fromStatsObsRow(raw({ obs_value: '42367.21' as unknown as number }))
    expect(obs.value).toBe(42367.21)
    expect(typeof obs.value).toBe('number')
  })

  it('preserves null (suppressed ≠ 0)', () => {
    const obs = fromStatsObsRow(raw({ obs_value: null }))
    expect(obs.value).toBeNull()
  })

  it('degrades a non-finite/corrupt value to null (never poisons a sum with NaN)', () => {
    const obs = fromStatsObsRow(raw({ obs_value: 'n/a' as unknown as number }))
    expect(obs.value).toBeNull()
  })

  it('lifts obs_attribute.seq_pos → camelCase seqPos as a number', () => {
    const obs = fromStatsObsRow(raw({ obs_attribute: { seq_pos: '3' } }))
    expect(obs.seqPos).toBe(3)
    expect(typeof obs.seqPos).toBe('number')
  })

  it('surfaces obs attributes generically (Law 1 — never names a specific dim)', () => {
    const obs = fromStatsObsRow(raw({ obs_attribute: { some_flag: 'X', ord: 2 } }))
    expect(obs.someFlag).toBe('X')
    expect(obs.ord).toBe(2)
  })
})

// ── GAP 5b — classifier WIRE drift: label {en,ka} + parent_code ──────────────
//
//  The live route returns `label` as a LocaleString object and the hierarchy
//  edge as `parent_code` (a business code). The seam must keep the LocaleString
//  intact (no [object Object]) and map parent DIRECTLY from parent_code.
describe('GAP 5b — fromStatsClassifiers label + parent_code mapping', () => {
  const rows: StatsClassifierRow[] = [
    { id: 1, code: 'B',   label: { en: 'Total', ka: 'სულ' }, color: '#111', parent_code: null, ord: 0, metadata: null },
    { id: 2, code: 'B1G', label: { en: 'GDP',   ka: 'მშპ' }, color: '#222', parent_code: 'B',  ord: 1, metadata: null },
  ]

  it('keeps label as a LocaleString {en,ka} (never [object Object])', () => {
    const cl = fromStatsClassifiers(rows) as unknown as Array<{ code: string; label: unknown }>
    expect(cl[1].label).toEqual({ en: 'GDP', ka: 'მშპ' })
  })

  it('maps parent DIRECTLY from parent_code (a real parent chain, no codeById)', () => {
    const cl = fromStatsClassifiers(rows) as unknown as Array<{ code: string; parent?: string }>
    expect(cl[0].parent).toBeUndefined()      // root
    expect(cl[1].parent).toBe('B')            // child → parent code
  })

  it('degrades a null/empty label to the code (Postel: always renderable)', () => {
    const cl = fromStatsClassifiers([
      { id: 9, code: 'X', label: null, color: null, parent_code: null, ord: 0, metadata: null },
      { id: 8, code: 'Y', label: {},   color: null, parent_code: null, ord: 1, metadata: null },
    ]) as unknown as Array<{ code: string; label: unknown }>
    expect(cl[0].label).toBe('X')
    expect(cl[1].label).toBe('Y')
  })

  it('accepts a legacy flat-string label (backward compatible)', () => {
    const cl = fromStatsClassifiers([
      { id: 1, code: 'GE', label: 'Georgia', color: null, parent_code: null, ord: 0, metadata: null },
    ]) as unknown as Array<{ label: unknown }>
    expect(cl[0].label).toBe('Georgia')
  })

  // REGRESSION (accounts SNA chart empty): the `aggregates` classifier carries
  // metadata:{ account, isClosing }; the chart's { $cl:'aggregates' } join reads
  // isClosing for the _isTotal encoding. The old ACL DROPPED metadata, so the join
  // injected nothing and the diverging chart lost its closing markers. The lift must
  // surface every scalar metadata key as a first-class entry attr.
  it('lifts metadata fields (isClosing, account) to first-class entry attrs', () => {
    const cl = fromStatsClassifiers([
      { id: 1, code: 'P1',  label: 'Output',  color: '#000', parent_code: null, ord: 0,
        metadata: { account: 'production', isClosing: 0 } },
      { id: 2, code: 'B1G', label: 'GVA',     color: '#000', parent_code: null, ord: 1,
        metadata: { account: 'production', isClosing: 1 } },
    ]) as unknown as Array<{ code: string; isClosing?: number; account?: string }>
    expect(cl[0].isClosing).toBe(0)
    expect(cl[1].isClosing).toBe(1)
    expect(cl[1].account).toBe('production')
  })

  it('the explicit code/label/color/parent win over a same-named metadata key', () => {
    const cl = fromStatsClassifiers([
      { id: 1, code: 'P1', label: 'Output', color: '#000', parent_code: 'X', ord: 0,
        metadata: { code: 'WRONG', parent: 'WRONG', extra: 'kept' } },
    ]) as unknown as Array<{ code: string; parent?: string; extra?: string }>
    expect(cl[0].code).toBe('P1')      // explicit column wins
    expect(cl[0].parent).toBe('X')     // parent_code wins over metadata.parent
    expect(cl[0].extra).toBe('kept')   // non-clashing metadata still lifted
  })
})

// ── FF-SCHEDULER-COALESCE — the adapter seam is ROUTED, never raw (0112 · R3) ────
//
//  fetchObservations was the LAST raw un-admitted fetch in this adapter (0111 routed
//  getAt; this closes the file). The oracle is BEHAVIORAL, not a source scan: routing
//  through the client-global FetchScheduler is observable as single-flight — two
//  concurrent IDENTICAL reads collapse to ONE wire call (a raw fetch would issue two),
//  while a conditional If-None-Match read stays a DISTINCT wire read (coalesceKeyFor
//  keys on headers — a revalidation must never fold into an unconditional miss).
describe('FF-SCHEDULER-COALESCE — fetchObservations routes through the ADR-048 seam', () => {
  afterEach(() => vi.unstubAllGlobals())

  const okBody = () =>
    new Response(JSON.stringify({ data: [] }), { status: 200, headers: { ETag: 'W/"v2"' } })

  it('two concurrent identical reads collapse to ONE wire call (proof of scheduler routing)', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => { calls += 1; return okBody() }))
    const [a, b] = await Promise.all([
      fetchObservations('', { dataset: 'D' }),
      fetchObservations('', { dataset: 'D' }),
    ])
    expect(calls).toBe(1)                       // coalesced — the scheduler seam, not raw fetch
    expect(a.notModified).toBe(false)
    expect(b.data).toEqual([])
    expect(b.etag).toBe('W/"v2"')               // each caller reads its own clone
  })

  it('a conditional If-None-Match read NEVER folds into the unconditional miss', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => { calls += 1; return okBody() }))
    await Promise.all([
      fetchObservations('', { dataset: 'D' }, 'W/"v1"'),
      fetchObservations('', { dataset: 'D' }),
    ])
    expect(calls).toBe(2)                       // different headers → different coalesce keys
  })

  it('the 304 conditional-GET contract survives the routed transport', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 304 })))
    const out = await fetchObservations('', { dataset: 'D' }, 'W/"v1"')
    expect(out.notModified).toBe(true)
    expect(out.etag).toBe('W/"v1"')             // caller's ETag preserved on 304
    expect(out.data).toEqual([])
  })
})
