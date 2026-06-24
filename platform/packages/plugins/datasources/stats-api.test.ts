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
import { fromStatsObsRow }       from './stats-api'
import type { RawStatsObsRow }   from './stats-api'

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
