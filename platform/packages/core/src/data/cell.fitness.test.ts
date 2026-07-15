// ── FF-CELL-HONEST-STATE — the canvas never lies (AR-52 · Law 11) ─────────────
//
//  The pervasive read path `storeVal(...) ?? 0` (store.ts) collapses FOUR
//  semantically distinct conditions into the single number `0` — the origin of the
//  owner's felt "the canvas lies" inside a statistics tool. This fitness DOCUMENTS
//  that collapse (RED — the lie is real) and proves `storeCell` distinguishes all
//  four (GREEN), and that interpretKpi carries the honest state onto KpiDef so the
//  renderer never shows a fabricated number for no-data / unbound / masked.
//
//  Synthetic corpus (no locale/dim literals privileged; time is one generic dim):
//    • gdp @ 2024 = 0     status A  → a GENUINE published zero (must render "0")
//    • gdp @ 2023 = 100   status A  → a normal value
//    • gdp @ 2099          (absent) → NO observation → no-data (NOT a zero)
//    • secret @ 2024 = 500 status c → CONFIDENTIAL → masked (value must be WITHHELD)

import { describe, it, expect }        from 'vitest'
import { ExternalStore }               from './store-impl'
import { storeVal }                    from './store'
import { storeCell }                   from './cell'
import { interpretKpi }                from './kpi'
import type { KpiSpec }                from './kpi'
import type { Observation }            from './store'
import type { SectionContext }         from '../core/context'

const OBS: Observation[] = [
  { measure: 'gdp',    time: 2023, value: 100, obsStatus: 'A' },
  { measure: 'gdp',    time: 2024, value:   0, obsStatus: 'A' },   // GENUINE zero
  { measure: 'secret', time: 2024, value: 500, obsStatus: 'c' },   // CONFIDENTIAL
]
const store = new ExternalStore(OBS)
const ctxAt = (time: number): SectionContext => ({ dims: { time } })

// ── RED — the lie: storeVal cannot distinguish the four conditions ─────────────
describe('FF-CELL-HONEST-STATE — the lie storeVal tells (documented RED)', () => {
  it('collapses genuine-0, no-data and unbound ALL to the number 0', () => {
    expect(storeVal(store, 'gdp', ctxAt(2024))).toBe(0)   // a genuine published zero
    expect(storeVal(store, 'gdp', ctxAt(2099))).toBe(0)   // NO observation — same 0
    expect(storeVal(store, '',    ctxAt(2024))).toBe(0)   // unbound — same 0
    // …three semantically distinct conditions, one indistinguishable number.
  })

  it('PUBLISHES a confidential value as a bare number (the F7 hole)', () => {
    // storeVal sums the suppressed cell like any other — the very disclosure the 'c'
    // flag exists to prevent. storeCell closes this (below).
    expect(storeVal(store, 'secret', ctxAt(2024))).toBe(500)
  })
})

// ── GREEN — storeCell distinguishes all four ──────────────────────────────────
describe('FF-CELL-HONEST-STATE — storeCell is honest', () => {
  it('a GENUINE zero is ok with value 0 (never no-data)', () => {
    expect(storeCell(store, 'gdp', ctxAt(2024))).toMatchObject({ value: 0, state: 'ok' })
  })

  it('a coordinate with NO observation is no-data with value null (never 0)', () => {
    expect(storeCell(store, 'gdp', ctxAt(2099))).toEqual({ value: null, state: 'no-data' })
  })

  it('an empty measure code is unbound, decided BEFORE any store read', () => {
    expect(storeCell(store, '', ctxAt(2024))).toEqual({ value: null, state: 'unbound' })
  })

  it('a CONFIDENTIAL cell is masked with value null — the number is WITHHELD', () => {
    const cell = storeCell(store, 'secret', ctxAt(2024))
    expect(cell).toEqual({ value: null, state: 'masked', status: 'c' })
    expect(cell.value).not.toBe(500)   // the F7 hole is closed
  })
})

// ── interpretKpi carries the state onto KpiDef (the render seam) ───────────────
describe('FF-CELL-HONEST-STATE — interpretKpi.state', () => {
  const pointKpi = (measure: string, time: number): KpiSpec => ({
    id: 'k', label: 'X', unit: '', color: '#000',
    value: { type: 'point', measure, format: 'decimal1', time },
  })

  it('a genuine-0 KPI is ok (state elided) and renders the real "0"', () => {
    const def = interpretKpi(pointKpi('gdp', 2024), ctxAt(2024), store)
    expect(def.state).toBeUndefined()               // ok ⟺ absent (byte-identical to pre-seam)
    expect(def.value).toBe('0')                     // the genuine zero IS shown (never hidden)
  })

  it('a no-data KPI carries state:no-data (not a fabricated number)', () => {
    const def = interpretKpi(pointKpi('gdp', 2099), ctxAt(2099), store)
    expect(def.state).toBe('no-data')
  })

  it('a confidential KPI carries state:masked and NEVER leaks the number', () => {
    const def = interpretKpi(pointKpi('secret', 2024), ctxAt(2024), store)
    expect(def.state).toBe('masked')
    expect(def.value).not.toContain('500')          // the confidential value is withheld
  })
})
