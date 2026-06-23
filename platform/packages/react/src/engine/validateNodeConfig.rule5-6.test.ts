// @vitest-environment node
//
// ── validateNodeConfig.rule5-6.test.ts ───────────────────────────────────────
//
//  Rule 5 — options mismatch on string field → warning (not error)
//  Rule 6 — min / max / pattern validation constraints → error
//

import { describe, it, expect } from 'vitest'
import { validateNodeConfig }   from './validateNodeConfig'
import type { PropSchema }      from './types'

// ── Rule 5: options mismatch → warning ────────────────────────────────────────

describe('validateNodeConfig — Rule 5: options mismatch', () => {

  const schema: PropSchema = [{
    field:   'width',
    type:    'string',
    label:   'Width',
    options: [
      { value: 'full',  label: 'Full'  },
      { value: 'half',  label: 'Half'  },
      { value: 'third', label: 'Third' },
    ],
  }]

  it('emits warning when value is not in allowed options', () => {
    const errors = validateNodeConfig(schema, { width: 'quarter' })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      field:   'width',
      level:   'warning',
      message: 'Value not in allowed options',
    })
  })

  it('emits no errors when value matches an allowed option', () => {
    expect(validateNodeConfig(schema, { width: 'full'  })).toEqual([])
    expect(validateNodeConfig(schema, { width: 'half'  })).toEqual([])
    expect(validateNodeConfig(schema, { width: 'third' })).toEqual([])
  })

  it('emits no error when options array is empty', () => {
    const s: PropSchema = [{ field: 'mode', type: 'string', label: 'Mode', options: [] }]
    expect(validateNodeConfig(s, { mode: 'anything' })).toEqual([])
  })

  it('does not run options check for non-string typed values', () => {
    // options only fires when typeof value === 'string'; number field → no warning
    const s: PropSchema = [{
      field:   'count',
      type:    'number',
      label:   'Count',
      options: [{ value: '1', label: 'One' }],
    }]
    expect(validateNodeConfig(s, { count: 42 })).toEqual([])
  })

  it('level is warning, not error', () => {
    const errors = validateNodeConfig(schema, { width: 'unknown-value' })
    expect(errors[0].level).toBe('warning')
  })

})

// ── Rule 6: validation constraints ───────────────────────────────────────────

describe('validateNodeConfig — Rule 6: min/max/pattern constraints', () => {

  it('emits error when number is below min', () => {
    const s: PropSchema = [{
      field: 'count', type: 'number', label: 'Count',
      validation: { min: 0 },
    }]
    const [err] = validateNodeConfig(s, { count: -1 })
    expect(err).toMatchObject({ field: 'count', level: 'error', message: 'Must be ≥ 0' })
  })

  it('accepts number equal to min (boundary inclusive)', () => {
    const s: PropSchema = [{
      field: 'count', type: 'number', label: 'Count',
      validation: { min: 0 },
    }]
    expect(validateNodeConfig(s, { count: 0 })).toEqual([])
  })

  it('emits error when number exceeds max', () => {
    const s: PropSchema = [{
      field: 'opacity', type: 'number', label: 'Opacity',
      validation: { max: 1 },
    }]
    const [err] = validateNodeConfig(s, { opacity: 1.5 })
    expect(err).toMatchObject({ field: 'opacity', level: 'error', message: 'Must be ≤ 1' })
  })

  it('accepts number equal to max (boundary inclusive)', () => {
    const s: PropSchema = [{
      field: 'opacity', type: 'number', label: 'Opacity',
      validation: { max: 1 },
    }]
    expect(validateNodeConfig(s, { opacity: 1 })).toEqual([])
  })

  it('emits both min and max errors when both are violated', () => {
    const s: PropSchema = [{
      field: 'score', type: 'number', label: 'Score',
      validation: { min: 10, max: 5 },  // degenerate range
    }]
    const errors = validateNodeConfig(s, { score: 7 })
    expect(errors).toHaveLength(2)
    const messages = errors.map(e => e.message)
    expect(messages).toContain('Must be ≥ 10')
    expect(messages).toContain('Must be ≤ 5')
  })

  it('emits error when string does not match pattern', () => {
    const s: PropSchema = [{
      field: 'slug', type: 'string', label: 'Slug',
      validation: { pattern: '^[a-z-]+$' },
    }]
    const [err] = validateNodeConfig(s, { slug: 'Hello World' })
    expect(err).toMatchObject({
      field:   'slug',
      level:   'error',
      message: 'Must match pattern ^[a-z-]+$',
    })
  })

  it('accepts string matching pattern', () => {
    const s: PropSchema = [{
      field: 'slug', type: 'string', label: 'Slug',
      validation: { pattern: '^[a-z-]+$' },
    }]
    expect(validateNodeConfig(s, { slug: 'hello-world' })).toEqual([])
  })

  it('does not apply min/max to string fields', () => {
    const s: PropSchema = [{
      field: 'title', type: 'string', label: 'Title',
      validation: { min: 3, max: 10 },
    }]
    expect(validateNodeConfig(s, { title: 'hi' })).toEqual([])
  })

  it('does not apply pattern to number fields', () => {
    const s: PropSchema = [{
      field: 'count', type: 'number', label: 'Count',
      validation: { pattern: '^\\d+$' },
    }]
    expect(validateNodeConfig(s, { count: 42 })).toEqual([])
  })

  it('skips validation constraints when optional field is absent', () => {
    const s: PropSchema = [{
      field: 'score', type: 'number', label: 'Score',
      validation: { min: 0 },
    }]
    expect(validateNodeConfig(s, {})).toEqual([])
  })

})
