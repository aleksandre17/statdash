import { describe, it, expect } from 'vitest'
import { applyValueMap } from './value-mapping'
import type { ValueMapping } from './value-mapping'

describe('applyValueMap — Strategy match dispatch (first-match-wins)', () => {
  it('exact — string-compares so numeric and string codes unify', () => {
    const m: ValueMapping[] = [{ match: { kind: 'exact', value: 0 }, text: { en: 'No data', ka: 'არ არის' } }]
    expect(applyValueMap(0, m)?.text).toEqual({ en: 'No data', ka: 'არ არის' })
    expect(applyValueMap('0', m)?.text).toEqual({ en: 'No data', ka: 'არ არის' })
    expect(applyValueMap(1, m)).toBeNull()
  })

  it('range — inclusive bounds, either side open, non-numeric never matches', () => {
    const m: ValueMapping[] = [{ match: { kind: 'range', from: 100 }, token: 'status.negative-fg' }]
    expect(applyValueMap(150, m)?.token).toBe('status.negative-fg')
    expect(applyValueMap(100, m)?.token).toBe('status.negative-fg')
    expect(applyValueMap(99,  m)).toBeNull()
    expect(applyValueMap('x', m)).toBeNull()
    const band: ValueMapping[] = [{ match: { kind: 'range', from: 0, to: 50 }, icon: 'check' }]
    expect(applyValueMap(25, band)?.icon).toBe('check')
    expect(applyValueMap(51, band)).toBeNull()
  })

  it('regex — matches string form; an invalid pattern fails soft (no throw)', () => {
    const m: ValueMapping[] = [{ match: { kind: 'regex', pattern: '^GE' }, text: 'Georgia' }]
    expect(applyValueMap('GEO', m)?.text).toBe('Georgia')
    expect(applyValueMap('XKX', m)).toBeNull()
    const bad: ValueMapping[] = [{ match: { kind: 'regex', pattern: '(' }, text: 'never' }]
    expect(() => applyValueMap('GE', bad)).not.toThrow()
    expect(applyValueMap('GE', bad)).toBeNull()
  })

  it('empty — matches null / undefined / "" only', () => {
    const m: ValueMapping[] = [{ match: { kind: 'empty' }, text: '—' }]
    expect(applyValueMap(null,      m)?.text).toBe('—')
    expect(applyValueMap(undefined, m)?.text).toBe('—')
    expect(applyValueMap('',        m)?.text).toBe('—')
    expect(applyValueMap(0,         m)).toBeNull()   // 0 is a value, not empty
  })

  it('first-match-wins (Grafana semantics)', () => {
    const m: ValueMapping[] = [
      { match: { kind: 'range', from: 0 },        token: 'status.positive-fg' },
      { match: { kind: 'range', from: 100 },      token: 'status.negative-fg' },
    ]
    expect(applyValueMap(150, m)?.token).toBe('status.positive-fg')   // first rule wins
  })

  it('no mappings / no match → null (consumer falls back to the raw value)', () => {
    expect(applyValueMap(5, undefined)).toBeNull()
    expect(applyValueMap(5, [])).toBeNull()
  })
})

// The authoring schema (VALUE_MAPPING_SCHEMA) lives in apps/panel, not the engine —
// its token-bound, no-literal-colour invariant + bilingual-label completeness are
// asserted there (valueMappingAuthorable.fitness.test.ts) and in the plugins
// FF-VALUE-MAPPING gate. core owns only the runtime contract (type + resolver).
