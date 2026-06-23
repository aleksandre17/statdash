// @vitest-environment node
//
// ── validateNodeConfig.rule1-2.test.ts ───────────────────────────────────────
//
//  Rule 1 — null / empty schema → []
//  Rule 2 — config not a plain object → single '<root>' error
//

import { describe, it, expect } from 'vitest'
import { validateNodeConfig }   from './validateNodeConfig'
import type { PropSchema }      from './types'

const schema: PropSchema = [{ field: 'title', type: 'string', label: 'Title' }]

// ── Rule 1: null / empty schema → [] ─────────────────────────────────────────

describe('validateNodeConfig — Rule 1: null/empty schema', () => {

  it('returns [] when schema is null', () => {
    expect(validateNodeConfig(null, { title: 'hello' })).toEqual([])
  })

  it('returns [] when schema is empty array', () => {
    expect(validateNodeConfig([], { title: 'hello' })).toEqual([])
  })

  it('returns [] when schema is null even if config is non-object', () => {
    expect(validateNodeConfig(null, 42)).toEqual([])
  })

  it('returns [] when schema is empty even if config is null', () => {
    expect(validateNodeConfig([], null)).toEqual([])
  })

})

// ── Rule 2: config must be a plain object ─────────────────────────────────────

describe('validateNodeConfig — Rule 2: config must be plain object', () => {

  it('returns <root> error when config is a string', () => {
    const errors = validateNodeConfig(schema, 'bad')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ field: '<root>', level: 'error' })
  })

  it('returns <root> error when config is a number', () => {
    const errors = validateNodeConfig(schema, 42)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('returns <root> error when config is null', () => {
    const errors = validateNodeConfig(schema, null)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('returns <root> error when config is an array', () => {
    const errors = validateNodeConfig(schema, [])
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('returns <root> error when config is undefined', () => {
    const errors = validateNodeConfig(schema, undefined)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('returns <root> error when config is boolean', () => {
    const errors = validateNodeConfig(schema, false)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('returns exactly one <root> error (not one per field) on bad config', () => {
    const multiSchema: PropSchema = [
      { field: 'a', type: 'string', label: 'A', required: true },
      { field: 'b', type: 'string', label: 'B', required: true },
    ]
    const errors = validateNodeConfig(multiSchema, 'bad')
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('<root>')
  })

  it('accepts a plain object config', () => {
    expect(validateNodeConfig(schema, { title: 'hello' })).toEqual([])
  })

})
