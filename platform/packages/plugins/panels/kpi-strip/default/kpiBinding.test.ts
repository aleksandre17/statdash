// ── kpiBinding — the static bound/unbound predicate contract (W1 · Canon C2) ────
//
//  Locks the ONE rule the honest-state render depends on: a card is "bound" iff every
//  measure the interpreter would read is a chosen (non-empty) ref. Mirrors core
//  resolveValue's per-kind reads, so "unbound" here ≡ "would lower to a fake 0" there.
//
import { describe, it, expect } from 'vitest'
import type { KpiSpec } from '@statdash/engine'
import { isKpiSpecBound } from './kpiBinding'

const spec = (value: unknown): KpiSpec =>
  ({ id: 'k', label: 'L', color: '', value } as unknown as KpiSpec)

describe('isKpiSpecBound — static binding predicate', () => {
  it('point/yoy/cagr/mean are bound iff measure is chosen', () => {
    for (const type of ['point', 'yoy', 'cagr', 'mean'] as const) {
      expect(isKpiSpecBound(spec({ type, measure: 'gdp.current' }))).toBe(true)
      expect(isKpiSpecBound(spec({ type, measure: '' }))).toBe(false)
      expect(isKpiSpecBound(spec({ type, measure: '   ' }))).toBe(false)
    }
  })

  it('share needs BOTH num and denom measures chosen', () => {
    expect(isKpiSpecBound(spec({ type: 'share', num: { measure: 'a' }, denom: { measure: 'b' } }))).toBe(true)
    expect(isKpiSpecBound(spec({ type: 'share', num: { measure: 'a' }, denom: { measure: '' } }))).toBe(false)
    expect(isKpiSpecBound(spec({ type: 'share', num: { measure: '' }, denom: { measure: 'b' } }))).toBe(false)
  })

  it('expr needs a non-empty codes list with every code chosen', () => {
    expect(isKpiSpecBound(spec({ type: 'expr', op: 'add', codes: ['a', 'b'], format: 'pct' }))).toBe(true)
    expect(isKpiSpecBound(spec({ type: 'expr', op: 'add', codes: [], format: 'pct' }))).toBe(false)
    expect(isKpiSpecBound(spec({ type: 'expr', op: 'add', codes: ['a', ''], format: 'pct' }))).toBe(false)
  })

  it('metric is bound iff the metric id is chosen', () => {
    expect(isKpiSpecBound(spec({ type: 'metric', metric: 'gdp-share' }))).toBe(true)
    expect(isKpiSpecBound(spec({ type: 'metric', metric: '' }))).toBe(false)
  })

  it('a missing / malformed value is unbound (never a readable measure)', () => {
    expect(isKpiSpecBound(spec(undefined))).toBe(false)
    expect(isKpiSpecBound(spec({}))).toBe(false)
    expect(isKpiSpecBound(spec({ type: 'nonsense' }))).toBe(false)
  })
})
