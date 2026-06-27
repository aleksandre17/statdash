import { describe, it, expect } from 'vitest'
import { tagLocaleString, isTaggedLocaleString, resolveLocaleString, composeLocale, localeKeysOf } from './types'
import { applyTemplate, applyConcat } from '../data/transform/steps'
import { resolveOptions } from '../data/resolve'
import type { DataStore } from '../data/store'

// ── The i18n COMPOSITION boundary (GAP 5b) ────────────────────────────────────
//
//  A pipeline step / option resolver that combines or carries a label MUST keep a
//  bilingual LocaleString resolvable at the React boundary — it must NEVER String()-
//  flatten it to "[object Object]" in this locale-agnostic layer. These tests pin the
//  class shut: a tagged {en,ka} survives template/concat/resolveOptions as a tagged
//  LocaleString (resolvable per locale), while all-scalar inputs stay byte-identical.

describe('composeLocale — locale-preserving string composition', () => {
  it('all-scalar operands → plain string (byte-identical to String() path)', () => {
    const out = composeLocale(['P1', 2024], pick => `${pick('P1')} (${pick(2024)})`)
    expect(out).toBe('P1 (2024)')
    expect(isTaggedLocaleString(out)).toBe(false)
  })

  it('a tagged LocaleString operand → tagged LocaleString spanning every locale', () => {
    const label = tagLocaleString({ en: 'GDP', ka: 'მშპ' })
    const out = composeLocale([label, 'B1'], pick => `${pick(label)} (${pick('B1')})`)
    expect(isTaggedLocaleString(out)).toBe(true)
    expect(resolveLocaleString(out, 'en', 'en')).toBe('GDP (B1)')
    expect(resolveLocaleString(out, 'ka', 'en')).toBe('მშპ (B1)')
    // Never the flattened object marker
    expect(String(resolveLocaleString(out, 'ka', 'en'))).not.toContain('[object Object]')
  })

  it('localeKeysOf only counts tagged operands', () => {
    expect(localeKeysOf(['x', 5, { en: 'a' }])).toEqual([])               // untagged object ignored
    expect(localeKeysOf([tagLocaleString({ en: 'a', ka: 'ბ' })])).toEqual(['en', 'ka'])
  })
})

describe('applyTemplate / applyConcat — bilingual labels survive', () => {
  it('template {label} ({measure}) over a bilingual label stays bilingual + tagged', () => {
    const rows = [{ label: tagLocaleString({ en: 'GDP', ka: 'მშპ' }), measure: 'B1' }]
    const [r] = applyTemplate(rows as never, { op: 'template', as: 'label', tpl: '{label} ({measure})' })
    expect(isTaggedLocaleString(r.label)).toBe(true)
    expect(resolveLocaleString(r.label as never, 'ka', 'en')).toBe('მშპ (B1)')
    expect(resolveLocaleString(r.label as never, 'en', 'en')).toBe('GDP (B1)')
  })

  it('template over all-scalar fields → plain string', () => {
    const rows = [{ label: 'Production', measure: 'P1' }]
    const [r] = applyTemplate(rows as never, { op: 'template', as: 'label', tpl: '{label} ({measure})' })
    expect(r.label).toBe('Production (P1)')
    expect(isTaggedLocaleString(r.label)).toBe(false)
  })

  it('concat with a bilingual field stays bilingual', () => {
    const rows = [{ a: tagLocaleString({ en: 'X', ka: 'ხ' }), b: 'Y' }]
    const [r] = applyConcat(rows as never, { op: 'concat', fields: ['a', 'b'], as: 'k', sep: '-' })
    expect(resolveLocaleString(r.k as never, 'ka', 'en')).toBe('ხ-Y')
    expect(resolveLocaleString(r.k as never, 'en', 'en')).toBe('X-Y')
  })
})

describe('resolveOptions — option labels carry the LocaleString, never flattened', () => {
  // Minimal store stub: an inline source needs no store reads (resolveRaw short-circuits).
  const store = {} as DataStore

  it('a tagged bilingual labelField is carried INTACT (resolvable per locale)', () => {
    const opts = resolveOptions(
      { type: 'inline', items: [
        { code: 'TB', label: tagLocaleString({ en: 'Tbilisi', ka: 'თბილისი' }) },
      ], valueField: 'code', labelField: 'label' } as never,
      store,
      { timeMode: 'year', dims: {} },
    )
    expect(opts).toHaveLength(1)
    expect(isTaggedLocaleString(opts[0].label)).toBe(true)
    expect(resolveLocaleString(opts[0].label, 'ka', 'en')).toBe('თბილისი')
    expect(resolveLocaleString(opts[0].label, 'en', 'en')).toBe('Tbilisi')
    // The label is carried as a resolvable LocaleString OBJECT (NOT pre-flattened
    // to "[object Object]" by a String() in this locale-agnostic layer) — the React
    // shell resolveLocaleString()s it at render. That is exactly what fixes the bug.
  })

  it('a scalar labelField coerces to a plain string (byte-identical)', () => {
    const opts = resolveOptions(
      { type: 'inline', items: [{ code: '2024', label: 2024 }], valueField: 'code', labelField: 'label' } as never,
      store,
      { timeMode: 'year', dims: {} },
    )
    expect(opts[0].label).toBe('2024')
  })
})
