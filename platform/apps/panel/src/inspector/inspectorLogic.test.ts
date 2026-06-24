import { describe, it, expect } from 'vitest'
import type { PropField } from '@statdash/react/engine'
import { isVisible, getAtPath, setAtPath } from './showWhen'
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

describe('setAtPath — immutable dual of getAtPath', () => {
  it('writes a top-level field (the prior shallow-merge behavior, preserved)', () => {
    const before = { a: 1, b: 2 }
    const after  = setAtPath(before, 'b', 9)
    expect(after).toEqual({ a: 1, b: 9 })
    expect(before).toEqual({ a: 1, b: 2 })   // input untouched (immutable)
  })

  it('writes a nested dotted path and ONLY that path', () => {
    const before = { view: { width: 'full', height: 10 }, title: 't' }
    const after  = setAtPath(before, 'view.width', 'half')
    expect(getAtPath(after, 'view.width')).toBe('half')
    expect(getAtPath(after, 'view.height')).toBe(10)   // sibling key preserved
    expect(getAtPath(after, 'title')).toBe('t')        // sibling branch preserved
  })

  it('is the exact dual of getAtPath (read back what was written)', () => {
    const after = setAtPath({}, 'a.b.c', 42)
    expect(getAtPath(after, 'a.b.c')).toBe(42)
  })

  it('shares untouched branches by reference (structural sharing)', () => {
    const before = { view: { width: 'full' }, sibling: { x: 1 } }
    const after  = setAtPath(before, 'view.width', 'half')
    expect(after).not.toBe(before)                 // root cloned
    expect(after.view).not.toBe(before.view)       // touched branch cloned
    expect(after.sibling).toBe(before.sibling)     // untouched branch shared
  })

  it('creates intermediate object containers on demand', () => {
    const after = setAtPath({} as Record<string, unknown>, 'a.b.c', 1)
    expect(after).toEqual({ a: { b: { c: 1 } } })
  })

  it('writes an array-index segment positionally', () => {
    const before = { items: [{ v: 1 }, { v: 2 }] }
    const after  = setAtPath(before, 'items.1.v', 99)
    expect(after.items[1].v).toBe(99)
    expect(after.items[0]).toBe(before.items[0])   // untouched element shared
    expect(Array.isArray(after.items)).toBe(true)
    expect(before.items[1].v).toBe(2)              // input untouched
  })

  it('creates an array intermediate when the segment is a numeric index', () => {
    const after = setAtPath({} as Record<string, unknown>, 'items.0.label', 'x')
    expect(Array.isArray((after as { items: unknown }).items)).toBe(true)
    expect(getAtPath(after, 'items.0.label')).toBe('x')
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
