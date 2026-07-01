// ── FF-BINDING-SELECTION-EQUIV — the orthogonal `binding` ≡ the legacy `timeBinding` ─
//
//  THE LAW (DESIGN-time-mode-decision §3.1 / §5 P1). The generic `scope.binding`
//  (a DimBinding with an EXPLICIT `selection` discriminant) folds through
//  scopeCtxByPerspective + perspectiveOwnedParamKeys BYTE-IDENTICALLY to its legacy
//  `scope.timeBinding` twin (pin XOR range) — the Postel/Strangler guarantee that the
//  live-config migration (year→point, range→window) moved zero rows. The legacy shape
//  is LOWERED to the same DimBinding (bindingFromTimeBinding), so both drive one fold.
//
//  Also locks:
//    • FF-SELECTION-EXPLICIT — the illegal `pin & window` state is UNREPRESENTABLE at
//      the type level (a compile-time proof, not a runtime hope).
//    • FF-GRAIN-OPEN — `granularity` is an OPEN string (a custom grain needs no core edit).

import { describe, it, expect } from 'vitest'
import { TIME_DIM } from '../core/context'
import type { SectionContext } from '../core/context'
import {
  scopeCtxByPerspective,
  perspectiveOwnedParamKeys,
} from './perspective-axis-parser'
import type { PerspectivesByParam, DimBinding, Selection } from './perspective-axis'

// The live geostat shape: year = pin the user-tracked `year` param; range = a [from,to]
// window over `fromYear`/`toYear`, echoing back into those same keys (targetKeys).
const LABEL_Y = { ka: 'Y', en: 'Y' }
const LABEL_R = { ka: 'R', en: 'R' }

const LEGACY: PerspectivesByParam = {
  mode: { perspectives: [
    { id: 'year',  label: LABEL_Y, scope: { timeBinding: { dim: TIME_DIM, pin: { $ctx: 'year' } } } },
    { id: 'range', label: LABEL_R, scope: { timeBinding: {
      dim: TIME_DIM,
      range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }],
      targetKeys: { from: 'fromYear', to: 'toYear' },
    } } },
  ] },
}

const MIGRATED: PerspectivesByParam = {
  mode: { perspectives: [
    { id: 'year',  label: LABEL_Y, scope: { binding: { dim: TIME_DIM, selection: { kind: 'point', at: { $ctx: 'year' } } } } },
    { id: 'range', label: LABEL_R, scope: { binding: {
      dim: TIME_DIM,
      selection: { kind: 'window', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' }, targetKeys: { from: 'fromYear', to: 'toYear' } },
    } } },
  ] },
}

// A ctx carrying the params both bindings read (year for the pin; from/to for the window).
const CTX: SectionContext = { dims: { year: 2024, fromYear: '2020', toYear: '2024' } }

describe('FF-BINDING-SELECTION-EQUIV — binding folds identically to the legacy timeBinding', () => {
  for (const mode of ['year', 'range'] as const) {
    it(`scopeCtxByPerspective is deep-equal for the ${mode} perspective`, () => {
      const state = { mode }
      const legacy = scopeCtxByPerspective(CTX, LEGACY, state)
      const migrated = scopeCtxByPerspective(CTX, MIGRATED, state)
      expect(migrated.dims).toEqual(legacy.dims)
    })
  }

  it('the two perspectives genuinely DIFFER (non-vacuous: point pins time, window writes from/to)', () => {
    const y = scopeCtxByPerspective(CTX, MIGRATED, { mode: 'year' })
    const r = scopeCtxByPerspective(CTX, MIGRATED, { mode: 'range' })
    expect(y.dims[TIME_DIM]).toBe(2024)          // point pins the year onto `time`
    expect(r.dims[TIME_DIM]).toBeUndefined()     // window writes from/to, NOT time (all-periods on the axis)
    expect(r.dims.fromYear).toBe('2020')         // window echo-preserves the string representation
    expect(r.dims.toYear).toBe('2024')
    expect(y.dims).not.toEqual(r.dims)
  })

  it('perspectiveOwnedParamKeys is identical between the two forms (default-gate parity)', () => {
    for (const mode of ['year', 'range'] as const) {
      const state = { mode }
      const legacy = perspectiveOwnedParamKeys(LEGACY, state)
      const migrated = perspectiveOwnedParamKeys(MIGRATED, state)
      expect([...migrated.active].sort()).toEqual([...legacy.active].sort())
      expect([...migrated.all].sort()).toEqual([...legacy.all].sort())
    }
    // Non-vacuous: the window owns fromYear/toYear; the point owns the `year` param.
    const own = perspectiveOwnedParamKeys(MIGRATED, { mode: 'range' })
    expect(own.all.has('fromYear')).toBe(true)
    expect(own.all.has('toYear')).toBe(true)
    expect(own.all.has('year')).toBe(true)          // owned by the (inactive) point perspective
    expect(own.active.has('year')).toBe(false)      // …but not by the active range perspective
  })
})

describe('FF-SELECTION-EXPLICIT — the illegal pin&window state is unrepresentable', () => {
  it('a point selection admits only `at`; a window only `from`/`to` (compile-time proof)', () => {
    const point: Selection  = { kind: 'point',  at: 2024 }
    const window: Selection = { kind: 'window', from: 2020, to: 2024 }
    // @ts-expect-error — a point may NOT carry window bounds (no shape-inferred illegal state)
    const illegalA: Selection = { kind: 'point', at: 2024, from: 2020, to: 2024 }
    // @ts-expect-error — a window may NOT be discriminated by a missing/other kind
    const illegalB: Selection = { kind: 'point', from: 2020, to: 2024 }
    void illegalA; void illegalB
    expect(point.kind).toBe('point')
    expect(window.kind).toBe('window')
  })
})

describe('FF-GRAIN-OPEN — granularity is an open registry string, not a closed union', () => {
  it('a DimBinding accepts a custom grain id with no core-type edit', () => {
    const b: DimBinding = { dim: TIME_DIM, selection: { kind: 'all' }, granularity: 'fiscal-year' }
    expect(b.granularity).toBe('fiscal-year')   // any registered grain — not just year/quarter/month
  })
})
