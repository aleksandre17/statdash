// @vitest-environment node
//
// ── specDimKey characterization tests ─────────────────────────────────────────
//
//  Pins the behaviour of specDimKey: stable fingerprint derived from the exact
//  (code × dims) pairs a DataSpec reads — not the whole SectionContext.
//
//  Key invariants:
//    1. Same spec + same dims → identical string (memoisation stability).
//    2. Unrelated dim added to ctx (not referenced by spec) → key unchanged.
//    3. Dim that the spec DOES reference changes → key changes.
//    4. Spec with no extractable requirements → returns ''.
//    5. Unknown spec type (extractRequirements returns undefined) → fallback
//       string derived from full dims JSON (catch path).
//

import { describe, it, expect } from 'vitest'
import { specDimKey }            from './specDimKey'
import type { SectionContext }   from '@statdash/engine'

function makeCtx(dims: Record<string, unknown>): SectionContext {
  return { dims: dims as Record<string, import('@statdash/engine').DimVal> }
}

// ── query spec ────────────────────────────────────────────────────────────────
//
//  extractRequirements for 'query' produces:
//    { code: measure, dims: { ...ctx.dims, time: year } }
//  where year comes from ctx.dims['time'] (no time filter in spec).
//

describe('specDimKey — query spec', () => {

  const querySpec = {
    type:     'query'  as const,
    query:    { measure: 'GDP' },
    encoding: { label: 'label' as const, value: 'value' as const },
  }

  it('returns a non-empty string containing the measure code and dim value', () => {
    const ctx = makeCtx({ time: 2023 })
    const key = specDimKey(querySpec, ctx)

    expect(key).toBeTruthy()
    expect(key).toContain('GDP')
    expect(key).toContain('time=2023')
  })

  it('same spec and same dims → identical key (stability)', () => {
    const ctx  = makeCtx({ time: 2023 })
    const key1 = specDimKey(querySpec, ctx)
    const key2 = specDimKey(querySpec, ctx)

    expect(key1).toBe(key2)
  })

  it('all ctx.dims are reflected in the key — adding a new dim changes the key', () => {
    // extractRequirements for 'query' produces { code, dims: { ...ctx.dims, time: year } }.
    // The full ctx.dims is spread into every requirement, so any new dim in ctx
    // changes the resulting key. This is the conservative (over-fire) behaviour:
    // the key changes whenever ctx.dims changes, not just when a "filtered" dim changes.
    const specWithTimeFilter = {
      type:     'query' as const,
      query:    { measure: 'GDP', filter: { time: 2023 } },
      encoding: { label: 'label' as const, value: 'value' as const },
    }

    const ctxBase     = makeCtx({ time: 2023, geo: 'GEO_GE' })
    const ctxWithMode = makeCtx({ time: 2023, geo: 'GEO_GE', mode: 'year' })

    const keyBase     = specDimKey(specWithTimeFilter, ctxBase)
    const keyWithMode = specDimKey(specWithTimeFilter, ctxWithMode)

    // mode is included in requirement dims → keys differ
    expect(keyBase).not.toBe(keyWithMode)
    expect(keyBase).toContain('time=2023')
    expect(keyWithMode).toContain('mode=year')
  })

  it('changing a referenced dim changes the key', () => {
    const ctx2023 = makeCtx({ time: 2023 })
    const ctx2024 = makeCtx({ time: 2024 })

    const key2023 = specDimKey(querySpec, ctx2023)
    const key2024 = specDimKey(querySpec, ctx2024)

    expect(key2023).not.toBe(key2024)
  })

  it('key contains code:dim=val format', () => {
    const ctx = makeCtx({ time: 2023 })
    const key = specDimKey(querySpec, ctx)

    // Format: "GDP:time=2023" (possibly with more dims sorted lexicographically)
    expect(key).toMatch(/^GDP:/)
    expect(key).toContain('time=2023')
  })

})

// ── row-list spec: only dims the spec needs matter ────────────────────────────
//
//  extractRequirements for 'row-list' always uses full ctx.dims, so any dim
//  change in ctx IS reflected in the key. The test below confirms that the
//  key contains the referenced dim values.
//

describe('specDimKey — row-list spec', () => {

  const rowListSpec = {
    type: 'row-list' as const,
    rows: [{ code: 'GDP' }],
  }

  it('returns non-empty string for a row-list with one row', () => {
    const ctx = makeCtx({ time: 2023 })
    const key = specDimKey(rowListSpec, ctx)

    expect(key).toBeTruthy()
    expect(key).toContain('GDP')
  })

  it('key changes when ctx.dims changes', () => {
    const ctx2023 = makeCtx({ time: 2023 })
    const ctx2024 = makeCtx({ time: 2024 })

    expect(specDimKey(rowListSpec, ctx2023)).not.toBe(specDimKey(rowListSpec, ctx2024))
  })

  it('same inputs → same key (stability)', () => {
    const ctx = makeCtx({ time: 2023 })

    expect(specDimKey(rowListSpec, ctx)).toBe(specDimKey(rowListSpec, ctx))
  })

})

// ── specs with no requirements → '' ──────────────────────────────────────────
//
//  'pivot' and 'transform' return [] from extractRequirements.
//  specDimKey must return '' for these.
//

describe('specDimKey — no-requirements specs', () => {

  it('pivot spec → empty string', () => {
    const pivotSpec = {
      type:        'pivot'   as const,
      rows:        [] as Record<string, import('@statdash/engine').DimVal>[],
      keyField:    'time',
      valueFields: ['value'],
    }
    const ctx = makeCtx({ time: 2023 })

    expect(specDimKey(pivotSpec, ctx)).toBe('')
  })

  it('transform spec → empty string', () => {
    const transformSpec = {
      type:     'transform' as const,
      source:   [],
      steps:    [],
      encoding: { label: 'label' as const, value: 'value' as const },
    }
    const ctx = makeCtx({ time: 2023 })

    expect(specDimKey(transformSpec, ctx)).toBe('')
  })

})

// ── unknown / bad spec type → fallback to dims JSON ──────────────────────────
//
//  extractRequirements has no default case — unknown type returns undefined.
//  specDimKey's catch block fires → returns full dims as key=val string.
//  This is the over-fire path (conservative) — never under-fires.
//

describe('specDimKey — unknown spec type fallback', () => {

  it('unknown type that causes extractRequirements to return undefined → non-empty fallback key', () => {
    const badSpec = { type: 'nonexistent-type' } as never

    const ctx = makeCtx({ time: 2023, geo: 'GE' })
    const key = specDimKey(badSpec, ctx)

    // Fallback: entries of ctx.dims sorted and joined as "k=v"
    expect(key).toBeTruthy()
    expect(key).toContain('time=2023')
    expect(key).toContain('geo=GE')
  })

  it('fallback key changes when dims change', () => {
    const badSpec = { type: 'unknown' } as never

    const key1 = specDimKey(badSpec, makeCtx({ time: 2023 }))
    const key2 = specDimKey(badSpec, makeCtx({ time: 2024 }))

    expect(key1).not.toBe(key2)
  })

  it('fallback key is stable for the same dims', () => {
    const badSpec = { type: 'unknown' } as never
    const ctx = makeCtx({ time: 2023 })

    expect(specDimKey(badSpec, ctx)).toBe(specDimKey(badSpec, ctx))
  })

})
