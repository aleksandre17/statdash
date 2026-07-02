// @vitest-environment node
//
// ── applySelection — the pure cross-filter selection reducer ───────────────
//
//  Property + example tests for the ONE reducer every selection surface shares.
//  Encodes the invariants the geograph's inline logic held (toggle idempotence,
//  cap eviction, single-select deselect) so the extraction is behaviour-identical.
//

import { describe, it, expect }  from 'vitest'
import { applySelection }         from './applySelection'

describe('applySelection — replace (single-select)', () => {
  it('sets the value from empty', () => {
    expect(applySelection('replace', '', 'R2')).toBe('R2')
  })
  it('replaces an existing single value', () => {
    expect(applySelection('replace', 'R2', 'R3')).toBe('R3')
  })
  it('re-clicking the sole active value deselects it (→ empty)', () => {
    expect(applySelection('replace', 'R2', 'R2')).toBe('')
  })
})

describe('applySelection — clear', () => {
  it('clears regardless of value', () => {
    expect(applySelection('clear', 'R2,R3', 'R9')).toBe('')
    expect(applySelection('clear', '', 'R2')).toBe('')
  })
})

describe('applySelection — toggle (multi-select CSV OR-set)', () => {
  it('adds when absent', () => {
    expect(applySelection('toggle', '', 'R2')).toBe('R2')
    expect(applySelection('toggle', 'R2', 'R3')).toBe('R2,R3')
  })
  it('removes when present (toggle idempotence: add→remove = identity)', () => {
    expect(applySelection('toggle', 'R2,R3', 'R2')).toBe('R3')
    // add then remove returns to the original set
    const once = applySelection('toggle', 'R3', 'R2')     // R3,R2
    expect(applySelection('toggle', once, 'R2')).toBe('R3')
  })
  it('evicts the OLDEST once max is exceeded (the geograph cap)', () => {
    // max 2: at cap, adding R9 drops the oldest (R2) → keeps last + new
    expect(applySelection('toggle', 'R2,R3', 'R9', 2)).toBe('R3,R9')
  })
  it('respects a higher cap', () => {
    expect(applySelection('toggle', 'R2,R3', 'R9', 10)).toBe('R2,R3,R9')
  })
  it('no cap → unbounded accumulation', () => {
    expect(applySelection('toggle', 'R2,R3,R4', 'R9')).toBe('R2,R3,R4,R9')
  })
  it('is order-invariant to whitespace/empty CSV entries (shared decode SSOT)', () => {
    expect(applySelection('toggle', ' R2 , R3 ,', 'R9', 10)).toBe('R2,R3,R9')
  })
})
