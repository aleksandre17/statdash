// ── Perspective Axis — scope.metric runtime fitness [ENG-10] ──────────────────
//
//  FF-PERSPECTIVE-METRIC-SWAP — the authored≠wired defect, CLOSED + PROVEN.
//
//  The `metric` perspective scope-key was authorable, persisted, validated and
//  round-tripped — yet folded NOTHING at runtime (scopeCtxByPerspective applied
//  only `timeBinding`). These fitness functions assert the swap is now REAL:
//
//    1. A raw-code metric ref pins MEASURE_DIM to that code byte-identically
//       (Postel — no registration needed).
//    2. A registered metric-id expands through the binding SSOT (resolveMeasureRef)
//       to its UNDERLYING store code and pins THAT.
//    3. END-TO-END: a `query` spec whose `filter.measure` is `{$ctx:'measure'}`
//       resolves the SWAPPED measure against a store — two perspectives ⇒ two
//       different resolved measures (the swap actually changes what the store reads).
//    4. ADDITIVE IDENTITY: a perspective with no `metric` writes nothing; the swap
//       never mutates the source ctx and leaves siblings untouched.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { SectionContext } from '../core/context'
import { MEASURE_DIM } from '../core/context'
import type { PerspectivesByParam } from './perspective-axis'
import { scopeCtxByPerspective } from './perspective-axis-parser'
import { registerMetric } from '../data/metric'
import { interpretSpec } from '../data/spec'
import { resolveRef } from '../ref/ref'
import type { DataStore, StoreQuery } from '../data/store'
import type { EngineRow } from '../data/encoding'
import type { CtxRef } from '../sdmx'

// ── helpers ─────────────────────────────────────────────────────────────────

function ctx(dims: Record<string, number | string>): SectionContext {
  return { dims }
}

// A two-perspective axis where each perspective swaps the MEASURE: `gdp` pins a
// raw code, `gva` pins a REGISTERED metric-id (expands to its underlying code).
const MEASURE_AXIS: PerspectivesByParam = {
  perspective: {
    perspectives: [
      { id: 'gdp', label: { ka: 'მშპ', en: 'GDP' },
        scope: { metric: 'gross-domestic-product-at-current-prices' } },
      { id: 'gva', label: { ka: 'მდღ', en: 'GVA' },
        scope: { metric: 'metric:test-gva' } },
    ],
  },
}

// A minimal store: an `obs` query echoes back the resolved `measure` filter (the
// SSOT resolveRef dispatcher resolves any {$ctx} ref against ctx.dims, exactly as
// the real stores do) so the rows reflect WHICH measure the swap drove to the wire.
const echoStore: DataStore = {
  querySync(q: StoreQuery, c: SectionContext): EngineRow[] {
    if (q.type !== 'obs') return []
    const fv = q.filter?.[MEASURE_DIM]
    const measure =
      fv && typeof fv === 'object' && '$ctx' in fv
        ? (resolveRef(fv as CtxRef, { dims: c.dims }) as string)
        : (fv as string | undefined)
    return measure ? [{ id: measure, label: measure, value: 1, [MEASURE_DIM]: measure }] : []
  },
}

// ── FF-PERSPECTIVE-METRIC-SWAP (1) raw code, byte-identical pin ───────────────

describe('FF-PERSPECTIVE-METRIC-SWAP — the active perspective swaps the resolved measure', () => {

  it('a raw-code metric ref pins MEASURE_DIM to that exact code (Postel — no registration)', () => {
    const out = scopeCtxByPerspective(ctx({ geo: 'GE' }), MEASURE_AXIS, { perspective: 'gdp' })
    expect(out.dims[MEASURE_DIM]).toBe('gross-domestic-product-at-current-prices')
    expect(out.dims.geo).toBe('GE')   // sibling untouched
  })

  it('a registered metric-id expands through resolveMeasureRef to its underlying store code', () => {
    registerMetric('metric:test-gva', { code: 'GVA', label: { ka: 'მდღ', en: 'GVA' } })
    const out = scopeCtxByPerspective(ctx({}), MEASURE_AXIS, { perspective: 'gva' })
    // The metric-id is NOT pinned raw — it resolves to the underlying SDMX code 'GVA'.
    expect(out.dims[MEASURE_DIM]).toBe('GVA')
  })

  // ── (3) END-TO-END: the swap changes what the store actually reads ──────────
  it('drives interpretSpec end-to-end: two perspectives ⇒ two different resolved measures', () => {
    registerMetric('metric:test-gva', { code: 'GVA', label: { ka: 'მდღ', en: 'GVA' } })
    // A spec that defers its measure to the active perspective via a {$ctx} ref —
    // exactly how a perspective-driven page authors a swappable measure.
    const spec = {
      type: 'query' as const,
      query: { measure: '*', filter: { [MEASURE_DIM]: { $ctx: 'measure' } } },
      encoding: { label: 'label', value: 'value' },
    }

    const gdpCtx = scopeCtxByPerspective(ctx({ geo: 'GE' }), MEASURE_AXIS, { perspective: 'gdp' })
    const gvaCtx = scopeCtxByPerspective(ctx({ geo: 'GE' }), MEASURE_AXIS, { perspective: 'gva' })

    const gdpRows = interpretSpec(spec, gdpCtx, echoStore)
    const gvaRows = interpretSpec(spec, gvaCtx, echoStore)

    expect(gdpRows[0]?.[MEASURE_DIM]).toBe('gross-domestic-product-at-current-prices')
    expect(gvaRows[0]?.[MEASURE_DIM]).toBe('GVA')           // metric-id swapped → underlying code reached the store
    expect(gdpRows[0]?.[MEASURE_DIM]).not.toBe(gvaRows[0]?.[MEASURE_DIM])
  })

})

// ── FF-PERSPECTIVE-METRIC-SWAP (4) additive identity ─────────────────────────

describe('FF-PERSPECTIVE-METRIC-SWAP — additive: no metric scope ⇒ untouched', () => {

  it('a perspective with NO metric scope writes nothing (identity ctx)', () => {
    const noMetric: PerspectivesByParam = {
      perspective: { perspectives: [{ id: 'a', label: { ka: 'ა', en: 'A' } }] },
    }
    const c = ctx({ measure: 'PRE_EXISTING' })
    const out = scopeCtxByPerspective(c, noMetric, { perspective: 'a' })
    expect(out).toBe(c)                              // same reference — no clone
    expect(out.dims[MEASURE_DIM]).toBe('PRE_EXISTING')
  })

  it('the source ctx is never mutated by a swap', () => {
    const c = ctx({ geo: 'GE' })
    scopeCtxByPerspective(c, MEASURE_AXIS, { perspective: 'gdp' })
    expect(c.dims[MEASURE_DIM]).toBeUndefined()      // swap wrote to a clone, not the source
  })

})
