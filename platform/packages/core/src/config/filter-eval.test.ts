// ── filter-eval — time-range readiness guards (ADR adr_time_range_readiness_seam) ──
//
//  FF-NO-ZERO-TIME (parse half) — autoParse('year-select', '') returns a no-value
//    sentinel ('' ), NEVER 0, so an unresolved year is ABSENT from ctx.dims.
//  FF-YEAR-DEFAULT-LATEST — resolveDefaults with classifiers['time']=[2015…2025]
//    and a year-select {from:'options',pick:'last'} yields dims['year']='2025'.

import { describe, it, expect } from 'vitest'
import { autoParse, resolveDefaults } from './filter-eval'
import type { ParamDef, ParamYearSelect } from './filter-params'
import type { EngineRow } from '../data/encoding'

// ── FF-NO-ZERO-TIME (parse half) ──────────────────────────────────────────────

describe('FF-NO-ZERO-TIME — autoParse year-select never coerces to 0', () => {
  const yearDef: ParamYearSelect = { type: 'year-select', default: { from: 'options', pick: 'last' } }

  it.each([
    ['empty string', ''],
    ['non-numeric',  'abc'],
  ])('returns the "" sentinel (not 0) for %s', (_label, raw) => {
    const parsed = autoParse(yearDef, raw)
    expect(parsed).toBe('')
    expect(parsed).not.toBe(0)
  })

  it('parses a real numeric year to a number', () => {
    expect(autoParse(yearDef, '2025')).toBe(2025)
  })
})

// ── FF-YEAR-DEFAULT-LATEST ─────────────────────────────────────────────────────

describe('FF-YEAR-DEFAULT-LATEST — pick:last resolves to the max year', () => {
  // The time classifier as the store-builder folds it: ascending {code} list.
  const timeClassifier = ['2015', '2016', '2017', '2024', '2025'].map((code) => ({ code }))

  // getOptions mirrors useFilterState: year-select reads classifiers['time'].
  const getOptions = (key: string): EngineRow[] | null =>
    key === 'year' ? timeClassifier.map((e) => ({ code: e.code }) as EngineRow) : null

  it('resolves dims.year to the latest classifier period', () => {
    const params: Array<{ key: string; def: ParamDef }> = [
      { key: 'year', def: { type: 'year-select', default: { from: 'options', pick: 'last' } } },
    ]
    const { dims, pendingKeys } = resolveDefaults(params, {}, getOptions)
    expect(dims['year']).toBe('2025')
    expect(pendingKeys).toEqual([])
  })

  it('resolves pick:first to the earliest period', () => {
    const params: Array<{ key: string; def: ParamDef }> = [
      { key: 'year', def: { type: 'year-select', default: { from: 'options', pick: 'first' } } },
    ]
    const { dims } = resolveDefaults(params, {}, getOptions)
    expect(dims['year']).toBe('2015')
  })

  it('degraded: empty time classifier → dims.year is "" (absent), never 0, not pending', () => {
    const params: Array<{ key: string; def: ParamDef }> = [
      { key: 'year', def: { type: 'year-select', default: { from: 'options', pick: 'last' } } },
    ]
    // getOptions returns [] (classifier absent/empty) — NOT null (which would pend).
    const { dims, pendingKeys } = resolveDefaults(params, {}, () => [])
    expect(dims['year']).toBe('')
    expect(dims['year']).not.toBe('0')
    expect(pendingKeys).toEqual([])
  })
})
