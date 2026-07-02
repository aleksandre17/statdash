// ── FF-EFFECTS-REACTIVE + FF-NO-RETIRED-EFFECTS — C3 reactive-effects recovery ──
//
//  C3 recovers the reactive param-mutation capability lost at the P5 "byte-identical"
//  perspective migration (which modeled ONLY visibility). It is re-homed FORWARD on the
//  perspective seam as onEnter/onExit — a first-class, JSON-serializable transition
//  capability — NOT the retired `effects`/`applyEffects` subsystem.
//
//  FF-EFFECTS-REACTIVE  — entering a perspective applies its onEnter.set (params mutate:
//                         year cleared, sector pinned); leaving applies onExit. Pure,
//                         deterministic, reuses the perspective-is predicate + ExprVal.
//  FF-NO-RETIRED-EFFECTS — the retired `applyEffects` / `Effect[]` / `.effects` names do
//                          NOT reappear in the reactive-effects code (the check-laws
//                          retirement guards from 4ccd042 stay green).
//
// @vitest-environment node

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'

import type { PerspectiveAxis } from './perspective-axis'
import { applyPerspectiveEffects } from './perspective-effects'

// The geostat-shaped axis: `year` (point pin) + `range` (window). `range` carries the
// recovered reactive effects — enter clears the stale single `year`; exit clears the
// span. A synthetic `sector` pin on enter exercises the literal-set (pin) capability.
const axis: PerspectiveAxis = {
  perspectives: [
    {
      id:    'year',
      label: { ka: 'წლიური', en: 'Annual' },
      scope: { binding: { dim: 'time', selection: { kind: 'point', at: { $ctx: 'year' } } } },
    },
    {
      id:    'range',
      label: { ka: 'დინამიკა', en: 'Dynamics' },
      scope: {
        binding: {
          dim: 'time',
          selection: {
            kind: 'window',
            from: { $ctx: 'fromYear' },
            to:   { $ctx: 'toYear' },
            targetKeys: { from: 'fromYear', to: 'toYear' },
          },
        },
      },
      onEnter: { set: { year: null, sector: '_T' } },   // clear stale year + pin sector
      onExit:  { set: { fromYear: null, toYear: null } }, // leaving clears the span
    },
  ],
}

const PARAM = 'mode'

describe('FF-EFFECTS-REACTIVE — a perspective transition mutates params', () => {
  it('ENTERING range applies range.onEnter (year cleared, sector pinned _T)', () => {
    const muts = applyPerspectiveEffects(axis, PARAM, 'year', 'range', { year: '2023' })
    expect(muts['year']).toBe('')       // cleared (null → empty write → param deleted)
    expect(muts['sector']).toBe('_T')   // pinned to a literal
  })

  it('EXITING range applies range.onExit (span cleared)', () => {
    const muts = applyPerspectiveEffects(axis, PARAM, 'range', 'year', { fromYear: '2015', toYear: '2020' })
    expect(muts['fromYear']).toBe('')
    expect(muts['toYear']).toBe('')
    // year has no onEnter, so entering `year` adds nothing of its own.
    expect(muts['year']).toBeUndefined()
  })

  it('a NO-OP transition (same id) yields an empty map — nothing mutates', () => {
    expect(applyPerspectiveEffects(axis, PARAM, 'range', 'range', { year: '2023' })).toEqual({})
    expect(applyPerspectiveEffects(axis, PARAM, 'year', 'year', {})).toEqual({})
  })

  it('resolves an ExprVal ref in `set` against the current filter params (sandboxed evaluator)', () => {
    const refAxis: PerspectiveAxis = {
      perspectives: [
        { id: 'a', label: { ka: 'ა', en: 'A' } },
        { id: 'b', label: { ka: 'ბ', en: 'B' }, onEnter: { set: { echo: { $ctx: 'src' } } } },
      ],
    }
    const muts = applyPerspectiveEffects(refAxis, PARAM, 'a', 'b', { src: 'from-params' })
    expect(muts['echo']).toBe('from-params')  // {$ctx:'src'} resolved from params
  })

  it('is PURE + DETERMINISTIC — identical inputs yield an identical map, no input mutation', () => {
    const params = { year: '2023' }
    const a = applyPerspectiveEffects(axis, PARAM, 'year', 'range', params)
    const b = applyPerspectiveEffects(axis, PARAM, 'year', 'range', params)
    expect(a).toEqual(b)
    expect(params).toEqual({ year: '2023' })  // scope was cloned — no side effect
  })

  it('REUSES perspective-is: only the def whose membership FLIPS fires its effect', () => {
    // Neither def flips membership between two unrelated ids ⇒ range.onEnter must NOT
    // fire spuriously. (Both `wasHere` and `isHere` false for range on year↔year.)
    const muts = applyPerspectiveEffects(axis, PARAM, 'year', 'year', { year: '2023' })
    expect(muts).toEqual({})
  })
})

// ── FF-NO-RETIRED-EFFECTS — the retired names stay dead ─────────────────────────
//
//  The vitest twin of the two check-laws retirement guards (4ccd042): the reactive
//  recovery must NOT resurrect `applyEffects` / `Effect[]` / `.effects`. We scan the
//  reactive-effects source (comment lines stripped, as check-laws does) and assert the
//  retired identifiers are absent — while the NEW vocabulary (applyPerspectiveEffects /
//  onEnter / onExit) is present. The forbidden needles are assembled from fragments so
//  THIS test file never self-matches the check-laws grep.
describe('FF-NO-RETIRED-EFFECTS — retired effects subsystem does not return', () => {
  const here = fileURLToPath(new URL('.', import.meta.url))
  const read = (rel: string) => readFileSync(here + rel, 'utf8')

  // Strip comment lines the way check_ts does, so a mention in a doc-comment is not a hit.
  const codeOf = (src: string) =>
    src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

  const RETIRED = ['apply' + 'Effects', 'Effect' + '[]', '.' + 'effects']

  it('perspective-effects.ts carries the NEW vocabulary, none of the retired names', () => {
    const code = codeOf(read('perspective-effects.ts'))
    expect(code).toContain('applyPerspectiveEffects')
    expect(code).toContain('onEnter')
    expect(code).toContain('onExit')
    for (const needle of RETIRED) expect(code).not.toContain(needle)
  })

  it('the perspective-axis def refinement uses onEnter/onExit, not the retired effects field', () => {
    const code = codeOf(read('perspective-axis.ts'))
    expect(code).toContain('onEnter')
    expect(code).toContain('onExit')
    for (const needle of RETIRED) expect(code).not.toContain(needle)
  })
})
