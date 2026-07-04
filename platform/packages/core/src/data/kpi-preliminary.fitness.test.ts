// ── FF-KPI-PRELIMINARY-DISPLAYED-SLICE — year-aware KPI preliminary flag ──────
//
//  interpretKpi's `preliminary` must reflect the SDMX OBS_STATUS of the observation(s)
//  the card ACTUALLY reads at its pinned coordinate(s) — NEVER dataset-wide. The bug:
//  a KPI resolving to a FINAL year (2024) reported preliminary=true merely because the
//  dataset ALSO contained a 2025 preliminary obs (the year-blind provenance leak).
//
//  Synthetic (en / no locale literals). A single measure carries a FINAL 2024 obs and
//  a PRELIMINARY 2025 obs, so the SAME dataset holds both — proving the flag is driven
//  by the DISPLAYED coordinate, not the dataset. Year-agnostic: asserted via the synthetic
//  P-marked obs, never a hardcoded-year branch in the SUT.

import { describe, it, expect } from 'vitest'
import { ExternalStore }        from './store-impl'
import { interpretKpi }         from './kpi'
import type { KpiSpec }         from './kpi'
import type { Observation }     from './store'
import type { SectionContext }  from '../core/context'

// measure × time → value, with an SDMX OBS_STATUS. 2024 final, 2025 preliminary.
const OBS: Observation[] = [
  { measure: 'gdp', time: 2023, value:  90, obsStatus: 'A' },
  { measure: 'gdp', time: 2024, value: 100, obsStatus: 'A' },   // FINAL
  { measure: 'gdp', time: 2025, value: 110, obsStatus: 'p' },   // PRELIMINARY
]

const store = new ExternalStore(OBS)

const pointKpi = (time: number): KpiSpec => ({
  id: 'k', label: 'GDP', unit: '', color: '#000',
  value: { type: 'point', measure: 'gdp', format: 'decimal1', time },
})

const ctxAt = (time: number): SectionContext => ({ dims: { time } })

describe('FF-KPI-PRELIMINARY-DISPLAYED-SLICE — point', () => {
  it('a point KPI at a FINAL coordinate (2024) is NOT preliminary', () => {
    // dataset ALSO holds a 2025 P obs — the flag must ignore it.
    expect(interpretKpi(pointKpi(2024), ctxAt(2024), store).preliminary).toBe(false)
  })

  it('a point KPI at a PRELIMINARY coordinate (2025) IS preliminary', () => {
    expect(interpretKpi(pointKpi(2025), ctxAt(2025), store).preliminary).toBe(true)
  })

  it('an explicit spec.preliminary override always wins (even at a final coord)', () => {
    const spec: KpiSpec = { ...pointKpi(2024), preliminary: true }
    expect(interpretKpi(spec, ctxAt(2024), store).preliminary).toBe(true)
  })
})

describe('FF-KPI-PRELIMINARY-DISPLAYED-SLICE — cagr endpoints', () => {
  const cagrKpi = (from: number, to: number): KpiSpec => ({
    id: 'k', label: 'GDP', unit: '', color: '#000',
    value: { type: 'cagr', measure: 'gdp', from, to },
  })

  it('cagr whose `to` endpoint is preliminary (2025) IS preliminary', () => {
    expect(interpretKpi(cagrKpi(2023, 2025), ctxAt(2025), store).preliminary).toBe(true)
  })

  it('cagr over final endpoints only (2023→2024) is NOT preliminary', () => {
    expect(interpretKpi(cagrKpi(2023, 2024), ctxAt(2024), store).preliminary).toBe(false)
  })
})
