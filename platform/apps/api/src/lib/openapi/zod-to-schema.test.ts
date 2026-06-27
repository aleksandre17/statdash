import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { zodToJsonSchema } from './zod-to-schema.js'

describe('zodToJsonSchema (API-16 SSOT bridge)', () => {
  it('converts strings with constraints + formats', () => {
    expect(zodToJsonSchema(z.string().min(1).max(8))).toEqual({ type: 'string', minLength: 1, maxLength: 8 })
    expect(zodToJsonSchema(z.string().email())).toEqual({ type: 'string', format: 'email' })
    expect(zodToJsonSchema(z.string().uuid())).toEqual({ type: 'string', format: 'uuid' })
  })

  it('converts numbers, integers, and coerced numbers', () => {
    expect(zodToJsonSchema(z.number())).toEqual({ type: 'number' })
    expect(zodToJsonSchema(z.number().int().max(500))).toEqual({ type: 'integer', maximum: 500 })
    // z.coerce.number() is still a ZodNumber → integer/number type preserved.
    expect(zodToJsonSchema(z.coerce.number().int().positive())).toMatchObject({ type: 'integer' })
  })

  it('handles optional / default / nullable wrappers', () => {
    const obj = z.object({
      a: z.string(),
      b: z.string().optional(),
      c: z.coerce.number().int().default(50),
      d: z.string().nullable(),
    })
    const js = zodToJsonSchema(obj)
    expect(js.type).toBe('object')
    // b optional + c (default) are NOT required; a and d (nullable is still required) ARE.
    expect(js.required).toEqual(['a', 'd'])
    const props = js.properties as Record<string, Record<string, unknown>>
    expect(props.c.default).toBe(50)
    expect(props.d).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] })
  })

  it('passthrough objects allow additionalProperties', () => {
    const strict = zodToJsonSchema(z.object({ a: z.string() }))
    const open = zodToJsonSchema(z.object({ a: z.string() }).passthrough())
    expect(strict.additionalProperties).toBe(false)
    expect(open.additionalProperties).toBe(true)
  })

  it('handles enums, literals, arrays, records, unions', () => {
    expect(zodToJsonSchema(z.enum(['a', 'b']))).toEqual({ type: 'string', enum: ['a', 'b'] })
    expect(zodToJsonSchema(z.literal('x'))).toEqual({ const: 'x', type: 'string' })
    expect(zodToJsonSchema(z.array(z.number()))).toEqual({ type: 'array', items: { type: 'number' } })
    expect(zodToJsonSchema(z.record(z.unknown()))).toEqual({ type: 'object', additionalProperties: {} })
    expect(zodToJsonSchema(z.union([z.string(), z.number()]))).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    })
  })

  it('fails fast on an unsupported construct (a lying generator is worse than none)', () => {
    expect(() => zodToJsonSchema(z.map(z.string(), z.string()))).toThrow(/unsupported/)
  })
})
