// ── threshold.fitness — conditional formatting is ORDERED · ADDITIVE · HONEST ──
//
//  The invariant this locks (the numeric-range sibling of value-mapping):
//   • ORDERED — a value takes the presentation of the HIGHEST breakpoint it reaches,
//     independent of authoring order (a monotonic step function, Grafana thresholds).
//   • ADDITIVE (Law 8) — no thresholds (or no match) ⇒ null ⇒ the value renders as-is.
//   • HONEST (Law 11) — a non-finite / null / undefined value ⇒ null: a no-data /
//     masked / unbound value is NEVER coloured (no fabricated-0 formatting).
//   • TOKEN-BOUND (Law 2/3) — the colour is a KEY carried through, never resolved here.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { resolveValueThreshold } from './threshold'
import type { ValueThreshold }   from './threshold'

// A canonical two-sided threshold: below-zero danger (down glyph), at/above-zero
// success (up glyph), authored OUT of order to prove resolution is by bound, not index.
const STEPS: ValueThreshold = [
  { from: 0, token: 'status.positive-fg', glyph: 'up',   state: { ka: 'ზრდა', en: 'On track' } },
  {          token: 'status.negative-fg', glyph: 'down', state: { ka: 'ვარდნა', en: 'Below target' } }, // base (−∞)
]

describe('resolveValueThreshold — ordered numeric breakpoints (Grafana step semantics)', () => {
  it('a value below the first breakpoint takes the BASE step', () => {
    expect(resolveValueThreshold(-3.2, STEPS)).toEqual({
      token: 'status.negative-fg', glyph: 'down', state: { ka: 'ვარდნა', en: 'Below target' },
    })
  })

  it('a value at the breakpoint takes that step (inclusive lower bound)', () => {
    expect(resolveValueThreshold(0, STEPS)).toEqual({
      token: 'status.positive-fg', glyph: 'up', state: { ka: 'ზრდა', en: 'On track' },
    })
  })

  it('a value above the breakpoint takes the HIGHEST step it reaches', () => {
    expect(resolveValueThreshold(12.5, STEPS)?.token).toBe('status.positive-fg')
  })

  it('resolution is by numeric bound, not authoring order', () => {
    const shuffled: ValueThreshold = [
      { from: 10, token: 'status.warning-fg' },
      { from: 0,  token: 'status.positive-fg' },
      {           token: 'status.negative-fg' }, // base
    ]
    expect(resolveValueThreshold(-1, shuffled)?.token).toBe('status.negative-fg')
    expect(resolveValueThreshold(5,  shuffled)?.token).toBe('status.positive-fg')
    expect(resolveValueThreshold(50, shuffled)?.token).toBe('status.warning-fg')
  })
})

describe('resolveValueThreshold — ADDITIVE (Law 8): absent / no match ⇒ null', () => {
  it('no thresholds authored ⇒ null (value renders unchanged)', () => {
    expect(resolveValueThreshold(5, undefined)).toBeNull()
    expect(resolveValueThreshold(5, [])).toBeNull()
  })

  it('no step reaches the value (all `from` above it, no base) ⇒ null', () => {
    const noBase: ValueThreshold = [{ from: 100, token: 'status.positive-fg' }]
    expect(resolveValueThreshold(5, noBase)).toBeNull()
  })

  it('a matched step with NO presentation ⇒ null (nothing to apply)', () => {
    expect(resolveValueThreshold(5, [{ from: 0 }])).toBeNull()
  })
})

describe('resolveValueThreshold — HONEST (Law 11): a non-value is never formatted', () => {
  it('null / undefined value ⇒ null (a no-data / unbound cell is not coloured)', () => {
    expect(resolveValueThreshold(null, STEPS)).toBeNull()
    expect(resolveValueThreshold(undefined, STEPS)).toBeNull()
  })

  it('a non-finite value (NaN / ±Infinity) ⇒ null', () => {
    expect(resolveValueThreshold(Number.NaN, STEPS)).toBeNull()
    expect(resolveValueThreshold(Number.POSITIVE_INFINITY, STEPS)).toBeNull()
    expect(resolveValueThreshold(Number.NEGATIVE_INFINITY, STEPS)).toBeNull()
  })
})

describe('resolveValueThreshold — TOKEN-BOUND (Law 2/3): the colour is a carried KEY', () => {
  it('the result carries the token KEY verbatim — no CSS / hex resolution here', () => {
    const r = resolveValueThreshold(-1, STEPS)
    expect(r?.token).toBe('status.negative-fg')
    // No `var(--…)`, no `#…` — resolution is the consumer's job (the token spine).
    expect(r?.token).not.toMatch(/^var\(|^#/)
  })

  it('is pure — resolving does not mutate the input steps', () => {
    const steps: ValueThreshold = [{ from: 0, token: 'status.positive-fg' }, { token: 'status.negative-fg' }]
    const snapshot = JSON.parse(JSON.stringify(steps))
    resolveValueThreshold(5, steps)
    expect(steps).toEqual(snapshot)
  })
})
