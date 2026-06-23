// @vitest-environment node
//
// ── propSchemaToJsonSchema tests — JSON Schema bridge for the Constructor ──
//
//  Tests the PropSchema → JSON Schema Draft-7 conversion.
//  Pure function: no registry, no singletons.
//

import { describe, it, expect } from 'vitest'
import { propSchemaToJsonSchema } from './propSchemaToJsonSchema'
import type { PropField, PropSchema } from './types'

// ── Helpers ────────────────────────────────────────────────────────────

function field(overrides: Partial<PropField> & { field: string; type: PropField['type'] }): PropField {
  return {
    label:   'Test Field',
    ...overrides,
  }
}

// ── Null / empty schema ─────────────────────────────────────────────────

describe('propSchemaToJsonSchema — null / empty input', () => {

  it('null schema → permissive schema (additionalProperties: true)', () => {
    const result = propSchemaToJsonSchema(null)
    expect(result.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(result.type).toBe('object')
    expect(result.additionalProperties).toBe(true)
    expect(result.required).toEqual([])
    expect(result.properties).toEqual({})
  })

  it('undefined schema → permissive schema', () => {
    const result = propSchemaToJsonSchema(undefined)
    expect(result.additionalProperties).toBe(true)
  })

  it('empty array schema → permissive schema', () => {
    const result = propSchemaToJsonSchema([])
    expect(result.additionalProperties).toBe(true)
  })

})

// ── Top-level shape ─────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — top-level shape', () => {

  it('contains required Draft-7 keys', () => {
    const result = propSchemaToJsonSchema([field({ field: 'title', type: 'string' })])
    expect(result.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(result.type).toBe('object')
    expect(result).toHaveProperty('properties')
    expect(result).toHaveProperty('required')
    expect(result.additionalProperties).toBe(false)
  })

  it('is JSON-serializable', () => {
    const schema: PropSchema = [
      field({ field: 'title',  type: 'string',  required: true }),
      field({ field: 'count',  type: 'number',  validation: { min: 0, max: 100 } }),
      field({ field: 'active', type: 'boolean' }),
    ]
    const result = propSchemaToJsonSchema(schema)
    expect(() => JSON.stringify(result)).not.toThrow()
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

})

// ── Type mapping ────────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — PropFieldType → JSON Schema type', () => {

  const cases: Array<[PropField['type'], string | undefined, string | undefined]> = [
    ['string',      'string',  undefined],
    ['number',      'number',  undefined],
    ['boolean',     'boolean', undefined],
    ['object',      'object',  undefined],
    ['array',       'array',   undefined],
    ['color',       'string',  'color'],
    ['icon',        'string',  'icon'],
    ['DataSpec',    'object',  'DataSpec'],
    ['ChartDef',    'object',  'ChartDef'],
  ]

  cases.forEach(([propType, expectedType, expectedComment]) => {
    it(`'${propType}' → type: '${expectedType}'${expectedComment ? `, $comment: '${expectedComment}'` : ''}`, () => {
      const result = propSchemaToJsonSchema([field({ field: 'f', type: propType })])
      const prop = result.properties['f']
      if (expectedType) expect(prop.type).toBe(expectedType)
      if (expectedComment) expect(prop.$comment).toBe(expectedComment)
    })
  })

  it("'LocaleString' → oneOf: [string, object] with $comment", () => {
    const result = propSchemaToJsonSchema([field({ field: 'label', type: 'LocaleString' })])
    const prop = result.properties['label']
    expect(prop.oneOf).toHaveLength(2)
    expect(prop.oneOf![0]).toEqual({ type: 'string' })
    expect(prop.oneOf![1]).toEqual({ type: 'object' })
    expect(prop.$comment).toBe('LocaleString')
  })

})

// ── Required fields ─────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — required fields', () => {

  it('required: true → field appears in required array', () => {
    const result = propSchemaToJsonSchema([
      field({ field: 'title', type: 'string', required: true }),
      field({ field: 'count', type: 'number' }),
    ])
    expect(result.required).toContain('title')
    expect(result.required).not.toContain('count')
  })

  it('no required fields → required array is empty', () => {
    const result = propSchemaToJsonSchema([
      field({ field: 'a', type: 'string' }),
      field({ field: 'b', type: 'boolean' }),
    ])
    expect(result.required).toEqual([])
  })

})

