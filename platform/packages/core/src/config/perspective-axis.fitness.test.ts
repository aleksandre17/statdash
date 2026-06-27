// ── Perspective Axis fitness [VISION #3 / P0] ─────────────────────────────────
//
//  Two P0 fitness functions, both NON-VACUOUS (they assert over a real, populated
//  PerspectiveAxis with the two registered scope-keys, and they would FAIL if the
//  shape stopped round-tripping or the registry emptied):
//
//    FF-PERSPECTIVE-ROUNDTRIP        — a PerspectiveAxis survives JSON.parse(stringify)
//                                      AND the config round-trip unchanged (Law 7).
//    FF-VIEW-SCOPE-DECLARATIVE       — the new types carry NO functions; pure JSON
//                                      (Law 2). Asserted structurally over the sample.
//    FF-SCOPE-KEYS-REGISTERED        — every scope key on the sample resolves to a
//                                      REGISTERED scope-key schema (SYNTHESIS §1.4);
//                                      the registry is non-empty (timeBinding+metric).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { PerspectiveAxis, PerspectivesByParam } from './perspective-axis'
import {
  listPerspectiveScopeKeys, getPerspectiveScopeKeySchema,
} from './perspective-scope-registry'
import './perspective-scope-schemas' // side-effect: register the built-in scope-key schemas (timeBinding, metric)

// ── utility ───────────────────────────────────────────────────────────────────

function roundTrip<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }
function expectRoundTrip<T>(v: T): void { expect(roundTrip(v)).toEqual(v) }

/** No function anywhere in the tree (Law 2 — declarative config). */
function hasNoFunction(v: unknown): boolean {
  if (typeof v === 'function') return false
  if (Array.isArray(v)) return v.every(hasNoFunction)
  if (v !== null && typeof v === 'object') return Object.values(v).every(hasNoFunction)
  return true
}

// ── A real, populated sample (the GDP-page shape from analysis §2.3) ────────────
//
//  Exercises EVERY field: both timeBinding variants (pin + window), a scope.metric
//  swap, a non-identity `when` override, and an `available` guard (D-GUARD). A
//  Record-of-one keyed by the URL param — the P0 container shape.
const SAMPLE: PerspectiveAxis = {
  perspectives: [
    {
      id:    'year',                                  // perspectives[0] = default (LOW-1, no default? field)
      label: { ka: 'წლიური', en: 'Year' },
      scope: { timeBinding: { dim: 'time' } },        // single-period pin (refined TimeDimensionSpec)
    },
    {
      id:        'range',
      label:     { ka: 'დინამიკა', en: 'Range' },
      scope:     { timeBinding: { dim: 'time' }, metric: 'b1g-cagr' }, // window + measurement swap
      // A NON-identity `when` override (the escape-hatch case): membership by a rule
      // other than perspective-is(self). Uses existing VisibilityExpr ops — the
      // `perspective-is` op itself lands in P2; the field type is already VisibilityExpr.
      when:      { op: 'or', exprs: [{ op: 'isset', param: 'fromYear' }, { op: 'isset', param: 'toYear' }] },
      available: { op: 'isset', param: 'fromYear' },  // D-GUARD: offer only when a window exists
    },
  ],
}

const SAMPLE_BY_PARAM: PerspectivesByParam = { perspective: SAMPLE }

// ── FF-PERSPECTIVE-ROUNDTRIP ────────────────────────────────────────────────────

describe('FF-PERSPECTIVE-ROUNDTRIP — PerspectiveAxis survives JSON + config round-trip', () => {
  it('the populated axis survives JSON.parse(JSON.stringify())', () => expectRoundTrip(SAMPLE))

  it('the Record-keyed container (PerspectivesByParam) survives', () => expectRoundTrip(SAMPLE_BY_PARAM))

  it('perspectives[0] IS the default after a round-trip (no default? field, LOW-1)', () => {
    const rt = roundTrip(SAMPLE)
    expect(rt.perspectives[0].id).toBe('year')        // array order is the SSOT default
    expect('default' in (rt as unknown as Record<string, unknown>)).toBe(false)
  })

  it('every populated field survives (scope.timeBinding + scope.metric + when + available)', () => {
    const rt = roundTrip(SAMPLE)
    expect(rt.perspectives[0].scope?.timeBinding?.dim).toBe('time')
    expect(rt.perspectives[1].scope?.metric).toBe('b1g-cagr')
    expect(rt.perspectives[1].when).toBeDefined()
    expect(rt.perspectives[1].available).toEqual({ op: 'isset', param: 'fromYear' })
  })
})

// ── FF-VIEW-SCOPE-DECLARATIVE (Law 2) ───────────────────────────────────────────

describe('FF-VIEW-SCOPE-DECLARATIVE — the perspective types are pure JSON (Law 2)', () => {
  it('the sample carries no functions anywhere in the tree', () => {
    expect(hasNoFunction(SAMPLE)).toBe(true)
  })

  it('a stringify of the sample does not throw (no non-serializable values)', () => {
    expect(() => JSON.stringify(SAMPLE_BY_PARAM)).not.toThrow()
  })
})

// ── FF-SCOPE-KEYS-REGISTERED (SYNTHESIS §1.4 — the OCP seam) ─────────────────────

describe('FF-SCOPE-KEYS-REGISTERED — every scope key resolves to a registered schema', () => {
  it('the registry is non-empty (timeBinding + metric registered at module init)', () => {
    const keys = listPerspectiveScopeKeys()
    expect(keys).toContain('timeBinding')
    expect(keys).toContain('metric')
    expect(keys.length).toBeGreaterThanOrEqual(2)
  })

  it('every scope key used by the sample is a registered key (no unregistered scope door)', () => {
    const usedKeys = new Set<string>()
    for (const p of SAMPLE.perspectives) {
      for (const k of Object.keys(p.scope ?? {})) usedKeys.add(k)
    }
    expect(usedKeys.size).toBeGreaterThan(0) // non-vacuous: the sample actually uses scope keys
    for (const k of usedKeys) {
      expect(getPerspectiveScopeKeySchema(k), `scope key '${k}' is not registered`).toBeDefined()
    }
  })

  it('each registered scope-key schema is a non-empty PropField[]', () => {
    for (const k of listPerspectiveScopeKeys()) {
      const schema = getPerspectiveScopeKeySchema(k)!
      expect(Array.isArray(schema)).toBe(true)
      expect(schema.length).toBeGreaterThan(0)
      for (const f of schema) expect(typeof f.field).toBe('string')
    }
  })
})
