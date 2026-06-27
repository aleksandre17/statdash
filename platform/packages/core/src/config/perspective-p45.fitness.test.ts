// ── Perspective Axis P4.5 fitness — the engine OWNS the time binding ──────────
//
//  Four NON-VACUOUS fitness functions for P4.5 (the three additive engine
//  capabilities + the additive-identity guarantee). Each asserts over real inputs,
//  PROVES the new capability against what the legacy two-bar mechanism produces, and
//  would FAIL if additivity (byte-identity for un-opted configs) regressed.
//
//    FF-BINDING-PIN-CTX-REF        — a timeBinding.pin:{$ctx:'<param>'} writes
//      ctx.dims[dim] = the value the legacy `pick:last` year default resolved
//      (character-identical); an unset/NaN pin writes NOTHING (the all-years path).
//
//    FF-BINDING-TARGET-KEYS        — a window with targetKeys:{from,to} writes those
//      declared keys = legacy range-bar bounds; ABSENT targetKeys writes
//      `${dim}From`/`${dim}To` byte-for-byte.
//
//    FF-PERSPECTIVE-DEFAULT-GATE   — in a collapsed single-bar 2-perspective page the
//      non-active perspective's owned param does NOT resolve (range ⇒ `time` unset ⇒
//      full span); the active perspective's owned params DO. A no-binding page yields
//      empty ownership ⇒ the React gate reduces to the legacy `barShowWhen` branch.
//
//    FF-BINDING-ADDITIVE-IDENTITY  — every path with NO pin/targetKeys/binding is
//      byte-identical to pre-P4.5 (the legacy mechanism is untouched / inert).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { SectionContext } from '../core/context'
import type { PerspectivesByParam } from './perspective-axis'
import {
  scopeCtxByPerspective,
  perspectiveOwnedParamKeys,
} from './perspective-axis-parser'

// ── helpers ─────────────────────────────────────────────────────────────────

function ctx(dims: Record<string, number | string>): SectionContext {
  return { timeMode: 'year', dims }
}

// The geostat-shaped collapsed axis (what P5 will author): the `year` perspective
// PINS time to the user-tracked `year` param via a {$ctx} ref; the `range`
// perspective WINDOWS to the user-tracked `fromYear`/`toYear` params and writes
// those EXACT keys (targetKeys) so the existing resolvers read them.
const GEOSTAT_AXIS: PerspectivesByParam = {
  perspective: {
    perspectives: [
      { id: 'year',  label: { ka: 'წელი', en: 'Year' },
        scope: { timeBinding: { dim: 'time', pin: { $ctx: 'year' } } } },
      { id: 'range', label: { ka: 'პერიოდი', en: 'Range' },
        scope: { timeBinding: {
          dim: 'time',
          range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }],
          targetKeys: { from: 'fromYear', to: 'toYear' },
        } } },
    ],
  },
}

// ── FF-BINDING-PIN-CTX-REF ───────────────────────────────────────────────────