// ── Default values ──────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — default values', () => {

  it('default is carried through for string fields', () => {
    const result = propSchemaToJsonSchema([field({ field: 'mode', type: 'string', default: 'bar' })])
    expect(result.properties['mode'].default).toBe('bar')
  })

  it('default is carried through for number fields', () => {
    const result = propSchemaToJsonSchema([field({ field: 'n', type: 'number', default: 42 })])
    expect(result.properties['n'].default).toBe(42)
  })

  it('no default → default key absent', () => {
    const result = propSchemaToJsonSchema([field({ field: 'x', type: 'string' })])
    expect(result.properties['x']).not.toHaveProperty('default')
  })

})

// ── Options → enum ──────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — options → enum', () => {

  it('options produce an enum array of value strings', () => {
    const result = propSchemaToJsonSchema([field({
      field:   'chartType',
      type:    'string',
      options: [
        { value: 'bar',  label: 'Bar chart'  },
        { value: 'line', label: 'Line chart' },
      ],
    })])
    expect(result.properties['chartType'].enum).toEqual(['bar', 'line'])
  })

  it('empty options array → no enum property', () => {
    const result = propSchemaToJsonSchema([field({ field: 'x', type: 'string', options: [] })])
    expect(result.properties['x']).not.toHaveProperty('enum')
  })

})

// ── Validation constraints ──────────────────────────────────────────────

describe('propSchemaToJsonSchema — validation constraints', () => {

  it('min → minimum', () => {
    const result = propSchemaToJsonSchema([field({ field: 'n', type: 'number', validation: { min: 5 } })])
    expect(result.properties['n'].minimum).toBe(5)
  })

  it('max → maximum', () => {
    const result = propSchemaToJsonSchema([field({ field: 'n', type: 'number', validation: { max: 100 } })])
    expect(result.properties['n'].maximum).toBe(100)
  })

  it('pattern → pattern', () => {
    const result = propSchemaToJsonSchema([field({ field: 's', type: 'string', validation: { pattern: '^[A-Z]+$' } })])
    expect(result.properties['s'].pattern).toBe('^[A-Z]+$')
  })

  it('no validation → no minimum / maximum / pattern', () => {
    const result = propSchemaToJsonSchema([field({ field: 'x', type: 'string' })])
    const prop = result.properties['x']
    expect(prop).not.toHaveProperty('minimum')
    expect(prop).not.toHaveProperty('maximum')
    expect(prop).not.toHaveProperty('pattern')
  })

})

// ── LocaleString label resolution ──────────────────────────────────────

describe('propSchemaToJsonSchema — label (title) resolution', () => {

  it('string label used as title directly', () => {
    const result = propSchemaToJsonSchema([field({ field: 'x', type: 'string', label: 'My Field' })])
    expect(result.properties['x'].title).toBe('My Field')
  })

  it('LocaleString object resolves via en key', () => {
    const result = propSchemaToJsonSchema([field({
      field: 'x',
      type:  'string',
      label: { en: 'My Field', other: 'Moimi Polem' },
    })])
    expect(result.properties['x'].title).toBe('My Field')
  })

  it('LocaleString object falls back to first value when en is absent', () => {
    const result = propSchemaToJsonSchema([field({
      field: 'x',
      type:  'string',
      label: { fr: 'Mon champ' },
    })])
    expect(result.properties['x'].title).toBe('Mon champ')
  })

})

// ── Dot-path fields ─────────────────────────────────────────────────────

describe('propSchemaToJsonSchema — dot-path fields', () => {

  it('dot-path field key is preserved as-is in properties (flat)', () => {
    const result = propSchemaToJsonSchema([field({ field: 'view.width', type: 'number' })])
    expect(result.properties).toHaveProperty('view.width')
    expect(result.properties['view.width'].type).toBe('number')
  })

})
