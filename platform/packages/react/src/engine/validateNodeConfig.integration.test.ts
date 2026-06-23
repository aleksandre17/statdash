// @vitest-environment node
//
// ── validateNodeConfig.integration.test.ts ───────────────────────────────────
//
//  Cross-cutting concerns and registry-aware wrapper:
//    - Dot-path resolution via getAtPath ('view.width', 'a.b.c')
//    - showWhen is ignored (Constructor UI hint only)
//    - validateNodeByType delegates to nodeRegistry.getSchema()
//    - Multi-field composites: independent error accumulation
//

import { describe, it, expect } from 'vitest'
import { validateNodeConfig, validateNodeByType } from './validateNodeConfig'
import { nodeRegistry }                           from './register-all'
import type { PropSchema }                        from './types'

// ── no-op renderer — registry needs one to store meta ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noop = (_def: any, _ctx: any, _children: any) => null

// ── Dot-path resolution ───────────────────────────────────────────────────────

describe('validateNodeConfig — dot-path field resolution', () => {

  it('resolves a top-level field', () => {
    const s: PropSchema = [{ field: 'title', type: 'string', label: 'Title', required: true }]
    expect(validateNodeConfig(s, { title: 'hello' })).toEqual([])
  })

  it('resolves a two-segment dot-path (view.width)', () => {
    const s: PropSchema = [{
      field:   'view.width',
      type:    'string',
      label:   'Width',
      options: [{ value: 'full', label: 'Full' }],
    }]
    expect(validateNodeConfig(s, { view: { width: 'full' } })).toEqual([])
  })

  it('emits error for missing nested required dot-path', () => {
    const s: PropSchema = [{
      field: 'view.width', type: 'string', label: 'Width', required: true,
    }]
    const errors = validateNodeConfig(s, { view: {} })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: 'view.width', level: 'error' })
  })

  it('treats absent intermediate segment as missing (optional → no error)', () => {
    const s: PropSchema = [{ field: 'view.width', type: 'string', label: 'Width' }]
    expect(validateNodeConfig(s, {})).toEqual([])
  })

  it('resolves a three-level dot-path', () => {
    const s: PropSchema = [{ field: 'a.b.c', type: 'number', label: 'Deep', required: true }]
    expect(validateNodeConfig(s, { a: { b: { c: 7 } } })).toEqual([])
  })

  it('emits type error on nested field', () => {
    const s: PropSchema = [{ field: 'view.width', type: 'number', label: 'Width' }]
    const errors = validateNodeConfig(s, { view: { width: 'full' } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: 'view.width', level: 'error' })
  })

})

// ── showWhen is ignored ────────────────────────────────────────────────────────

describe('validateNodeConfig — showWhen is ignored', () => {

  it('still validates a required field even when showWhen is present', () => {
    const s: PropSchema = [{
      field:    'title',
      type:     'string',
      label:    'Title',
      required: true,
      showWhen: 'mode === "advanced"',
    }]
    const errors = validateNodeConfig(s, { mode: 'basic' })
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Required')
  })

  it('still checks type when showWhen is present', () => {
    const s: PropSchema = [{
      field:    'count',
      type:     'number',
      label:    'Count',
      showWhen: 'type === "bar"',
    }]
    const errors = validateNodeConfig(s, { count: 'five' })
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Expected number')
  })

})

// ── validateNodeByType — registry-aware wrapper ───────────────────────────────

describe('validateNodeByType — registry delegation', () => {

  // Unique type names to avoid polluting the singleton across test runs
  const T  = '__vnc-integration-type__'
  const V  = '__vnc-integration-variant__'
  const schema: PropSchema = [
    { field: 'name', type: 'string', label: 'Name', required: true },
    { field: 'age',  type: 'number', label: 'Age',  validation: { min: 0 } },
  ]

  nodeRegistry.register(T, V,         noop, { schema })
  nodeRegistry.register(T, 'default', noop, { schema })

  it('returns [] for a fully valid config', () => {
    expect(validateNodeByType(T, V, { name: 'Alice', age: 30 })).toEqual([])
  })

  it('returns errors when required field is missing', () => {
    const errors = validateNodeByType(T, V, { age: 25 })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: 'name', level: 'error' })
  })

  it('returns error when number is below min', () => {
    const errors = validateNodeByType(T, V, { name: 'Bob', age: -1 })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: 'age', level: 'error' })
  })

  it('returns [] for an unregistered type (no schema → null → [])', () => {
    expect(validateNodeByType('__not-registered__', 'default', { x: 1 })).toEqual([])
  })

  it('falls back to default variant when named variant is unregistered', () => {
    // T + '__unknown__' falls back to T + 'default' which has schema
    const errors = validateNodeByType(T, '__unknown__', { age: 5 })
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('name')
  })

})

// ── Multi-field composite ──────────────────────────────────────────────────────

describe('validateNodeConfig — multi-field composite', () => {

  it('collects independent errors from multiple failing fields', () => {
    const s: PropSchema = [
      { field: 'title', type: 'string', label: 'Title', required: true },
      { field: 'count', type: 'number', label: 'Count', validation: { min: 1 } },
      { field: 'mode',  type: 'string', label: 'Mode',
        options: [{ value: 'a', label: 'A' }] },
    ]
    const errors = validateNodeConfig(s, { count: 0, mode: 'z' })
    expect(errors).toHaveLength(3)
    const fs = errors.map(e => ({ field: e.field, level: e.level }))
    expect(fs).toContainEqual({ field: 'title', level: 'error'   })
    expect(fs).toContainEqual({ field: 'count', level: 'error'   })
    expect(fs).toContainEqual({ field: 'mode',  level: 'warning' })
  })

  it('returns [] for a large valid config spanning all supported types', () => {
    const s: PropSchema = [
      { field: 'title',      type: 'string',      label: 'Title',  required: true },
      { field: 'count',      type: 'number',      label: 'Count',  validation: { min: 0, max: 100 } },
      { field: 'active',     type: 'boolean',     label: 'Active'  },
      { field: 'tags',       type: 'array',       label: 'Tags'    },
      { field: 'meta',       type: 'object',      label: 'Meta'    },
      { field: 'label',      type: 'LocaleString',label: 'Label'   },
      { field: 'data',       type: 'DataSpec',    label: 'Data'    },
      { field: 'chart',      type: 'ChartDef',    label: 'Chart'   },
      { field: 'view.width', type: 'string',      label: 'Width',
        options: [{ value: 'full', label: 'Full' }] },
    ]
    const config = {
      title:  'My Panel',
      count:  50,
      active: true,
      tags:   ['a', 'b'],
      meta:   { key: 'value' },
      label:  { en: 'hello', fr: 'bonjour' },
      data:   { $type: 'query', indicator: 'X' },
      chart:  { type: 'bar' },
      view:   { width: 'full' },
    }
    expect(validateNodeConfig(s, config)).toEqual([])
  })

})
