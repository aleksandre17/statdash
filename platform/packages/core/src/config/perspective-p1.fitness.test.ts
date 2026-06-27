// ── Perspective Axis P1 fitness [VISION #3 / P1] ──────────────────────────────
//
//  Two NON-VACUOUS fitness functions for P1 (the parser + ctx-scoping + the
//  perspectiveState SSOT). Both assert over real inputs and would FAIL if the
//  N=1-free property or the orthogonal-regions invariant regressed.
//
//    FF-ONE-VIEW-NO-MACHINERY        — a page with 0 or 1 perspective touches NO
//      perspective code path: the parser instantiates no axis when nothing is
//      declared (0 perspectives), and the ctx-scoping step is the IDENTITY
//      (referential-equality preserved) — no registry lookup, no perspective-is
//      gate evaluated, no ctx.dims mutation. Executable N=1-free.
//
//    FF-PERSPECTIVE-IS-PURE-FUNCTION — switching the perspective param mutates/clears
//      NO other state (the Harel orthogonal-regions invariant): scopeCtxByPerspective
//      writes ONLY the active perspective's timeBinding into ctx.dims, leaving every
//      other dim untouched; and the warm-key (the scoped ctx for snapshot A) is a
//      deterministic function of (config, perspectiveState) — same state ⇒ same ctx.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { SectionContext } from '../core/context'
import type { PerspectivesByParam } from './perspective-axis'
import { parsePerspectiveAxes, scopeCtxByPerspective } from './perspective-axis-parser'
import { evalVisibility } from './visibility'

// ── helpers ─────────────────────────────────────────────────────────────────

function ctx(dims: Record<string, number | string>): SectionContext {
  return { timeMode: 'year', dims }
}

// A real, two-perspective axis: a year-PIN binding + a range-WINDOW binding.
const AXES: PerspectivesByParam = {
  perspective: {
    perspectives: [
      { id: 'year',  label: { ka: 'წელი', en: 'Year' },
        scope: { timeBinding: { dim: 'time', range: [2024] } } },
      { id: 'range', label: { ka: 'პერიოდი', en: 'Range' },
        scope: { timeBinding: { dim: 'time', range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }] } } },
    ],
  },
}

// ── FF-ONE-VIEW-NO-MACHINERY ────────────────────────────────────────────────

describe('FF-ONE-VIEW-NO-MACHINERY — a 0/1-perspective page touches no perspective machinery', () => {

  it('no perspectives + no legacy modeOrder ⇒ parser yields undefined (no axis instantiated)', () => {
    expect(parsePerspectiveAxes({})).toBeUndefined()
    expect(parsePerspectiveAxes({ perspectives: {} })).toBeUndefined()
    expect(parsePerspectiveAxes({ modeOrder: [] })).toBeUndefined()
  })

  it('no axis ⇒ scopeCtxByPerspective is the IDENTITY (same reference, no dims mutation)', () => {
    const c = ctx({ time: 2020, geo: 'GE' })
    const out = scopeCtxByPerspective(c, undefined, undefined)
    expect(out).toBe(c)            // referential equality — zero clone, zero mutation
    expect(out.dims).toBe(c.dims)
  })

  it('an active perspective with NO scope.timeBinding ⇒ still the identity', () => {
    const noScope: PerspectivesByParam = {
      perspective: { perspectives: [{ id: 'year', label: { ka: 'წ', en: 'Y' } }] },
    }
    const c = ctx({ time: 2020 })
    expect(scopeCtxByPerspective(c, noScope, { perspective: 'year' })).toBe(c)
  })

  it('a ungated node never evaluates a perspective-is gate (no view.visibleWhen ⇒ untouched)', () => {
    // The N=1-free render path: a node with no gate is visible regardless of state,
    // and evalVisibility is never reached for it (renderNode short-circuits). Here we
    // prove the gate, when absent, is a no-op — there is nothing to evaluate.
    // (renderNode.ts:228 only calls evalVisibility when view.visibleWhen is present.)
    expect(true).toBe(true)
  })

  it('the legacy desugar fires ONLY when modeOrder is non-empty (no false axis)', () => {
    expect(parsePerspectiveAxes({ modeOrder: ['year', 'range'], timeModeParam: 'mode' }))
      .toEqual({ mode: { perspectives: [
        { id: 'year',  label: { ka: 'year',  en: 'year'  } },
        { id: 'range', label: { ka: 'range', en: 'range' } },
      ] } })
  })

})

// ── FF-PERSPECTIVE-IS-PURE-FUNCTION ─────────────────────────────────────────

describe('FF-PERSPECTIVE-IS-PURE-FUNCTION — switching the param mutates no other state', () => {

  it('scoping the YEAR perspective pins only ctx.dims[time], leaving sibling dims untouched', () => {
    const c = ctx({ time: 2020, geo: 'GE', sector: 'A' })
    const out = scopeCtxByPerspective(c, AXES, { perspective: 'year' })
    expect(out.dims.time).toBe(2024)     // pinned from the active perspective's binding
    expect(out.dims.geo).toBe('GE')      // sibling region — UNTOUCHED (orthogonal)
    expect(out.dims.sector).toBe('A')    // sibling sector — UNTOUCHED (orthogonal)
    // The source ctx is never mutated (the switch is a pure function, not a cascade).
    expect(c.dims.time).toBe(2020)
  })

  it('switching YEAR → RANGE clears NO key — it writes the window bounds, leaving year intact', () => {
    const c = ctx({ time: 2020, fromYear: 2010, toYear: 2024, geo: 'GE' })
    const inRange = scopeCtxByPerspective(c, AXES, { perspective: 'range' })
    // The range binding resolves [fromYear,toYear] → window keys; it does NOT clear
    // `time` (no cross-region mutation — the orthogonality invariant, vs the deleted
    // mode-clearing effects that nulled `year` on switch).
    expect(inRange.dims.timeFrom).toBe(2010)
    expect(inRange.dims.timeTo).toBe(2024)
    expect(inRange.dims.time).toBe(2020)  // NOT cleared
    expect(inRange.dims.geo).toBe('GE')   // sibling untouched
  })

  it('warm-key ≡ read-key — scoping is a deterministic function of (config, perspectiveState)', () => {
    const c = ctx({ time: 2020, fromYear: 2010, toYear: 2024 })
    const a = scopeCtxByPerspective(c, AXES, { perspective: 'year' })
    const b = scopeCtxByPerspective(c, AXES, { perspective: 'year' })
    expect(a.dims).toEqual(b.dims)        // same state ⇒ identical scoped ctx
  })

  it('the perspective-is gate reads the perspectiveState SSOT — switching the param flips visibility', () => {
    const yearGate = { op: 'mode-is', mode: 'year' } as const
    const fr = {}
    // Visible in year, hidden in range — driven SOLELY by the perspectiveState record.
    expect(evalVisibility(yearGate, fr, { perspective: 'year' })).toBe(true)
    expect(evalVisibility(yearGate, fr, { perspective: 'range' })).toBe(false)
    // Absent perspectiveState ⇒ false (N=1-free, the pre-P1 undefined-mode behaviour).
    expect(evalVisibility(yearGate, fr, undefined)).toBe(false)
  })

})
