// ── FF-NO-SUM-OF-RATIO — a non-additive measure may never be summed [AR-50 M2] ───
//
//  The scientific-integrity gate of the national-accounts platform: a NON-ADDITIVE
//  measure (a ratio — deflator, share, GDP-per-capita) must NEVER be aggregated by a
//  summing reducer. It is re-derived from its `calc` at the target grain instead. This
//  fitness function is the EXECUTABLE gate (not a comment): it fails if the guard ever
//  lets a non-additive measure reach a `sum`.
//
//  It also pins the additivity CLASSIFICATION (explicit field wins; conservative
//  structural default otherwise) and the DAX semi-additive per-axis rollup selection.
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { registerMetric, effectiveAdditivity, defaultAdditivity, getMetric, ADDITIVITY_VALUES } from './metric'
import { guardNoSumOfRatio, rollupForAxis, isSummingOp, NonAdditiveSumError } from './metric-grain'
import type { Expr } from '@statdash/expr'

const RATIO: Expr = { op: 'div', left: { $derived: 'a' }, right: { $derived: 'b' } }

beforeEach(() => {
  // A raw stock/flow ⇒ additive; a ratio/derived ⇒ non-additive (conservative default).
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })
  registerMetric('deflator', {
    label: { en: 'GDP deflator' },
    calc: { inputs: { a: { measure: 'gdp_nominal' }, b: { measure: 'gdp_real' } }, expr: RATIO },
  })
  // A stock, EXPLICITLY classified semi-additive (sum over geo, last over time — DAX).
  registerMetric('population', {
    code: 'POP', label: { en: 'Population' },
    additivity: 'semi-additive',
    semiAdditive: { additiveOver: ['geo'], nonAdditiveOp: 'last' },
  })
  // A base measure the author EXPLICITLY marks non-additive with NO calc (cannot aggregate).
  registerMetric('raw_share', { code: 'SHARE', label: { en: 'Raw share' }, additivity: 'non-additive' })
})

describe('additivity classification — explicit wins, else conservative structural default', () => {
  it('a raw stock/flow (base metric) defaults to additive', () => {
    expect(effectiveAdditivity(getMetric('gdp'))).toBe('additive')
    expect(defaultAdditivity(getMetric('gdp')!)).toBe('additive')
  })

  it('a ratio/derived (calc) metric defaults to non-additive', () => {
    expect(effectiveAdditivity(getMetric('deflator'))).toBe('non-additive')
    expect(defaultAdditivity(getMetric('deflator')!)).toBe('non-additive')
  })

  it('an explicit additivity field overrides the structural default', () => {
    expect(effectiveAdditivity(getMetric('population'))).toBe('semi-additive')
    expect(effectiveAdditivity(getMetric('raw_share'))).toBe('non-additive')
  })

  it('an unregistered raw code is additive (a raw store code sums exactly as before)', () => {
    expect(effectiveAdditivity(getMetric('NOT_A_METRIC'))).toBe('additive')
    expect(effectiveAdditivity(undefined)).toBe('additive')
  })

  it('the SSOT tuple enumerates every class (a picker sources FROM here — Law 8)', () => {
    expect([...ADDITIVITY_VALUES]).toEqual(['additive', 'semi-additive', 'non-additive'])
  })
})

describe('FF-NO-SUM-OF-RATIO — the executable guard', () => {
  it('THROWS when a non-additive measure meets a summing reducer', () => {
    expect(() => guardNoSumOfRatio('deflator', 'sum')).toThrow(NonAdditiveSumError)
    expect(() => guardNoSumOfRatio('raw_share', 'sum')).toThrow(/FF-NO-SUM-OF-RATIO/)
  })

  it('PASSES an additive or semi-additive measure summed (both are legitimately summable)', () => {
    expect(() => guardNoSumOfRatio('gdp', 'sum')).not.toThrow()
    expect(() => guardNoSumOfRatio('population', 'sum')).not.toThrow() // sum over its additive axis
  })

  it('PASSES an unregistered raw code (raw-code path stays byte-identical)', () => {
    expect(() => guardNoSumOfRatio('SOME_RAW_CODE', 'sum')).not.toThrow()
  })

  it('does not fire on a NON-summing reducer (only summation is the ratio falsehood)', () => {
    expect(isSummingOp('sum')).toBe(true)
    for (const op of ['avg', 'min', 'max', 'first', 'last'] as const) {
      expect(isSummingOp(op)).toBe(false)
      expect(() => guardNoSumOfRatio('deflator', op)).not.toThrow()
    }
  })
})

describe('rollupForAxis — DAX semi-additive per-axis reducer selection', () => {
  it('additive → sum on every axis', () => {
    const m = getMetric('gdp')
    expect(rollupForAxis(m, 'geo')).toBe('sum')
    expect(rollupForAxis(m, 'time')).toBe('sum')
  })

  it('semi-additive → sum over the declared additive axis, last over the rest (stock over time)', () => {
    const m = getMetric('population')
    expect(rollupForAxis(m, 'geo')).toBe('sum')   // additiveOver
    expect(rollupForAxis(m, 'time')).toBe('last') // nonAdditiveOp — DAX LASTNONBLANK
  })

  it('non-additive → refuses (it re-derives from calc; a rollup call is the FF violation)', () => {
    expect(() => rollupForAxis(getMetric('deflator'), 'time', 'deflator')).toThrow(NonAdditiveSumError)
  })
})
