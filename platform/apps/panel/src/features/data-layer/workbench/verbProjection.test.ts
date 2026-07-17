// ── verbPalette model tests (W-P3 · ADR-046 · SPEC §1.2) ─────────────────────────
//
//  The palette is a PROJECTION of the engine registry's `category` field, not a hand
//  list. These pin: the 7 verbs project in canonical order; each insertable verb's
//  default op is its SPEC §1.2 default; the `get` head is honestly non-insertable
//  (no `source` op yet, W-P4); and `verbLabelForOp` derives the verb from the op's
//  registry category (the SSOT that replaces the old hand VERB_LABELS map).
//
import { describe, it, expect } from 'vitest'
// Side-effect: register all built-in transform ops so the projection is populated.
import '@statdash/engine'
import { STEP_CATEGORIES, getTransformStepCategory } from '@statdash/engine'
import { buildVerbPalette, verbLabelForOp } from './verbProjection'

describe('buildVerbPalette — the 7-verb projection of the op registry', () => {
  const palette = buildVerbPalette('en')

  it('projects exactly the 7 canonical verbs, in canonical order', () => {
    expect(palette.map((v) => v.category)).toEqual([...STEP_CATEGORIES])
  })

  it('every insertable verb offers a default op that IS one of its projected ops', () => {
    for (const v of palette) {
      if (!v.insertable) continue
      expect(v.ops.length).toBeGreaterThan(0)
      expect(v.ops.some((o) => o.op === v.defaultOp)).toBe(true)
    }
  })

  it('the SPEC §1.2 defaults hold (Filter→filter, Aggregate→aggregate, Derive→derive, Sort→sort)', () => {
    const byCat = Object.fromEntries(palette.map((v) => [v.category, v.defaultOp]))
    expect(byCat.filter).toBe('filter')
    expect(byCat.aggregate).toBe('aggregate')
    expect(byCat.derive).toBe('derive')
    expect(byCat.sort).toBe('sort')
  })

  it('the `get` head verb is honestly NON-insertable (no `source` op registered yet)', () => {
    const get = palette.find((v) => v.category === 'get')!
    expect(get.insertable).toBe(false)
    expect(get.ops).toEqual([])
  })

  it('Aggregate discloses its several concrete ops (aggregate·group·reduce·rollup)', () => {
    const agg = palette.find((v) => v.category === 'aggregate')!
    expect(agg.ops.map((o) => o.op).sort()).toEqual(['aggregate', 'group', 'reduce', 'rollup'])
  })

  it('excludes joinByField from the palette (carries resolved rows — not authorable)', () => {
    const allOps = palette.flatMap((v) => v.ops.map((o) => o.op))
    expect(allOps).not.toContain('joinByField')
    // …yet it stays categorized in the engine (combine) — the palette filters it, the
    // registry does not lose it.
    expect(getTransformStepCategory('joinByField')).toBe('combine')
  })

  it('is bilingual — Georgian verb labels when locale=ka', () => {
    const ka = buildVerbPalette('ka')
    expect(ka.find((v) => v.category === 'filter')!.label).toBe('ფილტრი')
    expect(ka.find((v) => v.category === 'sort')!.label).toBe('დახარისხება')
  })
})

describe('verbLabelForOp — the op→verb projection (replaces the hand VERB_LABELS)', () => {
  it('derives the verb from the op registry category (aggregate ops all read "Aggregate")', () => {
    expect(verbLabelForOp('reduce', 'en')).toBe('Aggregate')
    expect(verbLabelForOp('rollup', 'en')).toBe('Aggregate')
    expect(verbLabelForOp('group', 'en')).toBe('Aggregate')
  })

  it('derive-family ops all read "Derive"; filter reads "Filter"', () => {
    expect(verbLabelForOp('derive', 'en')).toBe('Derive')
    expect(verbLabelForOp('window', 'en')).toBe('Derive')
    expect(verbLabelForOp('filter', 'en')).toBe('Filter')
  })

  it('an un-categorized op (e.g. the W-P4 head `source`) falls back to the bare op — honest', () => {
    expect(verbLabelForOp('source', 'en')).toBe('source')
  })
})
