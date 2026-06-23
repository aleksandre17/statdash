import { describe, it, expect } from 'vitest'
import type { PropField } from '@statdash/react/engine'
import { isVisible } from './showWhen'
import { validateField } from './validateField'
import { readLocale, writeLocale } from './localeString'
import { orderLocales } from './useActiveLocales'

describe('showWhen — safe conditional visibility (no eval)', () => {
  it('shows when no condition is set', () => {
    expect(isVisible(undefined, {})).toBe(true)
  })
  it('matches a quoted equality', () => {
    expect(isVisible("chartType === 'bar'", { chartType: 'bar' })).toBe(true)
    expect(isVisible("chartType === 'bar'", { chartType: 'line' })).toBe(false)
  })
  it('reads dot-paths', () => {
    expect(isVisible('view.width === full', { view: { width: 'full' } })).toBe(true)
  })
  it('treats an unparseable condition as visible (Postel)', () => {
    expect(isVisible('weird && expr', { a: 1 })).toBe(true)
  })
})

describe('validateField — schema-driven validation', () => {
  const f = (over: Partial<PropField>): PropField =>
    ({ field: 'x', type: 'string', label: 'X', ...over })

  it('flags an empty required field', () => {
    expect(validateField(f({ required: true }), '')).toBe('Required')
    expect(validateField(f({ required: true }), undefined)).toBe('Required')
  })
  it('passes a filled required field', () => {
    expect(validateField(f({ required: true }), 'hi')).toBeNull()
  })
  it('enforces number min/max', () => {
    const nf = f({ type: 'number', validation: { min: 1, max: 5 } })
    expect(validateField(nf, 0)).toBe('Must be ≥ 1')
    expect(validateField(nf, 9)).toBe('Must be ≤ 5')
    expect(validateField(nf, 3)).toBeNull()
  })
  it('enforces a string pattern, fail-soft on a bad pattern', () => {
    expect(validateField(f({ validation: { pattern: '^\\d+$' } }), 'abc')).toBe('Invalid format')
    expect(validateField(f({ validation: { pattern: '(' } }), 'abc')).toBeNull()
  })
})

describe('localeString — complete-record authoring', () => {
  it('reads a locale, tolerating the plain-string form', () => {
    expect(readLocale({ ka: 'გ', en: 'g' }, 'en')).toBe('g')
    expect(readLocale('legacy', 'en')).toBe('legacy')
    expect(readLocale(undefined, 'ka')).toBe('')
  })
  it('writes a COMPLETE record across all active locales', () => {
    const next = writeLocale(undefined, 'en', 'hello', ['ka', 'en'])
    expect(next).toEqual({ ka: '', en: 'hello' })
  })
  it('lifts a legacy plain string into every locale before overriding', () => {
    const next = writeLocale('old', 'en', 'new', ['ka', 'en'])
    expect(next).toEqual({ ka: 'old', en: 'new' })
  })
  it('preserves other-locale values on edit', () => {
    const next = writeLocale({ ka: 'გამარჯობა', en: 'hi' }, 'en', 'hello', ['ka', 'en'])
    expect(next).toEqual({ ka: 'გამარჯობა', en: 'hello' })
  })
})

describe('orderLocales — default-first ordering', () => {
  it('puts the site default first', () => {
    expect(orderLocales('en')).toEqual(['en', 'ka'])
    expect(orderLocales('ka')).toEqual(['ka', 'en'])
  })
})
