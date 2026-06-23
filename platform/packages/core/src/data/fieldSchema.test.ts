// @vitest-environment node
import { describe, it, expect }                                from 'vitest'
import type { FieldSchema }                                    from './fieldSchema'
import { suggestEncodings, toFieldMeta, schemasToFieldMeta }  from './fieldSchema'

// ── suggestEncodings ───────────────────────────────────────────────────────────

describe('suggestEncodings', () => {
  it('time dimension → [x] only', () => {
    expect(suggestEncodings('dimension', 'time')).toEqual(['x'])
  })

  it('string dimension → [x, color, facet]', () => {
    expect(suggestEncodings('dimension', 'string')).toEqual(['x', 'color', 'facet'])
  })

  it('number dimension → [x, color, facet]', () => {
    expect(suggestEncodings('dimension', 'number')).toEqual(['x', 'color', 'facet'])
  })

  it('boolean dimension → [color, facet]', () => {
    expect(suggestEncodings('dimension', 'boolean')).toEqual(['color', 'facet'])
  })

  it('unknown type dimension → treated as categorical [x, color, facet]', () => {
    expect(suggestEncodings('dimension', 'unknown')).toEqual(['x', 'color', 'facet'])
  })

  it('measure (number) → [y, size]', () => {
    expect(suggestEncodings('measure', 'number')).toEqual(['y', 'size'])
  })

  it('measure (any type) → [y, size]', () => {
    expect(suggestEncodings('measure', 'string')).toEqual(['y', 'size'])
    expect(suggestEncodings('measure', 'time')).toEqual(['y', 'size'])
    expect(suggestEncodings('measure', 'boolean')).toEqual(['y', 'size'])
    expect(suggestEncodings('measure', 'unknown')).toEqual(['y', 'size'])
  })

  it('meta (any type) → []', () => {
    expect(suggestEncodings('meta', 'string')).toEqual([])
    expect(suggestEncodings('meta', 'number')).toEqual([])
    expect(suggestEncodings('meta', 'time')).toEqual([])
  })

  it('is deterministic — repeated calls return equal arrays', () => {
    expect(suggestEncodings('dimension', 'string')).toEqual(suggestEncodings('dimension', 'string'))
  })
})

// ── toFieldMeta ─────────────────────────────────────────────────────────────────

describe('toFieldMeta', () => {
  it('preserves all FieldSchema fields', () => {
    const schema: FieldSchema = {
      name:         'value',
      type:         'number',
      role:         'measure',
      unit:         '%',
      displayLabel: 'Value',
    }
    const meta = toFieldMeta(schema)
    expect(meta.name).toBe('value')
    expect(meta.type).toBe('number')
    expect(meta.role).toBe('measure')
    expect(meta.unit).toBe('%')
    expect(meta.displayLabel).toBe('Value')
  })

  it('adds suggestedEncodings derived from role + type', () => {
    const schema: FieldSchema = { name: 'time', type: 'time', role: 'dimension' }
    expect(toFieldMeta(schema).suggestedEncodings).toEqual(['x'])
  })

  it('derives [y, size] for a measure field', () => {
    const schema: FieldSchema = { name: 'gdp', type: 'number', role: 'measure' }
    expect(toFieldMeta(schema).suggestedEncodings).toEqual(['y', 'size'])
  })
})

// ── schemasToFieldMeta ──────────────────────────────────────────────────────────

describe('schemasToFieldMeta', () => {
  it('maps an array correctly', () => {
    const schemas: FieldSchema[] = [
      { name: 'time',  type: 'time',   role: 'dimension' },
      { name: 'value', type: 'number', role: 'measure' },
      { name: 'id',    type: 'string', role: 'meta' },
    ]
    const metas = schemasToFieldMeta(schemas)
    expect(metas).toHaveLength(3)
    expect(metas[0].suggestedEncodings).toEqual(['x'])
    expect(metas[1].suggestedEncodings).toEqual(['y', 'size'])
    expect(metas[2].suggestedEncodings).toEqual([])
  })

  it('empty array → []', () => {
    expect(schemasToFieldMeta([])).toEqual([])
  })
})
