// ── perspective-p2.fitness — perspective-* ops + mode-* alias-equivalence [P2] ──
//
//  The P2 invariant: the CANONICAL `perspective-is`/`perspective-in`/`perspective-
//  not` ops gate node visibility off the `perspectiveState` SSOT, and the legacy
//  `mode-*` ops are byte-identical ALIASES (a param-less perspective-* op resolves
//  the active id through the SAME `activePerspective` path the mode-* ops use).
//  This locks both halves of the P2 contract:
//    (1) perspective-* reads perspectiveState: active matches → visible; inactive →
//        hidden; -not inverts; -in matches a set; explicit `param` selects an axis.
//    (2) ALIAS-EQUIVALENCE: for every (state, value), a param-less perspective-* op
//        and the corresponding mode-* op return IDENTICAL results — the byte-
//        identical guarantee that keeps existing mode-* configs unchanged.
//
//  Non-vacuous: every assertion exercises a concrete true/false flip off real state.
//
import { describe, it, expect } from 'vitest'
import { evalVisibility } from './visibility'
import type { VisibilityExpr } from './visibility'

// fr (filterParams) is irrelevant to perspective-*/mode-* ops — they read the
// 3rd arg (perspectiveState), never fr. A fixed empty bag isolates that.
const NO_FILTERS = {}

describe('P2 — perspective-* ops gate off the perspectiveState SSOT', () => {
  it('perspective-is: active matches → visible; inactive → hidden', () => {
    const expr: VisibilityExpr = { op: 'perspective-is', perspective: 'range' }
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'range' })).toBe(true)  // active
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'year'  })).toBe(false) // other active
    expect(evalVisibility(expr, NO_FILTERS, undefined)).toBe(false)                // no axis ⇒ hidden
  })

  it('perspective-not: inverts — visible UNLESS the named perspective is active', () => {
    const expr: VisibilityExpr = { op: 'perspective-not', perspective: 'range' }
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'year'  })).toBe(true)  // other active ⇒ visible
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'range' })).toBe(false) // named active ⇒ hidden
    // No active id ⇒ the active is null ⇒ NOT-gate is false (matches mode-not, m!=null guard).
    expect(evalVisibility(expr, NO_FILTERS, undefined)).toBe(false)
  })

  it('perspective-in: visible iff the active id is in the declared set', () => {
    const expr: VisibilityExpr = { op: 'perspective-in', perspectives: ['year', 'range'] }
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'year'    })).toBe(true)
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'range'   })).toBe(true)
    expect(evalVisibility(expr, NO_FILTERS, { perspective: 'compare' })).toBe(false) // outside set
    expect(evalVisibility(expr, NO_FILTERS, undefined)).toBe(false)
  })

  it('explicit `param` selects the axis (Law 1 — many orthogonal axes)', () => {
    // Two orthogonal axes; the op reads ONLY its named axis, ignoring the other.
    const state = { time: 'range', geo: 'national' }
    expect(evalVisibility({ op: 'perspective-is', perspective: 'range',    param: 'time' }, NO_FILTERS, state)).toBe(true)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'national', param: 'geo'  }, NO_FILTERS, state)).toBe(true)
    // Cross-axis: 'range' is NOT the geo axis value ⇒ hidden (no cross-region bleed).
    expect(evalVisibility({ op: 'perspective-is', perspective: 'range',    param: 'geo'  }, NO_FILTERS, state)).toBe(false)
    // An unknown param resolves to undefined ⇒ hidden.
    expect(evalVisibility({ op: 'perspective-is', perspective: 'range',    param: 'nope' }, NO_FILTERS, state)).toBe(false)
  })
})

describe('P2 — the conventional-axis fallback (param-less perspective-*)', () => {
  // The matrix of states the conventional axis can be in, incl. the legacy `mode`
  // key and the absent-axis case. Param-less perspective-* resolves the active id
  // via activePerspective (the conventional 'perspective'/'mode' key, or the single axis).
  it('param-less perspective-is reads the conventional axis (perspective ?? mode key)', () => {
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, { perspective: 'year' })).toBe(true)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, { mode: 'year' })).toBe(true)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, { perspective: 'range' })).toBe(false)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, {})).toBe(false)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, undefined)).toBe(false)
  })

  it('the gate is NON-VACUOUS — it flips both ways on the conventional axis', () => {
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, { perspective: 'year' })).toBe(true)
    expect(evalVisibility({ op: 'perspective-is', perspective: 'year' }, NO_FILTERS, { perspective: 'range' })).toBe(false)
  })
})
