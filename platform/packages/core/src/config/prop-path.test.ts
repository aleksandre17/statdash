// @vitest-environment node
//
// ── prop-path.test.ts — the dot-path grammar read/write PARITY proof ──────────
//
//  SSOT invariant (prop-path.ts): a numeric segment addresses an array index on
//  BOTH sides, so what the Inspector writes (setAtPath) is exactly what the
//  runner reads back (getAtPath). D7 (ADR-022) depends on this: the nested
//  editor emits deep dot-paths like `items.0.value.measure` for an `itemSchema`
//  sub-field, and the store write must "just work" with ZERO new path machinery.
//  These tests pin that the existing grammar ALREADY handles the D7 depth
//  (array-index + multi-level object descent) for both READ and WRITE.
//
import { describe, it, expect } from 'vitest'
import { getAtPath, setAtPath } from './prop-path'

describe('prop-path — getAtPath (read)', () => {
  it('reads a multi-level object path', () => {
    expect(getAtPath({ view: { width: 42 } }, 'view.width')).toBe(42)
  })

  it('reads an array element by numeric segment', () => {
    expect(getAtPath({ fields: ['a', 'b'] }, 'fields.1')).toBe('b')
  })

  it('reads the D7 deep path items.0.value.measure (array index + nested object)', () => {
    const cfg = { items: [{ value: { measure: 'GDP' } }, { value: { measure: 'CPI' } }] }
    expect(getAtPath(cfg, 'items.0.value.measure')).toBe('GDP')
    expect(getAtPath(cfg, 'items.1.value.measure')).toBe('CPI')
  })

  it('returns undefined for a missing/non-object segment (Postel — never throws)', () => {
    expect(getAtPath({ items: [] }, 'items.0.value.measure')).toBeUndefined()
    expect(getAtPath(undefined, 'a.b')).toBeUndefined()
  })
})

describe('prop-path — setAtPath (write) + read/write parity', () => {
  it('writes the D7 deep path items.0.value.measure and reads it back (round-trip parity)', () => {
    const cfg  = { items: [{ value: { measure: 'GDP' } }] }
    const next = setAtPath(cfg, 'items.0.value.measure', 'CPI')
    // parity: what setAtPath wrote is exactly what getAtPath reads
    expect(getAtPath(next, 'items.0.value.measure')).toBe('CPI')
  })

  it('creates intermediate array + object containers on demand for a deep write', () => {
    const next = setAtPath({} as Record<string, unknown>, 'items.0.value.measure', 'GDP')
    expect(getAtPath(next, 'items.0.value.measure')).toBe('GDP')
    expect(Array.isArray((next as { items: unknown }).items)).toBe(true)
  })

  it('is immutable — untouched sibling item + branch stay referentially equal', () => {
    const item1 = { value: { measure: 'GDP' } }
    const item2 = { value: { measure: 'CPI' } }
    const cfg   = { items: [item1, item2], title: 't' }
    const next  = setAtPath(cfg, 'items.0.value.measure', 'PPI')

    expect(next).not.toBe(cfg)
    expect((next as typeof cfg).items).not.toBe(cfg.items)   // touched array cloned
    expect((next as typeof cfg).items[1]).toBe(item2)        // untouched sibling item shared
    expect((next as typeof cfg).title).toBe('t')             // untouched branch kept
    expect(item1.value.measure).toBe('GDP')                  // original not mutated
  })

  it('writes a second sibling sub-field without clobbering the first (accretive object descent)', () => {
    const cfg = { items: [{ value: { measure: 'GDP' } }] }
    const a   = setAtPath(cfg, 'items.0.value.unit', 'index')
    expect(getAtPath(a, 'items.0.value.measure')).toBe('GDP')  // sibling preserved
    expect(getAtPath(a, 'items.0.value.unit')).toBe('index')
  })
})
