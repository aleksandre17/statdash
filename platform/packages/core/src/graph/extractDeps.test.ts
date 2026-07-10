// ── extractDeps — unit + representative-totality tests [AR-49 V1] ─────────────
//
//  Proves the analyzer computes the TOTAL dependency set across every axis and
//  every DataSpec discriminant, incl. the tricky shapes (query+pipe+encoding refs,
//  growth/timeseries time-binding, transform+blend cross-store, vars expr refs,
//  visibility params+perspective, template tokens + LocaleString + perspective
//  carrier). The corpus-scale totality FF (a planted hidden dep is caught) lives in
//  extractDeps.fitness.test.ts; the provisioning-corpus scan + baseline in apps/api.

import { describe, it, expect } from 'vitest'
import { extractDeps, type DepNode } from './extractDeps'
import { registerMetric } from '../data/metric'
import type { SectionContext } from '../core/context'

const arr = (s: ReadonlySet<string>) => [...s].sort()

describe('extractDeps — DataSpec dim/measure/store axes', () => {
  it('query: $ctx filter → dims, encoding $ctx → dims+vars, pipe $ctx, measures', () => {
    const node: DepNode = {
      type: 'chart',
      data: {
        type: 'query',
        query: { measure: ['GVA', 'GDP'], filter: { geo: { $ctx: 'geo' }, approach: 'PROD' } },
        pipe: [{ op: 'aggregate', by: { $ctx: '_byDims' }, measure: 'value', agg: 'sum' }],
        encoding: { label: 'sector', series: { $ctx: '_xDim' } },
      },
    }
    const d = extractDeps(node)
    expect(arr(d.dims)).toContain('geo')            // $ctx filter value → state edge
    expect(d.dims.has('approach')).toBe(false)      // literal pin is a CONSTANT, not a state edge
    expect(arr(d.dims)).toContain('_xDim')          // encoding $ctx (dims-first)
    expect(arr(d.vars)).toContain('_xDim')          // …vars-fallback edge
    expect(arr(d.vars)).toContain('_byDims')        // pipe aggregate.by $ctx (var)
    expect(arr(d.measures)).toEqual(['GDP', 'GVA'])
  })

  it('timeseries: TIME_DIM + fromDim/toDim dim keys', () => {
    const d = extractDeps({
      type: 'chart',
      data: { type: 'timeseries', code: 'GDP', years: 'all', fromDim: 'fromYear', toDim: 'toYear' },
    })
    expect(arr(d.dims)).toEqual(['fromYear', 'time', 'toYear'])
    expect(arr(d.measures)).toEqual(['GDP'])
  })

  it('growth (multi-code) is time-bound + carries all codes', () => {
    const d = extractDeps({ type: 'chart', data: { type: 'growth', code: ['GDP', 'GVA'], years: 'all' } })
    expect(d.dims.has('time')).toBe(true)
    expect(arr(d.measures)).toEqual(['GDP', 'GVA'])
  })

  it('pivot / transform (inline data) → NO store dims/measures', () => {
    const pivot = extractDeps({ type: 'table', data: { type: 'pivot', rows: [{ a: 1 }], keyField: 'a', valueFields: ['v'] } })
    expect(pivot.dims.size).toBe(0)
    expect(pivot.measures.size).toBe(0)
    const tf = extractDeps({
      type: 'table',
      data: { type: 'transform', source: [{ a: 1 }], steps: [{ op: 'filter', where: { a: { $ctx: 'geo' } } }], encoding: { label: 'a' } },
    })
    expect(tf.dims.has('geo')).toBe(true) // transform step $ctx IS a dep
  })

  it('transform + blend → secondary store + secondary measures', () => {
    const d = extractDeps({
      type: 'table',
      data: {
        type: 'query', query: { measure: 'GVA' }, encoding: { label: 'geo' },
        pipe: [{ op: 'blend', by: 'geo', from: { storeKey: 'population', query: { measure: 'POP', filter: { year: { $ctx: 'time' } } } } }],
      },
    })
    expect(d.stores.has('population')).toBe(true)
    expect(d.measures.has('POP')).toBe(true)
    expect(d.dims.has('time')).toBe(true) // blend secondary filter $ctx
  })
})