describe('FF-BINDING-PIN-CTX-REF — a {$ctx} pin writes the user-tracked year into ctx.dims[dim]', () => {

  it('resolves the pin ref to the SAME value the legacy `year` param holds', () => {
    // Legacy: the `year` bar param (pick:last) resolved year=2025 into ctx.dims.year.
    // The pin reads that SAME param ⇒ ctx.dims.time = 2025 (character-identical).
    const c = ctx({ year: 2025, geo: 'GE' })
    const out = scopeCtxByPerspective(c, GEOSTAT_AXIS, { perspective: 'year' })
    expect(out.dims.time).toBe(2025)
    expect(out.dims.geo).toBe('GE')          // sibling untouched
    expect(c.dims.time).toBeUndefined()      // source never mutated
  })

  it('both locales: a string year ref pins the identical character value', () => {
    const c = ctx({ year: '2025' })
    const out = scopeCtxByPerspective(c, GEOSTAT_AXIS, { perspective: 'year' })
    expect(out.dims.time).toBe('2025')
  })

  it('an UNSET pin (absent / empty / 0 / NaN) writes NOTHING — the all-years path', () => {
    // The structural parity move: an empty year param leaves `time` unset (full span),
    // exactly what the hidden year-bar achieves in legacy range mode.
    expect(scopeCtxByPerspective(ctx({}),         GEOSTAT_AXIS, { perspective: 'year' }).dims.time).toBeUndefined()
    expect(scopeCtxByPerspective(ctx({ year: '' }), GEOSTAT_AXIS, { perspective: 'year' }).dims.time).toBeUndefined()
    expect(scopeCtxByPerspective(ctx({ year: 0 }),  GEOSTAT_AXIS, { perspective: 'year' }).dims.time).toBeUndefined()
    // And the ctx is the IDENTITY when nothing is written (no spurious clone).
    const c = ctx({})
    expect(scopeCtxByPerspective(c, GEOSTAT_AXIS, { perspective: 'year' })).toBe(c)
  })

  it('a LITERAL pin pins that literal (no ctx ref needed)', () => {
    const axis: PerspectivesByParam = {
      perspective: { perspectives: [
        { id: 'year', label: { ka: 'წ', en: 'Y' }, scope: { timeBinding: { dim: 'time', pin: 2019 } } },
      ] },
    }
    expect(scopeCtxByPerspective(ctx({}), axis, { perspective: 'year' }).dims.time).toBe(2019)
  })

})

// ── FF-BINDING-TARGET-KEYS ───────────────────────────────────────────────────

describe('FF-BINDING-TARGET-KEYS — the window writes the DECLARED destination keys', () => {

  it('declared targetKeys ⇒ the window writes fromYear/toYear (the keys the resolvers read)', () => {
    const c = ctx({ fromYear: 2010, toYear: 2024 })
    const out = scopeCtxByPerspective(c, GEOSTAT_AXIS, { perspective: 'range' })
    // The window resolves [fromYear,toYear] and writes them BACK under the same keys —
    // identical to what the legacy range-bar params hold while both coexist.
    expect(out.dims.fromYear).toBe(2010)
    expect(out.dims.toYear).toBe(2024)
    // It does NOT write the conventional timeFrom/timeTo (nobody reads those here).
    expect(out.dims.timeFrom).toBeUndefined()
    expect(out.dims.timeTo).toBeUndefined()
  })

  it('ABSENT targetKeys ⇒ the conventional `${dim}From`/`${dim}To` byte-for-byte', () => {
    const noKeys: PerspectivesByParam = {
      perspective: { perspectives: [
        { id: 'range', label: { ka: 'პ', en: 'R' },
          scope: { timeBinding: { dim: 'time', range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }] } } },
      ] },
    }
    const out = scopeCtxByPerspective(ctx({ fromYear: 2010, toYear: 2024 }), noKeys, { perspective: 'range' })
    expect(out.dims.timeFrom).toBe(2010)   // pre-P4.5 behaviour, unchanged
    expect(out.dims.timeTo).toBe(2024)
    expect(out.dims.fromYear).toBe(2010)   // the source key is left as-is (only echoed)
  })

})

// ── FF-PERSPECTIVE-DEFAULT-GATE ──────────────────────────────────────────────

