// ── FF-DESUGAR-EQUIV — R3 row-identity net (adr_data_reference_render_vision) ─
//
//  Locks the ADR R3 invariant: a convenience DataSpec resolved THROUGH the
//  desugaring layer is ROW-IDENTICAL (same rows, order, values, nulls, status,
//  field presence) to its prior BESPOKE resolver.
//
//  pivot is the only branch R3 desugars in this pass (it is store-free + fully
//  deterministic, hence provably equivalent with the current op set). The other
//  convenience branches (timeseries/growth/ratio-list) read the OLAP `val` cell
//  (ctx.dims auto-filter + carry-forward exclusion + sum + roundAgg), a store-
//  port primitive the `query` pipe cannot reconstruct row-identically; they are
//  intentionally LEFT DIRECT and are NOT desugared (see the R3 gap report).
//
//  The oracle here is the EXACT pre-desugar PivotResolver algorithm, inlined
//  below as `pivotDirect`. We assert `interpretSpec(pivotSpec)` (which now routes
//  through desugar → transform) `toEqual` the oracle across a corpus of shapes.
//  deepEqual matches the resolver's deep-equal contract (key insertion order is
//  not read by any consumer — encoding/table address fields by name).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { interpretSpec }        from './spec'
import { desugar }              from './desugar'
import { applyStep }            from './transform'
import { ExternalStore }        from './store-impl'
import { storeVal, storeObs }   from './store'
import { atTime, TIME_DIM }     from '../core/context'
import { effectiveYears, effectiveBounds, clampToBounds } from '../core/time-dimension'
import type { EngineRow }       from './encoding'
import type { DataSpec }        from '../config/data-spec'
import type { DimVal, Observation } from '../sdmx'
import type { SectionContext }  from '../core/context'

const ctx: SectionContext = { dims: { time: 2023, geo: 'GE' } }
// pivot is store-free; an empty store proves the desugared path never reaches it.
const store = new ExternalStore([])

// ── pivotDirect — the EXACT pre-R3 PivotResolver, frozen as the oracle ──
type PivotSpec = Extract<DataSpec, { type: 'pivot' }>

function pivotDirect(spec: PivotSpec): EngineRow[] {
  const melted = applyStep(spec.rows, {
    op: 'melt', idFields: [spec.keyField], valueFields: spec.valueFields,
    seriesKey: 'series', valueKey: 'value',
  })
  return melted.map((row) => {
    const label  = String(row[spec.keyField] ?? '')
    const series = String(row['series'] ?? '')
    const out: EngineRow = { id: `${label}::${series}`, label, series, value: Number(row['value'] ?? 0) }
    const color = spec.colors?.[series]
    if (color) out['color'] = color
    return out
  })
}

// ── corpus — every shape the pivot resolver is exercised in ────────────
const corpus: { name: string; spec: PivotSpec }[] = [
  {
    name: 'single valueField, no colors',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', value: 1000 }, { geo: 'AM', value: 500 }],
      keyField: 'geo', valueFields: ['value'],
    },
  },
  {
    name: 'multi valueField (wide → long fan-out)',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', v2022: 900, v2023: 1000 }, { geo: 'AM', v2022: 400, v2023: 500 }],
      keyField: 'geo', valueFields: ['v2022', 'v2023'],
    },
  },
  {
    name: 'colors fully present',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', value: 1000 }],
      keyField: 'geo', valueFields: ['value'],
      colors: { value: '#e84393' },
    },
  },
  {
    name: 'colors partial (one series mapped, one not) — conditional spread',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', a: 1, b: 2 }],
      keyField: 'geo', valueFields: ['a', 'b'],
      colors: { a: '#f5a623' }, // b has no color ⇒ field must be ABSENT
    },
  },
  {
    name: 'numeric keyField value (label String-coercion)',
    spec: {
      type: 'pivot',
      rows: [{ year: 2023, value: 7 }, { year: 2022, value: 3 }],
      keyField: 'year', valueFields: ['value'],
    },
  },
  {
    name: 'missing value field on a row (melt ?? 0 default)',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE' } as Record<string, DimVal>],
      keyField: 'geo', valueFields: ['value'],
    },
  },
  {
    name: 'string value coerced to number',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', value: '42' as unknown as DimVal }],
      keyField: 'geo', valueFields: ['value'],
    },
  },
  {
    name: 'empty rows',
    spec: { type: 'pivot', rows: [], keyField: 'geo', valueFields: ['value'] },
  },
  {
    name: 'empty colors object (no lookup step emitted)',
    spec: {
      type: 'pivot',
      rows: [{ geo: 'GE', value: 1 }],
      keyField: 'geo', valueFields: ['value'], colors: {},
    },
  },
]

