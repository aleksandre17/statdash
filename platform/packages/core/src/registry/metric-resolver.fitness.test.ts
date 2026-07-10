// ── FF-METRIC-SPEC — the `metric` DataSpec: a declarative SemanticQuery [AR-50 M-SQ] ──
//
//  Proves metric-first is now STRUCTURAL: a governed metric (base OR calc-at-grain, M2)
//  is addressable as a `metric` DataSpec and resolves through the ONE registry path.
//
//    (1) RESOLUTION CORRECTNESS (DoD a) — a `metric` spec yields the SAME values as the
//        equivalent hand-authored spec: a calc metric matches evalMeasureAtGrain; a base
//        metric matches a `timeseries`. The resolver LOWERS, it does not recompute.
//    (2) THE LIVE WIN — "GDP per capita over time" as a single governed calc metric
//        rendered end-to-end through interpretSpec (one series, SNA-correct per year).
//    (3) LAW 1 — a non-time grain (`by:['geo']`) works with zero special-casing.
//    (4) REACTIVE GRAPH (DoD/§3) — extractDeps returns the correct edge set for a metric
//        spec (grain dims + where + ambient + measures + locale) so V1/V2 invalidate it.
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalStore }        from '../data/store-impl'
import { registerMetric }       from '../data/metric'
import { evalMeasureAtGrain }   from '../data/metric-grain'
import { interpretSpec }        from '../data/spec'
import { extractRequirements }  from '../data/spec'
import { extractDeps }          from '../graph/extractDeps'
import type { DataSpec }        from '../config/data-spec'
import type { Observation }     from '../sdmx'
import type { SectionContext }  from '../core/context'
import type { Expr }            from '@statdash/expr'

// A tiny two-measure cube: GDP (a flow) × population (a stock), by time × geo.
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

const store = new ExternalStore(OBS)
const PER_CAPITA: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }

// An "over time" ctx: the grain axis (time) is OPENED; other dims stay fixed.
const overTime: SectionContext = { dims: {} }
const arr = (s: ReadonlySet<string>) => [...s].sort()

beforeEach(() => {
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })
  registerMetric('pop', { code: 'POP', label: { en: 'Population' } })
  registerMetric('gdp_per_capita', {
    label: { en: 'GDP per capita' },
    calc: { inputs: { g: { measure: 'gdp' }, p: { measure: 'pop' } }, expr: PER_CAPITA },
  })
})

describe('(1) resolution correctness — a metric spec LOWERS, it does not recompute', () => {
  it('a CALC metric-at-grain matches evalMeasureAtGrain (the M2 SSOT, reused)', () => {
    const spec: DataSpec = { type: 'metric', metrics: ['gdp_per_capita'], by: ['time'] }
    const rows = interpretSpec(spec, overTime, store)
    const ref  = evalMeasureAtGrain('gdp_per_capita', overTime, store, ['time'])

    // Same value per grain tuple (the resolver adds id/label/series wrapping, no recompute).
    expect(rows.map((r) => r['value'])).toEqual(ref.map((r) => r['value']))
    expect(rows.map((r) => r['time'])).toEqual([2020, 2021, 2022])
    expect(rows.map((r) => r['value'])).toEqual([100 / 5, 110 / 5, 120 / 6]) // 20, 22, 20
  })

  it('a BASE metric-at-grain matches the equivalent `timeseries` spec, value-for-value', () => {
    const metricRows = interpretSpec({ type: 'metric', metrics: ['gdp'], by: ['time'] }, overTime, store)
    const tsRows     = interpretSpec({ type: 'timeseries', code: 'GDP', years: 'all' }, overTime, store)

    const byYear = (rows: { [k: string]: unknown }[], key: string) =>
      Object.fromEntries(rows.map((r) => [String(r[key]), r['value']]))
    // metric rows are keyed by the `time` dim; timeseries rows by `id` (String(year)).
    expect(byYear(metricRows, 'time')).toEqual(byYear(tsRows, 'id'))
    expect(byYear(metricRows, 'time')).toEqual({ '2020': 100, '2021': 110, '2022': 120 })
  })

  it('grain-∅ (no by/time) is a SCALAR — one governed row per metric', () => {
    const rows = interpretSpec({ type: 'metric', metrics: ['gdp_per_capita'] }, { dims: { time: 2022 } }, store)
    expect(rows).toHaveLength(1)
    expect(rows[0]!['value']).toBe(120 / 6) // 20 — the governed scalar at 2022
  })
})

