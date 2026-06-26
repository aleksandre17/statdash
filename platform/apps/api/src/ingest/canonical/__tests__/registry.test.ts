// ── Registry-dispatch tests — op + codelist/DSD resolution seams (ADR-0031 §3) ─
//
// The two OCP extension points are data-keyed dispatch tables. These lock:
//   - the `identity` op is registered and is a true passthrough (canonical is
//     pre-transformed); an unknown op fails fast.
//   - `declared` codelist resolution returns the upsert-path descriptor (BAKE-NOW);
//     `reference` + `dsdRef` are reserved seams that throw NOT_IMPLEMENTED until
//     the trigger (SEAM-DEFER, improvement 2) — the type union carries the case so
//     the seam is OPEN without an unused resolver being built.

import { describe, expect, it } from 'vitest'

import { getOp, hasOp, identityOp } from '../ops.js'
import { resolveCodelist, resolveDsdRef } from '../registry.js'

describe('op registry', () => {
  it('registers `identity` as a passthrough', () => {
    expect(hasOp('identity')).toBe(true)
    const rows = [['a', 'b'], ['1', '2']]
    expect(getOp('identity')(rows)).toBe(rows)
    expect(identityOp(rows)).toBe(rows)
  })

  it('fails fast on an unknown op (never a silent passthrough)', () => {
    expect(hasOp('melt')).toBe(false)
    expect(() => getOp('melt')).toThrow(/Unknown canonical op/)
  })
})

describe('codelist/DSD resolution registry', () => {
  it('resolves `declared` to the upsert-path descriptor', () => {
    expect(resolveCodelist({ kind: 'declared', dim: 'geo' })).toEqual({ kind: 'declared', dim: 'geo' })
  })

  it('reserves `reference` resolution as a NOT_IMPLEMENTED seam', () => {
    expect(() => resolveCodelist({ kind: 'reference', id: 'CL_GEO', version: '1.0' }))
      .toThrow(/NOT_IMPLEMENTED/)
  })

  it('reserves whole-DSD `dsdRef` resolution as a NOT_IMPLEMENTED seam', () => {
    expect(() => resolveDsdRef({ id: 'DSD_GDP', version: '1.0' })).toThrow(/NOT_IMPLEMENTED/)
  })
})