describe('FF-DESUGAR-EQUIV — pivot desugars row-identically to transform+melt', () => {
  for (const { name, spec } of corpus) {
    it(name, () => {
      const direct    = pivotDirect(spec)
      const desugared = interpretSpec(spec, ctx, store)
      expect(desugared).toEqual(direct)
    })

    it(`${name} — color field presence matches exactly (no undefined leak)`, () => {
      const direct    = pivotDirect(spec)
      const desugared = interpretSpec(spec, ctx, store)
      // Same set of keys per row — proves the conditional `color` spread is preserved
      // (a `select`/unconditional add would leak `color: undefined`).
      expect(desugared.map((r) => Object.keys(r).sort())).toEqual(direct.map((r) => Object.keys(r).sort()))
    })
  }

  it('desugar(pivot) lowers to the `pipeline` spine [W-P5a] (one resolution path)', () => {
    // W-P5a — the LIVE switch: pivot now lowers onto the ONE `pipeline` grammar
    // (inline-rows source + the melt/cast tail), not the intermediate `transform`. The
    // FF-DESUGAR-EQUIV pivot corpus above proves the resolved rows stay byte-identical.
    const lowered = desugar({ type: 'pivot', rows: [], keyField: 'geo', valueFields: ['value'] })
    expect(lowered.type).toBe('pipeline')
  })

  it('desugar lowers the pipeline-shaped discriminants onto the spine [W-P5a]', () => {
    // The LIVE desugar switch: query/transform/pivot all resolve through `pipeline` now.
    // Byte-identity is proven by FF-PIPELINE-EQUIV (rows) + FF-DESUGAR-EQUIV (pivot corpus).
    const q: DataSpec = { type: 'query', query: { measure: 'B1G' }, encoding: { label: 'time', value: 'value' } }
    const t: DataSpec = { type: 'transform', source: [], steps: [], encoding: { label: 'time' } }
    expect(desugar(q).type).toBe('pipeline')
    expect(desugar(t).type).toBe('pipeline')
  })

  it('desugar is identity (same reference) for every NON-lowered spec', () => {
    // timeseries lowers to point-series (G2); query/transform/pivot lower to `pipeline`
    // (W-P5a). The store-aware VALUE-CELL specs growth/ratio-list are NOT spine-expressible
    // (see the desugarToPipeline W-P5a finding) and stay identity → direct resolvers.
    const primitives: DataSpec[] = [
      { type: 'row-list', rows: [{ code: 'B1G' }] },
      { type: 'growth', code: 'B1G', years: [2020, 2021] },
      { type: 'ratio-list', pairs: [{ code: 'D1', denom: 'B1G' }] },
    ]
    for (const p of primitives) expect(desugar(p)).toBe(p) // identity ⇒ untouched path
  })

  it('desugar(timeseries) lowers to the point-series primitive', () => {
    const lowered = desugar({ type: 'timeseries', code: 'B1G', years: [2020] })
    expect(lowered.type).toBe('point-series')
  })
})

