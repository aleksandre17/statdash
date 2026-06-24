// ── P3-1: Constructor round-trip — DataSpec (all branches) ───────────────────
//
//  Covers: all 8 DataSpec discriminant branches, $ctx refs, $ne refs, pipe steps.
//
//  WHY: Constructor (Phase 2) serializes DataSpec to JSON for storage.  A single
//  branch with a non-serializable value (function, class instance) would silently
//  break that branch's data pipeline on deserialize.  This test catches it early.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { DataSpec }        from './data-spec'

function roundTrip<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }

function expectRoundTrip<T>(v: T): void { expect(roundTrip(v)).toEqual(v) }

// ── query branch ──────────────────────────────────────────────────────────────

describe('DataSpec query — round-trip', () => {

  it('minimal (no pipe)', () => expectRoundTrip<DataSpec>({
    type:     'query',
    query:    { measure: 'B1G', filter: { geo: { $ctx: 'geo' } } },
    encoding: { label: 'time', value: 'value' },
  }))

  it('full — pipe + rowLimit + fromDim + toDim', () => expectRoundTrip<DataSpec>({
    type:     'query',
    query:    { measure: ['B1G', 'D1'], filter: { geo: 'GE' }, orderBy: { field: 'time', dir: 'desc' } },
    pipe:     [
      { op: 'sort',   by: 'time', dir: 'asc' },
      { op: 'filter', where: { value: [0, 1, 2] } },
    ],
    encoding: { label: 'time', value: 'value', series: 'measure' },
    fromDim:  'time',
    toDim:    'time',
    rowLimit: 50,
  }))

  it('$ctx ref in filter preserved as literal (not resolved)', () => {
    const spec: DataSpec = {
      type:     'query',
      query:    { measure: 'B1G', filter: { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } } },
      encoding: { label: 'time' },
    }
    expectRoundTrip(spec)
    const result = roundTrip(spec) as typeof spec & { query: { filter: Record<string, unknown> } }
    expect(result.query.filter?.['geo']).toEqual({ $ctx: 'geo' })
    expect(result.query.filter?.['time']).toEqual({ $ctx: 'time' })
  })

  it('$ne filter ref preserved', () => expectRoundTrip<DataSpec>({
    type:     'query',
    query:    { measure: 'B1G', filter: { sector: { $ne: '_T' } } },
    encoding: { label: 'sector' },
  }))

  it('$ne+$ctx compound ref preserved', () => expectRoundTrip<DataSpec>({
    type:     'query',
    query:    { measure: 'D1', filter: { sector: { $ne: '_T', $ctx: 'sector' } } },
    encoding: { label: 'sector', value: 'value' },
  }))

})

// ── row-list branch ───────────────────────────────────────────────────────────

describe('DataSpec row-list — round-trip', () => {

  it('with all RowSpec fields', () => expectRoundTrip<DataSpec>({
    type: 'row-list',
    rows: [
      { code: 'B1G',   label: { ka: 'მშპ',    en: 'GDP'    }, color: '#1f77b4', isTotal: true },
      { code: 'D1',    label: { ka: 'ხელფასი', en: 'Wages'  }, negate: false },
      { code: 'B2A3G', label: { ka: 'მოგება',  en: 'Profit' }, pctOf: 'B1G' },
    ],
  }))

})

// ── timeseries branch ─────────────────────────────────────────────────────────

describe('DataSpec timeseries — round-trip', () => {

  it('explicit years', () => expectRoundTrip<DataSpec>({
    type: 'timeseries', code: 'B1G', years: [2020, 2021, 2022, 2023],
  }))

  it('"all" sentinel preserved as string', () => {
    const spec: DataSpec = { type: 'timeseries', code: 'B1G', years: 'all' }
    expectRoundTrip(spec)
    expect(roundTrip(spec).years).toBe('all')
  })

  it('with fromDim + toDim', () => expectRoundTrip<DataSpec>({
    type: 'timeseries', code: 'D1', years: [2018, 2019, 2020], fromDim: 'startYear', toDim: 'endYear',
  }))

})

// ── growth branch ─────────────────────────────────────────────────────────────

describe('DataSpec growth — round-trip', () => {

  it('single code', () => expectRoundTrip<DataSpec>({
    type: 'growth', code: 'B1G', years: [2021, 2022, 2023],
  }))

  it('multi-code array', () => {
    const spec: DataSpec = { type: 'growth', code: ['B1G', 'D1', 'B2A3G'], years: 'all' }
    expectRoundTrip(spec)
    expect(roundTrip(spec).type).toBe('growth')
  })

})

// ── remaining branches ────────────────────────────────────────────────────────

describe('DataSpec ratio-list / by-mode / pivot / transform / custom — round-trip', () => {

  it('ratio-list with pipe', () => expectRoundTrip<DataSpec>({
    type:  'ratio-list',
    pairs: [
      { code: 'D1', denom: 'B1G', label: 'Wage share' },
      { code: 'B2A3G', denom: 'B1G' },
    ],
    pipe: [{ op: 'sort', by: 'value', dir: 'desc' }],
  }))

  it('by-mode — branches on timeMode', () => expectRoundTrip<DataSpec>({
    type:  'by-mode',
    modes: {
      year:  { type: 'row-list', rows: [{ code: 'B1G' }] },
      range: { type: 'timeseries', code: 'B1G', years: 'all' },
    },
  }))

  it('pivot — wide→long shorthand', () => expectRoundTrip<DataSpec>({
    type:        'pivot',
    rows:        [{ geo: 'GE', measure: 'B1G' }, { geo: 'AM', measure: 'B1G' }],
    keyField:    'geo',
    valueFields: ['value'],
    colors:      { GE: '#e84393', AM: '#f5a623' },
  }))

  it('transform — full declarative pipeline', () => expectRoundTrip<DataSpec>({
    type:     'transform',
    source:   [{ measure: 'B1G', value: 1000, time: 2023 }],
    steps:    [
      { op: 'rename', fields: { time: 'year' } },
      { op: 'derive', as: 'share', expr: { op: 'div', a: { op: 'field', field: 'value' }, b: { op: 'literal', value: 1000 } } },
    ],
    encoding: { label: 'year', value: 'value' },
  }))

  it('custom — fn reference + params', () => expectRoundTrip<DataSpec>({
    type:   'custom',
    fn:     'myCustomResolver',
    params: { indicator: 'B1G', base: 2020 },
  }))

  it('JSON.stringify does not throw on any DataSpec branch', () => {
    const specs: DataSpec[] = [
      { type: 'query',      query: { measure: 'B1G' }, encoding: { label: 'time' } },
      { type: 'row-list',   rows: [{ code: 'B1G' }] },
      { type: 'timeseries', code: 'B1G', years: 'all' },
      { type: 'growth',     code: 'B1G', years: [2020, 2021] },
      { type: 'ratio-list', pairs: [{ code: 'D1', denom: 'B1G' }] },
      { type: 'by-mode',    modes: { year: { type: 'row-list', rows: [] }, range: { type: 'timeseries', code: 'B1G', years: 'all' } } },
      { type: 'pivot',      rows: [], keyField: 'geo', valueFields: ['value'] },
      { type: 'transform',  source: [], steps: [], encoding: { label: 'time' } },
      { type: 'custom',     fn: 'myFn' },
    ]
    specs.forEach(spec => expect(() => JSON.stringify(spec)).not.toThrow())
  })

})
