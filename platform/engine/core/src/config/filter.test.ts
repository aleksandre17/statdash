import { describe, it, expect } from 'vitest'
import { evalCondition, evalWhen } from './filter'

// ── evalCondition ─────────────────────────────────────────────────────

describe('evalCondition', () => {
  it('string shorthand — equality check', () => {
    expect(evalCondition('year', 'year')).toBe(true)
    expect(evalCondition('year', 'range')).toBe(false)
  })

  it('{ eq } — strict equality', () => {
    expect(evalCondition({ eq: 'year' }, 'year')).toBe(true)
    expect(evalCondition({ eq: 'year' }, 'range')).toBe(false)
  })

  it('{ neq } — not equal', () => {
    expect(evalCondition({ neq: 'range' }, 'year')).toBe(true)
    expect(evalCondition({ neq: 'range' }, 'range')).toBe(false)
  })

  it('{ in } — value is in the set', () => {
    expect(evalCondition({ in: ['year', 'range'] }, 'year')).toBe(true)
    expect(evalCondition({ in: ['year', 'range'] }, 'compare')).toBe(false)
  })

  it('{ nin } — value is not in the set', () => {
    expect(evalCondition({ nin: ['year', 'range'] }, 'compare')).toBe(true)
    expect(evalCondition({ nin: ['year', 'range'] }, 'year')).toBe(false)
  })

  it('{ truthy } — non-empty string is truthy', () => {
    expect(evalCondition({ truthy: true }, 'GE')).toBe(true)
    expect(evalCondition({ truthy: true }, '')).toBe(false)
  })

  it('{ falsy } — empty string is falsy', () => {
    expect(evalCondition({ falsy: true }, '')).toBe(true)
    expect(evalCondition({ falsy: true }, 'GE')).toBe(false)
  })
})

// ── evalWhen ──────────────────────────────────────────────────────────

describe('evalWhen', () => {
  it('true when all conditions pass', () => {
    const state = { mode: 'year', geo: 'GE' }
    expect(evalWhen({ mode: 'year', geo: 'GE' }, state)).toBe(true)
  })

  it('false when any condition fails', () => {
    const state = { mode: 'year', geo: 'GE' }
    expect(evalWhen({ mode: 'year', geo: 'TB' }, state)).toBe(false)
  })

  it('AND semantics — all keys must match', () => {
    const state = { mode: 'range', geo: 'GE' }
    expect(evalWhen({ mode: { neq: 'range' }, geo: 'GE' }, state)).toBe(false)
  })

  it('missing key treated as empty string', () => {
    expect(evalWhen({ mode: { falsy: true } }, {})).toBe(true)
    expect(evalWhen({ mode: { truthy: true } }, {})).toBe(false)
  })

  it('empty WhenMap — always true', () => {
    expect(evalWhen({}, {})).toBe(true)
    expect(evalWhen({}, { mode: 'year', geo: 'GE' })).toBe(true)
  })

  it('works with { neq } condition across state keys', () => {
    const state = { mode: 'year' }
    expect(evalWhen({ mode: { neq: 'range' } }, state)).toBe(true)
    expect(evalWhen({ mode: { neq: 'year'  } }, state)).toBe(false)
  })
})