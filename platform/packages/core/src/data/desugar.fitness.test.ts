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
import type { EngineRow }       from './encoding'
import type { DataSpec }        from '../config/data-spec'
import type { DimVal }          from '../sdmx'
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

  it('desugar(pivot) lowers to a transform primitive (one resolution path)', () => {
    const lowered = desugar({ type: 'pivot', rows: [], keyField: 'geo', valueFields: ['value'] })
    expect(lowered.type).toBe('transform')
  })

  it('desugar is identity (same reference) for every primitive spec', () => {
    const primitives: DataSpec[] = [
      { type: 'query', query: { measure: 'B1G' }, encoding: { label: 'time', value: 'value' } },
      { type: 'transform', source: [], steps: [], encoding: { label: 'time' } },
      { type: 'row-list', rows: [{ code: 'B1G' }] },
      { type: 'timeseries', code: 'B1G', years: 'all' },
      { type: 'growth', code: 'B1G', years: [2020, 2021] },
      { type: 'ratio-list', pairs: [{ code: 'D1', denom: 'B1G' }] },
      { type: 'custom', fn: 'myFn' },
    ]
    for (const p of primitives) expect(desugar(p)).toBe(p) // identity ⇒ untouched path
  })
})