describe('FF-PERSPECTIVE-DEFAULT-GATE — default resolution follows perspective ownership', () => {

  it('range active ⇒ year-owned `year` is owned by a NON-active perspective ⇒ suppressed', () => {
    const own = perspectiveOwnedParamKeys(GEOSTAT_AXIS, { perspective: 'range' })
    // `year` (the pin source) is owned by the year perspective only ⇒ in `all` but
    // NOT `active` ⇒ the React gate suppresses its default ⇒ ctx.dims.time stays unset
    // ⇒ the dynamics timeseries renders the FULL SPAN (the parity fix, no two bars).
    expect(own.all.has('year')).toBe(true)
    expect(own.active.has('year')).toBe(false)
    // fromYear/toYear ARE owned by the active range perspective ⇒ they resolve.
    expect(own.active.has('fromYear')).toBe(true)
    expect(own.active.has('toYear')).toBe(true)
  })

  it('year active ⇒ `year` resolves; fromYear/toYear owned by the non-active range ⇒ suppressed', () => {
    const own = perspectiveOwnedParamKeys(GEOSTAT_AXIS, { perspective: 'year' })
    expect(own.active.has('year')).toBe(true)
    expect(own.all.has('fromYear')).toBe(true)
    expect(own.active.has('fromYear')).toBe(false)
    expect(own.active.has('toYear')).toBe(false)
  })

  it('replicates the React gate: active-owned resolves, non-active-owned suppressed, unowned bar-gated', () => {
    // Mirror the useFilterState predicate to prove the seam end-to-end without React.
    const own = perspectiveOwnedParamKeys(GEOSTAT_AXIS, { perspective: 'range' })
    const resolves = (key: string, barVisible: boolean): boolean =>
      own.active.has(key) || (!own.all.has(key) && barVisible)
    expect(resolves('year',     true)).toBe(false)  // non-active-owned ⇒ suppressed even if a bar shows it
    expect(resolves('fromYear', true)).toBe(true)   // active-owned ⇒ always resolves
    expect(resolves('geo',      true)).toBe(true)    // unowned ⇒ legacy bar-gated (visible ⇒ resolves)
    expect(resolves('geo',      false)).toBe(false)  // unowned ⇒ legacy bar-gated (hidden ⇒ suppressed)
  })

})

// ── FF-BINDING-ADDITIVE-IDENTITY ─────────────────────────────────────────────

describe('FF-BINDING-ADDITIVE-IDENTITY — no binding ⇒ byte-identical to pre-P4.5', () => {

  it('no axes ⇒ scopeCtxByPerspective is the IDENTITY (same reference)', () => {
    const c = ctx({ time: 2020, geo: 'GE' })
    expect(scopeCtxByPerspective(c, undefined, undefined)).toBe(c)
  })

  it('no axes ⇒ ownership is empty ⇒ the React gate reduces to the legacy bar branch', () => {
    const own = perspectiveOwnedParamKeys(undefined, undefined)
    expect(own.active.size).toBe(0)
    expect(own.all.size).toBe(0)
    // The predicate with empty ownership === `!barShowWhen || evalWhen(...)` exactly.
    const resolves = (barVisible: boolean): boolean =>
      own.active.has('anything') || (!own.all.has('anything') && barVisible)
    expect(resolves(true)).toBe(true)
    expect(resolves(false)).toBe(false)
  })

  it('a perspective with NO timeBinding ⇒ identity ctx + empty ownership', () => {
    const noScope: PerspectivesByParam = {
      perspective: { perspectives: [{ id: 'year', label: { ka: 'წ', en: 'Y' } }] },
    }
    const c = ctx({ time: 2020 })
    expect(scopeCtxByPerspective(c, noScope, { perspective: 'year' })).toBe(c)
    const own = perspectiveOwnedParamKeys(noScope, { perspective: 'year' })
    expect(own.all.size).toBe(0)
  })

  it('the LEGACY literal-list pin + `${dim}From`/`${dim}To` window (pre-P4.5 forms) still resolve unchanged', () => {
    // The pre-P4.5 P1 axis shape (literal year list + range with no targetKeys) is
    // byte-identical under P4.5 — proving the new pin/targetKeys branches are purely
    // additive and do not alter the original branches.
    const legacy: PerspectivesByParam = {
      perspective: { perspectives: [
        { id: 'year',  label: { ka: 'წ', en: 'Y' }, scope: { timeBinding: { dim: 'time', range: [2024] } } },
        { id: 'range', label: { ka: 'პ', en: 'R' }, scope: { timeBinding: { dim: 'time', range: [{ $ctx: 'fromYear' }, { $ctx: 'toYear' }] } } },
      ] },
    }
    expect(scopeCtxByPerspective(ctx({}), legacy, { perspective: 'year' }).dims.time).toBe(2024)
    const r = scopeCtxByPerspective(ctx({ fromYear: 2010, toYear: 2024 }), legacy, { perspective: 'range' })
    expect(r.dims.timeFrom).toBe(2010)
    expect(r.dims.timeTo).toBe(2024)
  })

})
