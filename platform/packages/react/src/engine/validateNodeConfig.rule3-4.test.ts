// @vitest-environment node
//
// ── validateNodeConfig.rule3-4.test.ts ───────────────────────────────────────
//
//  Rule 3 — required + missing → error, skip further checks for that field
//  Rule 4 — type mismatch → error, skip options/validation for that field
//

import { describe, it, expect } from 'vitest'
import { validateNodeConfig }   from './validateNodeConfig'
import type { PropSchema }      from './types'

// ── Rule 3: required + missing ────────────────────────────────────────────────

describe('validateNodeConfig — Rule 3: required + missing', () => {

  const schema: PropSchema = [
    { field: 'title', type: 'string', label: 'Title', required: true },
    { field: 'count', type: 'number', label: 'Count', required: true },
  ]

  it('emits error for each missing required field', () => {
    const errors = validateNodeConfig(schema, {})
    expect(errors).toHaveLength(2)
    expect(errors.map(e => e.field)).toEqual(['title', 'count'])
  })

  it('emits "Required" message', () => {
    const errors = validateNodeConfig(schema, {})
    errors.forEach(e => expect(e.message).toBe('Required'))
  })

  it('emits error at level "error" (not warning)', () => {
    const errors = validateNodeConfig(schema, {})
    errors.forEach(e => expect(e.level).toBe('error'))
  })

  it('does NOT emit error for an optional field that is missing', () => {
    const optional: PropSchema = [{ field: 'sub', type: 'string', label: 'Sub' }]
    expect(validateNodeConfig(optional, {})).toEqual([])
  })

  it('treats null as missing for a required field', () => {
    const errors = validateNodeConfig(schema, { title: null, count: null })
    expect(errors).toHaveLength(2)
    errors.forEach(e => expect(e.message).toBe('Required'))
  })

  it('treats undefined as missing for a required field', () => {
    const errors = validateNodeConfig(schema, { title: undefined })
    expect(errors.some(e => e.field === 'title')).toBe(true)
  })

  it('skips type check after required fires (exactly one error per missing required field)', () => {
    const s: PropSchema = [{ field: 'x', type: 'number', label: 'X', required: true }]
    const errors = validateNodeConfig(s, {})
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Required')
  })

  it('emits no errors when all required fields are present and correct type', () => {
    expect(validateNodeConfig(schema, { title: 'hello', count: 5 })).toEqual([])
  })

})

// ── Rule 4: type mismatch ─────────────────────────────────────────────────────

describe('validateNodeConfig — Rule 4: type mismatch', () => {

  it('emits error when string field receives number', () => {
    const s: PropSchema = [{ field: 'title', type: 'string', label: 'Title' }]
    const [err] = validateNodeConfig(s, { title: 42 })
    expect(err).toMatchObject({ field: 'title', level: 'error', message: 'Expected string' })
  })

  it('emits error when number field receives string', () => {
    const s: PropSchema = [{ field: 'count', type: 'number', label: 'Count' }]
    const [err] = validateNodeConfig(s, { count: 'five' })
    expect(err.message).toBe('Expected number')
  })

  it('emits error when boolean field receives string', () => {
    const s: PropSchema = [{ field: 'active', type: 'boolean', label: 'Active' }]
    const [err] = validateNodeConfig(s, { active: 'true' })
    expect(err.message).toBe('Expected boolean')
  })

  it('emits error when object field receives array', () => {
    const s: PropSchema = [{ field: 'view', type: 'object', label: 'View' }]
    const [err] = validateNodeConfig(s, { view: [1, 2] })
    expect(err.message).toBe('Expected object')
  })

  it('emits error when array field receives plain object', () => {
    const s: PropSchema = [{ field: 'items', type: 'array', label: 'Items' }]
    const [err] = validateNodeConfig(s, { items: { a: 1 } })
    expect(err.message).toBe('Expected array')
  })

  it('accepts plain string as LocaleString', () => {
    const s: PropSchema = [{ field: 'label', type: 'LocaleString', label: 'Label' }]
    expect(validateNodeConfig(s, { label: 'hello' })).toEqual([])
  })

  it('accepts plain object as LocaleString', () => {
    const s: PropSchema = [{ field: 'label', type: 'LocaleString', label: 'Label' }]
    expect(validateNodeConfig(s, { label: { en: 'hello', fr: 'bonjour' } })).toEqual([])
  })

  it('rejects number as LocaleString', () => {
    const s: PropSchema = [{ field: 'label', type: 'LocaleString', label: 'Label' }]
    const [err] = validateNodeConfig(s, { label: 42 })
    expect(err.message).toBe('Expected LocaleString')
  })

  it('accepts DataSpec with $type property', () => {
    const s: PropSchema = [{ field: 'data', type: 'DataSpec', label: 'Data' }]
    expect(validateNodeConfig(s, { data: { $type: 'query', indicator: 'GDP' } })).toEqual([])
  })

  it('rejects DataSpec without $type property', () => {
    const s: PropSchema = [{ field: 'data', type: 'DataSpec', label: 'Data' }]
    const [err] = validateNodeConfig(s, { data: { indicator: 'GDP' } })
    expect(err.message).toBe('Expected DataSpec')
  })

  it('accepts ChartDef with type property', () => {
    const s: PropSchema = [{ field: 'chart', type: 'ChartDef', label: 'Chart' }]
    expect(validateNodeConfig(s, { chart: { type: 'bar' } })).toEqual([])
  })

  it('rejects ChartDef without type property', () => {
    const s: PropSchema = [{ field: 'chart', type: 'ChartDef', label: 'Chart' }]
    const [err] = validateNodeConfig(s, { chart: { series: [] } })
    expect(err.message).toBe('Expected ChartDef')
  })

  it('accepts string for color field', () => {
    const s: PropSchema = [{ field: 'color', type: 'color', label: 'Color' }]
    expect(validateNodeConfig(s, { color: '#ff0000' })).toEqual([])
  })

  it('accepts string for icon field', () => {
    const s: PropSchema = [{ field: 'icon', type: 'icon', label: 'Icon' }]
    expect(validateNodeConfig(s, { icon: 'arrow-right' })).toEqual([])
  })

  it('skips options check when type fails (exactly one error per type-mismatch field)', () => {
    const s: PropSchema = [{
      field:   'mode',
      type:    'string',
      label:   'Mode',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    }]
    const errors = validateNodeConfig(s, { mode: 99 })
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Expected string')
  })

  it('emits no errors when all field types match', () => {
    const s: PropSchema = [
      { field: 'title',  type: 'string',  label: 'Title'  },
      { field: 'count',  type: 'number',  label: 'Count'  },
      { field: 'active', type: 'boolean', label: 'Active' },
      { field: 'tags',   type: 'array',   label: 'Tags'   },
      { field: 'meta',   type: 'object',  label: 'Meta'   },
    ]
    const config = { title: 'hello', count: 5, active: true, tags: [], meta: {} }
    expect(validateNodeConfig(s, config)).toEqual([])
  })

})