describe('extractDeps — metric → store routing', () => {
  it('a referenced metric.dataSource → stores', () => {
    registerMetric('labour_share', { code: 'LS', label: { en: 'Labour share' }, dataSource: 'sna_annual' })
    const d = extractDeps({ type: 'kpi', data: { type: 'timeseries', code: 'labour_share', years: 'all' } })
    expect(d.stores.has('sna_annual')).toBe(true)
    expect(d.measures.has('labour_share')).toBe(true)
  })

  it('explicit node.storeKey → stores', () => {
    const d = extractDeps({ type: 'chart', storeKey: 'quarterly', data: { type: 'timeseries', code: 'GDP', years: 'all' } })
    expect(d.stores.has('quarterly')).toBe(true)
  })
})

describe('extractDeps — visibility params + perspective', () => {
  it('visibleWhen eq/isset → params; nested and/not recurse', () => {
    const d = extractDeps({
      type: 'section',
      view: { visibleWhen: { op: 'and', exprs: [{ op: 'eq', param: 'geo', is: 'GE-TB' }, { op: 'not', expr: { op: 'isset', param: 'sector' } }] } },
    })
    expect(arr(d.params)).toEqual(['geo', 'sector'])
  })

  it('perspective-is (param-less → conventional axis) + explicit param', () => {
    const conv = extractDeps({ type: 'section', view: { visibleWhen: { op: 'perspective-is', perspective: 'range' } } })
    expect(conv.perspective.has('perspective')).toBe(true)
    const axis = extractDeps({ type: 'section', view: { visibleWhen: { op: 'perspective-in', perspectives: ['a'], param: 'view2' } } })
    expect(axis.perspective.has('view2')).toBe(true)
  })
})

describe('extractDeps — vars (expr-layer scope split)', () => {
  it('vars expr $ctx → params (filterParams), $derived → vars', () => {
    const d = extractDeps({
      type: 'section',
      vars: {
        _regionSel: { $ctx: 'geo' },                                   // $ctx binds filterParams here
        _label:     { op: 'concat', values: [{ $derived: '_regionSel' }, { $literal: '!' }] },
      },
    })
    expect(d.params.has('geo')).toBe(true)   // NOT dims — expr-layer $ctx == filter param
    expect(d.vars.has('_regionSel')).toBe(true)
  })
})

describe('extractDeps — display: locale, template tokens, perspective carrier', () => {
  it('LocaleString display field → locale', () => {
    const d = extractDeps({ type: 'section', title: { en: 'Regions', ka: 'რეგიონები' } })
    expect(d.locale).toBe(true)
  })

  it('template {token} in a display string → dims', () => {
    const d = extractDeps({ type: 'section', subtitle: '{time} · {geo}' })
    expect(arr(d.dims)).toEqual(['geo', 'time'])
  })

  it('perspective carrier (keys ⊇ perspectiveIds) → perspective + locale', () => {
    const carrier = { title: { year: { en: 'Year' }, range: { en: 'Range' } } }
    const d = extractDeps({ type: 'section', ...carrier }, { perspectiveIds: ['year', 'range'] })
    expect(d.perspective.has('perspective')).toBe(true)
    expect(d.locale).toBe(true)
  })

  it('does NOT descend into child-node subtrees (separate renderables)', () => {
    const d = extractDeps({
      type: 'section',
      title: { en: 'Parent' },
      children: [{ type: 'chart', data: { type: 'timeseries', code: 'CHILD', years: 'all' } }],
    })
    expect(d.measures.has('CHILD')).toBe(false) // the child owns its own edge set
  })
})

describe('extractDeps — concrete requirements (warm plan)', () => {
  const ctx: SectionContext = { dims: { time: 2024, geo: 'GE-TB' } }
  it('supplies (code × dims) requirements when a SectionContext is given', () => {
    const d = extractDeps({ type: 'kpi', data: { type: 'timeseries', code: 'GDP', years: [2024] } }, { section: ctx })
    expect(d.requirements.length).toBeGreaterThan(0)
    expect(d.requirements.every((r) => r.code === 'GDP')).toBe(true)
  })
  it('no SectionContext → structural deps only, requirements empty', () => {
    const d = extractDeps({ type: 'kpi', data: { type: 'timeseries', code: 'GDP', years: [2024] } })
    expect(d.requirements.length).toBe(0)
    expect(d.dims.has('time')).toBe(true) // structural axis still present
  })
})