// ── FF-DESUGAR-EQUIV — timeseries desugars row-identically (grain G2) ──────────────
//
//  Oracle = the EXACT pre-G2 TimeseriesResolver algorithm, frozen inline. We assert
//  `interpretSpec(timeseriesSpec)` (now routed desugar → point-series → valAt) equals
//  the oracle across years/'all'/clamp/timeDimension/pinned-dim shapes.

type TimeseriesSpec = Extract<DataSpec, { type: 'timeseries' }>

const tsObs: Observation[] = [
  { measure: 'GDP', time: 2018, geo: 'GE', value: 80  },
  { measure: 'GDP', time: 2018, geo: 'AM', value: 20  }, // 2018 = 100
  { measure: 'GDP', time: 2019, geo: 'GE', value: 90  },
  { measure: 'GDP', time: 2019, geo: 'AM', value: 25  }, // 2019 = 115
  { measure: 'GDP', time: 2020, geo: 'GE', value: 100 },
  { measure: 'GDP', time: 2020, geo: 'AM', value: 30  }, // 2020 = 130
  { measure: 'GDP', time: 2021, geo: 'GE', value: 110 }, // 2021 = 110
]
const tsStore = new ExternalStore(tsObs)

function timeseriesDirect(spec: TimeseriesSpec, c: SectionContext): EngineRow[] {
  const code = spec.code  // raw codes in this corpus (resolveCode is identity for them)
  const ys   = effectiveYears(spec)
  const years0 = ys === 'all'
    ? [...new Set(storeObs(tsStore, { measure: code }, c).map((o) => Number(o[TIME_DIM])))].sort((a, b) => a - b)
    : [...ys]
  const { from, to } = effectiveBounds(spec, c)
  const years = clampToBounds(years0, from, to)
  const vals  = years.map((y) => storeVal(tsStore, code, atTime(y, c)))
  const max   = Math.max(...vals.map(Math.abs), 1)
  return years.map((y, i) => ({
    id: String(y), label: String(y), value: vals[i], pct: (Math.abs(vals[i]) / max) * 100,
  }))
}

const tsCorpus: { name: string; spec: TimeseriesSpec; ctx: SectionContext }[] = [
  { name: 'explicit years',            spec: { type: 'timeseries', code: 'GDP', years: [2018, 2019, 2020, 2021] }, ctx: { dims: {} } },
  { name: "'all' (store distinct asc)", spec: { type: 'timeseries', code: 'GDP', years: 'all' },                   ctx: { dims: {} } },
  { name: 'single year',               spec: { type: 'timeseries', code: 'GDP', years: [2020] },                  ctx: { dims: {} } },
  { name: 'empty years',               spec: { type: 'timeseries', code: 'GDP', years: [] },                      ctx: { dims: {} } },
  { name: 'fromDim/toDim clamp',       spec: { type: 'timeseries', code: 'GDP', years: 'all', fromDim: 'lo', toDim: 'hi' }, ctx: { dims: { lo: 2019, hi: 2020 } } },
  { name: 'timeDimension YearsSpec',   spec: { type: 'timeseries', code: 'GDP', years: undefined as unknown as TimeseriesSpec['years'], timeDimension: { dim: 'time', range: [2019, 2020] } }, ctx: { dims: {} } },
  { name: 'timeDimension ctx-ref clamp', spec: { type: 'timeseries', code: 'GDP', years: 'all', timeDimension: { dim: 'time', range: [{ $ctx: 'lo' }, { $ctx: 'hi' }] } }, ctx: { dims: { lo: 2019, hi: 2021 } } },
  { name: 'pinned geo flows through ctx.dims', spec: { type: 'timeseries', code: 'GDP', years: [2019, 2020] }, ctx: { dims: { geo: 'GE' } } },
]

describe('FF-DESUGAR-EQUIV — timeseries ≡ the frozen bespoke resolver', () => {
  for (const { name, spec, ctx: c } of tsCorpus) {
    it(name, () => {
      expect(interpretSpec(spec, c, tsStore)).toEqual(timeseriesDirect(spec, c))
    })
  }
})
