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

import { describe, it, expect } from 'vitest'
import { fromStatsObsRow, fromStatsClassifiers } from './stats-api'
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
})
