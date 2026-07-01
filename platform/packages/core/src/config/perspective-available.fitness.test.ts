// ── FF-PERSPECTIVE-AVAILABLE — the D-GUARD `available` is HONORED at its consumer [AD-6] ─
//
//  THE DECLARED-BUT-INERT SEAM (perspective-axis.ts:150): `PerspectiveDef.available`
//  (a VisibilityExpr) is documented as "Read by the switcher/nav" — yet `perspectiveOptions`
//  mapped EVERY perspective and never evaluated it (a silent no-op, the same class as the
//  decorative `granularity`). AD-6 wires it: the offered list EXCLUDES any perspective whose
//  `available` evaluates false, through the SAME `evalVisibility` evaluator the node
//  `visibleWhen` gate uses.
//
//  Contracts proven here:
//   (1) available:false ⇒ the perspective is EXCLUDED from the offered list.
//   (2) available:true  ⇒ it is offered (the guard reads filter params + perspectiveState).
//   (3) NO `gate` arg ⇒ every perspective is offered — byte-identical to the pre-AD-6 map
//       (additive/inert; the existing react caller + p52 fitness are unaffected).
//   (4) `available` absent on a def ⇒ always offered, even WITH a gate.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { perspectiveOptions } from '../index'
import type { PerspectiveAxis, VisibilityExpr } from '../index'

// A guarded axis: `range` is only available when filter param `allowRange` is set.
const GUARD: VisibilityExpr = { op: 'isset', param: 'allowRange' }
const AXIS: PerspectiveAxis = {
  perspectives: [
    { id: 'year',  label: { ka: 'წელი', en: 'Year' } },
    { id: 'range', label: { ka: 'შუალედი', en: 'Range' }, available: GUARD },
  ],
}

describe('FF-PERSPECTIVE-AVAILABLE — perspectiveOptions honors PerspectiveDef.available', () => {
  it('(1) available:false ⇒ the perspective is EXCLUDED from the offered list', () => {
    const offered = perspectiveOptions(AXIS, 'en', 'en', { filterParams: {} })
    expect(offered.map((o) => o.id)).toEqual(['year'])   // `range` guard unmet ⇒ dropped
  })

  it('(2) available:true ⇒ the perspective IS offered (guard reads filter params)', () => {
    const offered = perspectiveOptions(AXIS, 'en', 'en', { filterParams: { allowRange: 'x' } })
    expect(offered.map((o) => o.id)).toEqual(['year', 'range'])
  })

  it('(2b) the guard also reads perspectiveState (perspective-* ops)', () => {
    const psAxis: PerspectiveAxis = {
      perspectives: [
        { id: 'a', label: { ka: 'a', en: 'a' } },
        { id: 'b', label: { ka: 'b', en: 'b' },
          available: { op: 'perspective-is', perspective: 'a', param: 'mode' } },
      ],
    }
    const on  = perspectiveOptions(psAxis, 'en', 'en', { filterParams: {}, perspectiveState: { mode: 'a' } })
    const off = perspectiveOptions(psAxis, 'en', 'en', { filterParams: {}, perspectiveState: { mode: 'b' } })
    expect(on.map((o) => o.id)).toEqual(['a', 'b'])
    expect(off.map((o) => o.id)).toEqual(['a'])
  })

  it('(3) NO gate arg ⇒ every perspective offered (byte-identical to pre-AD-6, inert)', () => {
    const offered = perspectiveOptions(AXIS, 'en', 'en')
    expect(offered.map((o) => o.id)).toEqual(['year', 'range'])
  })

  it('(4) a def with NO `available` is always offered, even with a gate present', () => {
    const offered = perspectiveOptions(AXIS, 'en', 'en', { filterParams: {} })
    expect(offered.some((o) => o.id === 'year')).toBe(true)   // `year` has no guard
  })
})