describe('(2) THE LIVE WIN — GDP per capita over time, end-to-end via interpretSpec', () => {
  it('renders one series, SNA-correct per year (re-derived from totals, not sum-of-ratios)', () => {
    const rows = interpretSpec({ type: 'metric', metrics: ['gdp_per_capita'], time: { dim: 'time' } }, overTime, store)

    expect(rows.map((r) => ({ label: r['label'], value: r['value'], metric: r['metric'] }))).toEqual([
      { label: '2020', value: 100 / 5, metric: 'gdp_per_capita' }, // 20
      { label: '2021', value: 110 / 5, metric: 'gdp_per_capita' }, // 22
      { label: '2022', value: 120 / 6, metric: 'gdp_per_capita' }, // 20
    ])
    // 2022 is the re-derived total ratio (20), NOT the falsehood mean-of-regions (21).
    expect(rows.find((r) => r['time'] === 2022)!['value']).not.toBe((72 / 4 + 48 / 2) / 2)
  })

  it('multi-metric → one series per ref, each row tagged with its metric', () => {
    const rows = interpretSpec({ type: 'metric', metrics: ['gdp', 'pop'], by: ['time'] }, overTime, store)
    expect(rows.filter((r) => r['metric'] === 'gdp')).toHaveLength(3)
    expect(rows.filter((r) => r['metric'] === 'pop')).toHaveLength(3)
  })

  it('time.range SELECTION (a year list) filters the emitted tuples', () => {
    const rows = interpretSpec(
      { type: 'metric', metrics: ['gdp'], time: { dim: 'time', range: [2021, 2022] } },
      overTime, store,
    )
    expect(rows.map((r) => r['time'])).toEqual([2021, 2022])
  })

  it('where narrows the read coordinate (Law 1 — any dim)', () => {
    // Pin geo=R1: GDP over time = the R1 leaves (60/66/72), not the totals.
    const rows = interpretSpec(
      { type: 'metric', metrics: ['gdp'], by: ['time'], where: { geo: 'R1' } },
      overTime, store,
    )
    expect(rows.map((r) => r['value'])).toEqual([60, 66, 72])
  })
})

describe('(3) Law 1 — a non-time grain works with zero special-casing', () => {
  it('by:[geo] cross-section of GDP per capita at a pinned year', () => {
    const rows = interpretSpec(
      { type: 'metric', metrics: ['gdp_per_capita'], by: ['geo'] },
      { dims: { time: 2022 } }, store,
    )
    expect(rows.map((r) => ({ geo: r['geo'], value: r['value'] }))).toEqual([
      { geo: 'R1', value: 72 / 4 }, // 18
      { geo: 'R2', value: 48 / 2 }, // 24
    ])
  })
})

describe('(4) reactive graph — extractDeps returns the metric spec edge set', () => {
  it('grain dims + where + measures + locale are all extracted (no hidden dep)', () => {
    const node = {
      type: 'chart',
      data: {
        type: 'metric',
        metrics: ['gdp_per_capita'],
        by: ['geo'],
        time: { dim: 'time' },
        where: { adjustment: 'S' },
      },
    }
    const deps = extractDeps(node, { ambientDims: ['geo', 'time', 'adjustment'] })

    // grain axes (by ⊕ time.dim) + where pin are dim edges.
    expect(arr(deps.dims)).toEqual(expect.arrayContaining(['geo', 'time', 'adjustment']))
    // the governed metric ref is a measure edge (warm/prefetch set).
    expect(deps.measures.has('gdp_per_capita')).toBe(true)
    // governed (localized) series labels ⇒ a locale edge.
    expect(deps.locale).toBe(true)
  })

  it('warm requirements cover the underlying component codes (never empty)', () => {
    const spec: DataSpec = { type: 'metric', metrics: ['gdp_per_capita'], by: ['time'] }
    const reqs = extractRequirements(spec, overTime)
    const codes = new Set(reqs.map((r) => r.code))
    // gdp_per_capita expands to its components (GDP + POP) — both warmed, none empty.
    expect(codes).toEqual(new Set(['GDP', 'POP']))
    expect(reqs.length).toBeGreaterThan(0)
  })
})
