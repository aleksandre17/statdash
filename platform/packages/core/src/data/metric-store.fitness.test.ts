// ── M1 fitness — metric NAMES its store (Cube.dev dataSource) ──────────
//
//  Locks the M1 invariants from adr_multistore_storeid_reintroduction:
//    FF-METRIC-NAMES-STORE — a metric declaring `dataSource` routes a
//                            referencing node's spec to that storeKey; an
//                            explicit node storeKey overrides it (asserted in
//                            the react layer); a metric WITHOUT dataSource (and
//                            a raw code) falls through to undefined ⇒ the
//                            binding layer keeps the page/default store (no
//                            regression, byte-identical).
//    FF-CONFIG-ROUNDTRIP   — a metric carrying `dataSource` is pure JSON: it
//                            survives JSON.parse(JSON.stringify(def)) and no
//                            function ever appears in a metric/datasource config
//                            (Law 2).
//
//  resolveMeasureRef mutates a process-global registry; every metric id here is
//  `metric:`-prefixed so it can never collide with a raw SDMX code.
//
import { describe, it, expect, beforeEach } from 'vitest'

import { registerMetric, resolveMeasureRef } from './metric'
import type { MetricDef }                      from './metric'
import { specDataSource, specMeasureRefs }     from './metric-store'
import type { DataSpec }                        from '../config/data-spec'

beforeEach(() => {
  // gdp metric lives in the 'gdp' cube; regional metric lives in 'regional'.
  registerMetric('metric:gdp', {
    code:       'B1G',
    label:      { en: 'GDP' },
    dataSource: 'gdp',
  })
  registerMetric('metric:regional-gva', {
    code:       'B1G',
    label:      { en: 'Regional GVA' },
    dataSource: 'regional',
  })
  // A metric with NO dataSource — must fall through (no regression).
  registerMetric('metric:no-store', {
    code:  'D1',
    label: { en: 'Wages' },
  })
})

// ── FF-METRIC-NAMES-STORE ──────────────────────────────────────────────

describe('FF-METRIC-NAMES-STORE — a metric routes a referencing spec to its store', () => {
  it('resolveMeasureRef carries the metric-declared dataSource', () => {
    expect(resolveMeasureRef('metric:gdp').dataSource).toBe('gdp')
    expect(resolveMeasureRef('metric:regional-gva').dataSource).toBe('regional')
  })

  it('a raw code carries NO dataSource (byte-identical: falls through)', () => {
    expect(resolveMeasureRef('B1G').dataSource).toBeUndefined()
  })

  it('a metric without a dataSource carries undefined (no regression)', () => {
    expect(resolveMeasureRef('metric:no-store').dataSource).toBeUndefined()
  })

  it('a query spec referencing a metric routes to the metric store', () => {
    const spec: DataSpec = {
      type: 'query', query: { measure: 'metric:regional-gva' },
      encoding: { label: 'label', value: 'value' },
    }
    expect(specDataSource(spec)).toBe('regional')
  })

  it('a timeseries / growth / row-list / ratio-list spec all route via their refs', () => {
    expect(specDataSource({ type: 'timeseries', code: 'metric:gdp', years: [2023] })).toBe('gdp')
    expect(specDataSource({ type: 'growth', code: ['metric:gdp'], years: [2023] })).toBe('gdp')
    expect(specDataSource({ type: 'row-list', rows: [{ code: 'metric:regional-gva' }] })).toBe('regional')
    expect(specDataSource({ type: 'ratio-list',
      pairs: [{ code: 'metric:gdp', denom: 'B1G' }] })).toBe('gdp')
  })

  it('a spec with only raw codes routes to undefined (page/default store kept)', () => {
    expect(specDataSource({ type: 'timeseries', code: 'B1G', years: [2023] })).toBeUndefined()
    expect(specDataSource({ type: 'query', query: { measure: 'B1G' },
      encoding: { label: 'label', value: 'value' } })).toBeUndefined()
  })

  it('first metric-with-a-dataSource wins, deterministically (order-stable)', () => {
    // regional ref appears first ⇒ regional wins even though gdp also has a store.
    const spec: DataSpec = { type: 'growth',
      code: ['metric:regional-gva', 'metric:gdp'], years: [2023] }
    expect(specDataSource(spec)).toBe('regional')
  })

  it('by-mode unions every branch (ctx-independent routing)', () => {
    // raw-code branch first; the metric branch still contributes its store.
    const spec = {
      type: 'by-mode',
      modes: {
        year:  { type: 'timeseries', code: 'B1G',        years: [2023] },
        range: { type: 'timeseries', code: 'metric:gdp', years: [2023] },
      },
    } as DataSpec
    expect(specDataSource(spec)).toBe('gdp')
  })

  it('specMeasureRefs enumerates raw + metric refs in deterministic order', () => {
    expect(specMeasureRefs({ type: 'ratio-list',
      pairs: [{ code: 'metric:gdp', denom: 'B1G' }] })).toEqual(['metric:gdp', 'B1G'])
    expect(specMeasureRefs({ type: 'row-list',
      rows: [{ code: 'A', pctOf: 'B' }, { code: 'C' }] })).toEqual(['A', 'B', 'C'])
  })

  it('pivot / transform / custom specs carry no measure refs ⇒ no store', () => {
    expect(specDataSource({ type: 'custom', fn: 'x' })).toBeUndefined()
    expect(specMeasureRefs({ type: 'transform', source: [], steps: [],
      encoding: { label: 'l', value: 'v' } })).toEqual([])
  })
})

// ── FF-CONFIG-ROUNDTRIP ────────────────────────────────────────────────

describe('FF-CONFIG-ROUNDTRIP — dataSource is pure JSON (Law 2)', () => {
  it('a MetricDef with dataSource survives JSON round-trip unchanged', () => {
    const def: MetricDef = {
      code: 'B1G', label: { en: 'GDP' }, dataSource: 'gdp', dims: { adjustment: 'S' },
    }
    expect(JSON.parse(JSON.stringify(def))).toEqual(def)
  })

  it('no function ever appears on a metric config (declarative-only)', () => {
    const def: MetricDef = { code: 'B1G', label: { en: 'GDP' }, dataSource: 'gdp' }
    for (const v of Object.values(def as unknown as Record<string, unknown>)) {
      expect(typeof v).not.toBe('function')
    }
  })
})
