// ── FF-CALC-GRAIN-SCALAR-IDENTICAL + the GDP-per-capita-over-time demonstration ──
//
//  The reversible-expansion parity gate for AR-50 M2 (measure algebra at grain):
//
//    (1) SCALAR PARITY — evalCalcAtGrain(ref, ctx, store) with grain-∅ is BYTE-IDENTICAL
//        to the pre-M2 scalar path (resolveMetricValue). A KPI point read does not move.
//
//    (2) THE CONCRETE WIN — "GDP per capita over time" as a SINGLE governed calc metric
//        that renders correctly at TIME grain (one row per year, value = GDP(y)/pop(y))
//        WITHOUT per-chart re-derivation. Proves the align-join + per-row Expr eval, and
//        proves it is the SNA-correct number (re-derived from additive components at
//        grain), NOT the scientific falsehood of averaging/summing per-capita cells.
//
//    (3) LAW 1 — the same machinery evaluates a NON-time grain (`['geo']`) with zero
//        special-casing; grain is a generic set of dim keys.
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalStore }        from './store-impl'
import { registerMetric }       from './metric'
import { resolveMetricValue }   from './metric-calc'
import { evalCalcAtGrain }      from './metric-grain'
import type { Observation }     from '../sdmx'
import type { SectionContext }  from '../core/context'
import type { Expr }            from '@statdash/expr'

// A tiny two-measure cube: GDP (a flow) and population (a stock), by time × geo.
//   time ∈ {2020,2021,2022}, geo ∈ {R1,R2}. `_T`-free — totals are summed from leaves.
const OBS: Observation[] = [
  // GDP (million GEL)
  { measure: 'GDP', time: 2020, geo: 'R1', value: 60 },
  { measure: 'GDP', time: 2020, geo: 'R2', value: 40 },   // 2020 total 100
  { measure: 'GDP', time: 2021, geo: 'R1', value: 66 },
  { measure: 'GDP', time: 2021, geo: 'R2', value: 44 },   // 2021 total 110
  { measure: 'GDP', time: 2022, geo: 'R1', value: 72 },
  { measure: 'GDP', time: 2022, geo: 'R2', value: 48 },   // 2022 total 120
  // Population (thousands)
  { measure: 'POP', time: 2020, geo: 'R1', value: 3 },
  { measure: 'POP', time: 2020, geo: 'R2', value: 2 },    // 2020 total 5
  { measure: 'POP', time: 2021, geo: 'R1', value: 3 },
  { measure: 'POP', time: 2021, geo: 'R2', value: 2 },    // 2021 total 5
  { measure: 'POP', time: 2022, geo: 'R1', value: 4 },
  { measure: 'POP', time: 2022, geo: 'R2', value: 2 },    // 2022 total 6
]

const store = new ExternalStore(OBS)

// GDP per capita = GDP ÷ population — one governed derived metric (a ratio ⇒ non-additive).
const PER_CAPITA_EXPR: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }

beforeEach(() => {
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })                 // additive (default)
  registerMetric('pop', { code: 'POP', label: { en: 'Population' } })          // additive (default)
  registerMetric('gdp_per_capita', {
    label: { en: 'GDP per capita' },
    // A calc metric ⇒ non-additive by the conservative structural default.
    calc: { inputs: { g: { measure: 'gdp' }, p: { measure: 'pop' } }, expr: PER_CAPITA_EXPR },
  })
})

// A scalar section context pinned to one year (a KPI coordinate).
const scalarCtx = (year: number): SectionContext => ({ dims: { time: year } })
// A grain context: the grain axis (time) is OPENED; the other dims stay fixed.
const overTimeCtx: SectionContext = { dims: {} }

describe('FF-CALC-GRAIN-SCALAR-IDENTICAL — scalar is grain-∅, byte-identical', () => {
  it('grain-∅ equals resolveMetricValue for every year (the parity gate)', () => {
    for (const year of [2020, 2021, 2022]) {
      const scalar = resolveMetricValue('gdp_per_capita', scalarCtx(year), store)
      const grain0 = evalCalcAtGrain('gdp_per_capita', scalarCtx(year), store) // grain=[]
      expect(grain0).toEqual([{ value: scalar }])
    }
  })

  it('grain-∅ of a base (non-calc) ref yields [] — caller falls back to a raw read', () => {
    // resolveMetricValue returns undefined for a non-calc ref; evalCalcAtGrain mirrors it.
    expect(evalCalcAtGrain('gdp', scalarCtx(2020), store)).toEqual([])
    // At a non-empty grain a non-calc ref also declines (no calc to re-derive).
    expect(evalCalcAtGrain('gdp', overTimeCtx, store, ['time'])).toEqual([])
  })
})

describe('GDP per capita OVER TIME — one governed metric, correct at time grain', () => {
  it('re-derives per year from the additive components (SNA-correct, not sum-of-ratios)', () => {
    const rows = evalCalcAtGrain('gdp_per_capita', overTimeCtx, store, ['time'])

    // One row per year, ordered; value = GDP(total) / POP(total) at each year.
    expect(rows).toEqual([
      { time: 2020, value: 100 / 5 },  // 20
      { time: 2021, value: 110 / 5 },  // 22
      { time: 2022, value: 120 / 6 },  // 20
    ])

    // Each grain row matches the scalar governed number at that year — ONE number on
    // every surface (a KPI at year Y and the chart's point at Y agree).
    for (const r of rows) {
      const scalar = resolveMetricValue('gdp_per_capita', scalarCtx(r['time'] as number), store)
      expect(r['value']).toBe(scalar)
    }
  })

  it('is NOT the falsehood of averaging the per-region per-capita cells', () => {
    // The WRONG number (a non-additive measure summed/averaged over geo cells):
    //   2022 per-region ratios: R1 = 72/4 = 18, R2 = 48/2 = 24 → mean 21 ≠ 20 (governed).
    const rows = evalCalcAtGrain('gdp_per_capita', overTimeCtx, store, ['time'])
    const y2022 = rows.find((r) => r['time'] === 2022)!
    expect(y2022['value']).toBe(120 / 6)      // 20 — re-derived from the totals
    expect(y2022['value']).not.toBe((18 + 24) / 2) // 21 — the sum-of-ratios falsehood
  })
})

describe('Law 1 — the same machinery evaluates a NON-time grain', () => {
  it('evaluates GDP per capita at geo grain with zero special-casing', () => {
    // Pin the year, open the geo axis — a cross-section of the SAME governed metric.
    const rows = evalCalcAtGrain('gdp_per_capita', { dims: { time: 2022 } }, store, ['geo'])
    expect(rows).toEqual([
      { geo: 'R1', value: 72 / 4 },  // 18
      { geo: 'R2', value: 48 / 2 },  // 24
    ])
  })
})
