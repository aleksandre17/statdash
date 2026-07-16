// ── FF-BIND-AUTOCOMPLETE-GOVERNED — the expr autocomplete suggests GOVERNED nouns ──
//
//  Mission #4 (Retool-class schema-aware binding editor). The load-bearing property:
//  the autocomplete's vocabulary is sourced from the GOVERNED semantic catalog
//  (describeApp().metrics/.dimensions) — the author picks a governed noun, NEVER a
//  raw SDMX/indicator code (Law 1 generic · Law 2 declarative). A picked suggestion
//  inserts a serializable REF token (a bare identifier / operator symbol), never a
//  function or a raw code.
//
//  Complements metricRefGoverned.fitness.test.ts (the metric-ref picker) — here we
//  pin the same governance invariant for the BINDING autocomplete surface.
//
import { describe, it, expect } from 'vitest'
import type { MetricDef } from '@statdash/engine'
import type { CatalogDimension } from '../../../discovery/semanticCatalogOptions'
import {
  governedSuggestions,
  scopeRefSuggestions,
  operatorSuggestions,
  rankSuggestions,
  tokenAtCaret,
  applySuggestion,
  unknownRefs,
  referencedIdentifiers,
} from './bindSuggestions'

// A catalog whose governed IDS differ from their underlying SDMX CODES — the decisive
// shape for "governed noun, never raw code": if any suggestion surfaces a code, or a
// metric inserts its code, governance has leaked.
const metrics: Record<string, MetricDef> = {
  'gdp.current':    { code: 'B1GQ',    label: { en: 'GDP (current)', ka: 'მშპ' } },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { en: 'GDP · growth',  ka: 'ზრდა' }, unit: { en: '%', ka: '%' } },
}
const dimensions: Record<string, CatalogDimension> = {
  geography: { code: 'REF_AREA', label: { en: 'Region', ka: 'რეგიონი' } },
  period:    { code: 'TIME',     label: { en: 'Period', ka: 'პერიოდი' } },
}
const METRIC_CODES = Object.values(metrics).map((d) => d.code as string)

describe('FF-BIND-AUTOCOMPLETE-GOVERNED — governed nouns, never raw codes', () => {
  it('surfaces the governed bilingual label, not the raw code, as what the author reads', () => {
    const en = governedSuggestions(metrics, dimensions, 'en')
    const labels = en.map((s) => s.label)
    expect(labels).toContain('GDP (current)')
    expect(labels).toContain('Region')
    // No raw underlying code is ever the visible label.
    for (const code of [...METRIC_CODES, 'REF_AREA', 'TIME']) expect(labels).not.toContain(code)
  })

  it('resolves labels to the active locale (Law 4 bilingual)', () => {
    const ka = governedSuggestions(metrics, dimensions, 'ka')
    expect(ka.map((s) => s.label)).toContain('რეგიონი')
    expect(ka.map((s) => s.label)).toContain('მშპ')
  })

  it('a METRIC inserts its GOVERNED id (never its underlying code — Law 2)', () => {
    const metric = governedSuggestions(metrics, dimensions, 'en').filter((s) => s.kind === 'metric')
    expect(metric.map((s) => s.insert).sort()).toEqual(['gdp.current', 'gdp.realGrowth'])
    for (const s of metric) {
      expect(METRIC_CODES).not.toContain(s.insert) // never a raw code
      expect(s.insert in metrics).toBe(true)        // a registered governed noun
      expect(typeof s.insert).toBe('string')        // serializable ref, never a fn
    }
  })

  it('a DIMENSION inserts its scope.dims key (the resolvable code), governed-labelled', () => {
    const dim = governedSuggestions(metrics, dimensions, 'en').filter((s) => s.kind === 'dimension')
    expect(dim.map((s) => s.insert).sort()).toEqual(['REF_AREA', 'TIME'])
  })
})

describe('FF-BIND-AUTOCOMPLETE — in-scope refs + operators', () => {
  it('surfaces in-scope params + vars as resolvable bare-identifier refs', () => {
    const refs = scopeRefSuggestions([{ key: 'year', label: 'წელი' }], ['selected'], 'ka')
    expect(refs.find((s) => s.kind === 'param')?.insert).toBe('year')
    expect(refs.find((s) => s.kind === 'var')?.insert).toBe('selected')
  })

  it('operators insert the formula SYMBOL, labelled from OPS_CATALOG (no second catalog)', () => {
    const ops = operatorSuggestions('en')
    const eq  = ops.find((s) => s.insert === '==')
    expect(eq).toBeTruthy()
    expect(eq!.label.toLowerCase()).toContain('equal') // label sourced from OPS_CATALOG
    expect(ops.some((s) => s.insert === '&&')).toBe(true)
    // No op suggestion inserts a JSON op NAME (which would resolve as a bare ref).
    expect(ops.map((s) => s.insert)).not.toContain('eq')
  })
})

describe('rankSuggestions — schema-aware matching', () => {
  const vocab = [
    ...scopeRefSuggestions([{ key: 'year' }, { key: 'geo' }], ['growth'], 'en'),
    ...governedSuggestions(metrics, dimensions, 'en'),
    ...operatorSuggestions('en'),
  ]

  it('an empty token returns the discovery list (refs before operators)', () => {
    const out = rankSuggestions(vocab, '')
    expect(out[0].kind).not.toBe('op')
  })

  it('a typed prefix filters to matching refs, best-first', () => {
    const out = rankSuggestions(vocab, 'ge')
    expect(out.some((s) => s.insert === 'geo')).toBe(true)
    // 'year' does not start with / contain 'ge' → excluded.
    expect(out.some((s) => s.insert === 'year')).toBe(false)
  })

  it('matches an operator by its OPS_CATALOG op-key keyword (typing "eq" → ==)', () => {
    const out = rankSuggestions(vocab, 'eq')
    expect(out.some((s) => s.insert === '==')).toBe(true)
  })
})

describe('tokenAtCaret / applySuggestion — caret-aware insertion', () => {
  it('extracts the identifier token immediately before the caret', () => {
    expect(tokenAtCaret('year > ge', 9)).toEqual({ token: 'ge', start: 7 })
    expect(tokenAtCaret('year > ', 7)).toEqual({ token: '', start: 7 })
  })

  it('replaces the token-before-caret with the inserted ref, returning the new caret', () => {
    const res = applySuggestion('year > ge', 9, 'geo')
    expect(res.next).toBe('year > geo')
    expect(res.caret).toBe(10)
  })

  it('inserts mid-string without clobbering the tail', () => {
    const res = applySuggestion('ye + 1', 2, 'year')
    expect(res.next).toBe('year + 1')
  })
})

describe('unknownRefs — friendly pre-save validation', () => {
  const known = new Set(['year', 'geo', 'gdp.current'])

  it('flags identifiers that are not a known ref (non-blocking)', () => {
    expect(unknownRefs('year + foo', known)).toEqual(['foo'])
  })

  it('never flags a known ref, a number, or a reserved keyword', () => {
    expect(unknownRefs('year > 0 && true', known)).toEqual([])
  })

  it('referencedIdentifiers excludes reserved keywords and dedupes', () => {
    expect(referencedIdentifiers('a && a || false')).toEqual(['a'])
  })
})
