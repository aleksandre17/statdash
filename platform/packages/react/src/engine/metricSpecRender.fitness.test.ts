// @vitest-environment node
//
// ── FF-METRIC-SPEC-RENDER — a `metric` DataSpec renders a correct chart series [AR-50 M-SQ-EDITOR] ─
//
//  THE LIVE PROOF that closes the M-SQ authoring loop: the engine fitness
//  (registry/metric-resolver.fitness) proved a `metric` spec RESOLVES correctly at
//  interpretSpec; THIS proves the same spec flows through the REAL RENDER BINDING the
//  runner uses — resolveNodeRows (the react data-binding SSOT renderNode calls per node) →
//  interpretChart (the chart interpreter → ChartOutput.series, exactly what ApexCharts
//  draws) — and the chart SHOWS the SNA-correct re-derived series:
//
//    "GDP per capita over time" (a governed calc metric at time grain)
//       2020 = 100/5 = 20 · 2021 = 110/5 = 22 · 2022 = 120/6 = 20
//
//    2022 is the RE-DERIVED total ratio (20), NOT the falsehood mean-of-regions
//    ((72/4 + 48/2) / 2 = 21). A stale/naive render would show 21; the real pipeline
//    shows 20 — the whole point of M2's measure-algebra-at-grain, now proven end-to-end
//    through the SAME code path the delivered chart runs.
//
//  This is the render half of the loop the MetricSpecEditor (apps/panel) authors into:
//  an author picks the governed metric + toggles "over time" → this exact `metric` spec →
//  this exact chart series. Encoded as a fitness so the render binding can never silently
//  regress the new discriminant.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalStore, registerMetric, staticStore } from '@statdash/engine'
import type { DataStore, Observation, SectionContext } from '@statdash/engine'
import type { Expr } from '@statdash/expr'
import { interpretChart } from '@statdash/charts'
import { resolveNodeRows } from './resolveNodeRows'
import type { NodeBase, RenderContext } from './types'

// The M2 two-measure fixture (GDP flow × POP stock, by time × geo) — identical to
// registry/metric-resolver.fitness so the two proofs assert ONE truth at two layers.
const OBS: Observation[] = [
  { measure: 'GDP', time: 2020, geo: 'R1', value: 60 },
  { measure: 'GDP', time: 2020, geo: 'R2', value: 40 },   // 2020 total 100
  { measure: 'GDP', time: 2021, geo: 'R1', value: 66 },
  { measure: 'GDP', time: 2021, geo: 'R2', value: 44 },   // 2021 total 110
  { measure: 'GDP', time: 2022, geo: 'R1', value: 72 },
  { measure: 'GDP', time: 2022, geo: 'R2', value: 48 },   // 2022 total 120
  { measure: 'POP', time: 2020, geo: 'R1', value: 3 },
  { measure: 'POP', time: 2020, geo: 'R2', value: 2 },    // 2020 total 5
  { measure: 'POP', time: 2021, geo: 'R1', value: 3 },
  { measure: 'POP', time: 2021, geo: 'R2', value: 2 },    // 2021 total 5
  { measure: 'POP', time: 2022, geo: 'R1', value: 4 },
  { measure: 'POP', time: 2022, geo: 'R2', value: 2 },    // 2022 total 6
]
const PER_CAPITA: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }
const store = new ExternalStore(OBS)

/** A minimal RenderContext — only the fields resolveNodeRows reads. */
function makeCtx(dataStore: DataStore): RenderContext {
  const sectionCtx: SectionContext = { dims: {} }
  return {
    sectionCtx,
    stores:       { default: dataStore },
    pageStoreKey: 'default',
    vars:         {},
    filterParams: {},
    locale:       'en',
    rows:         [],
  } as unknown as RenderContext
}

beforeEach(() => {
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })
  registerMetric('pop', { code: 'POP', label: { en: 'Population' } })
  registerMetric('gdp_per_capita', {
    label: { en: 'GDP per capita' },
    calc: { inputs: { g: { measure: 'gdp' }, p: { measure: 'pop' } }, expr: PER_CAPITA },
  })
})

describe('FF-METRIC-SPEC-RENDER — a metric DataSpec renders the correct chart series end-to-end', () => {
  it('the chart node binding (resolveNodeRows) re-derives GDP per capita over time (2022 = 20, not 21)', () => {
    // The exact node the MetricSpecEditor authors: a chart bound to a `metric` DataSpec
    // ("over time" toggled → time.dim). No hand-written query — a governed noun + grain.
    const node: NodeBase = {
      type: 'chart',
      id:   'chart-gdp-per-capita',
      data: { type: 'metric', metrics: ['gdp_per_capita'], time: { dim: 'time' } },
    } as unknown as NodeBase

    const rows = resolveNodeRows(node, makeCtx(store))
    const byYear = Object.fromEntries(rows.map((r) => [String(r.label), r.value]))

    expect(byYear).toEqual({ '2020': 100 / 5, '2021': 110 / 5, '2022': 120 / 6 }) // 20, 22, 20
    expect(byYear['2022']).toBe(20)
    expect(byYear['2022']).not.toBe((72 / 4 + 48 / 2) / 2) // NOT the mean-of-regions 21
  })

  it('the chart interpreter (interpretChart → ChartOutput.series) SHOWS the re-derived series', () => {
    const node: NodeBase = {
      type: 'chart',
      id:   'chart-gdp-per-capita',
      data: { type: 'metric', metrics: ['gdp_per_capita'], time: { dim: 'time' } },
    } as unknown as NodeBase

    const ctx  = makeCtx(store)
    const rows = resolveNodeRows(node, ctx)

    // interpretChart is the SAME interpreter useChartOutput runs before ApexCharts —
    // ChartOutput.series is exactly what the chart draws. One governed series, per-year.
    const out = interpretChart({ type: 'bar', height: 300 }, rows, ctx.sectionCtx)

    expect(out.categories).toEqual(['2020', '2021', '2022'])
    expect(out.series).toHaveLength(1)
    expect(out.series[0]!.name).toBe('GDP per capita') // the governed label, locale-resolved
    expect(out.series[0]!.data.map((d) => d.value)).toEqual([20, 22, 20])

    // The headline: the 2022 bar the chart draws is the re-derived total ratio (20),
    // NOT the sum-of-ratios falsehood (21) — M2 measure-algebra-at-grain, on the screen.
    const i2022 = out.categories.indexOf('2022')
    expect(out.series[0]!.data[i2022]!.value).toBe(20)
    expect(out.series[0]!.data[i2022]!.value).not.toBe(21)
  })

  it('degrades safely: an unbound store yields no series, never a throw (Law 9)', () => {
    const node: NodeBase = {
      type: 'chart',
      id:   'chart-empty',
      data: { type: 'metric', metrics: ['gdp_per_capita'], time: { dim: 'time' } },
    } as unknown as NodeBase

    // staticStore has no observations → the resolver returns empty rows, the chart an
    // empty series. The author never sees a crash while composing (graceful degradation).
    const rows = resolveNodeRows(node, makeCtx(staticStore))
    const out  = interpretChart({ type: 'bar', height: 300 }, rows, { dims: {} })
    expect(out.series.flatMap((s) => s.data)).toEqual([])
  })
})
