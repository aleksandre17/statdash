// ── Zod → JSON Schema (OpenAPI 3.1) — the SSOT bridge (API-16) ─────────────────
//
//  The api validates every boundary with Zod (lib/http.ts parseBody/parseParams/
//  parseQuery). Those schemas are the SINGLE SOURCE OF TRUTH for the request/
//  response shapes. This converter derives the OpenAPI/JSON-Schema description FROM
//  them, so the published contract can never drift from the runtime validation —
//  the whole point of generating rather than hand-writing a parallel spec.
//
//  WHY hand-rolled (no zod-to-json-schema dep): Zod is v3 here (no native
//  z.toJSONSchema, which is a v4 feature), and the zero-supply-chain stance of the
//  hand-rolled JWT/HMAC/metrics applies. The converter covers exactly the Zod
//  constructs the api's boundary schemas use; an unhandled construct FAILS FAST
//  (throws) rather than silently emitting a wrong/empty schema — a generator that
//  lies about the contract is worse than none.
//
//  Output target: JSON Schema 2020-12 (what OpenAPI 3.1 embeds). instanceof checks
//  against the imported Zod classes keep the walk type-safe (no `any`): there is
//  one zod in the workspace, so the class identities are stable.

import { z } from 'zod'

export type JsonSchema = Record<string, unknown>

/** Convert a Zod schema to its JSON-Schema (2020-12 / OpenAPI 3.1) description. */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // ── Wrappers: unwrap, carrying optionality/default/null up to the parent ──────
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap() as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema._def.innerType as z.ZodTypeAny)
    return { ...inner, default: schema._def.defaultValue() }
  }
  if (schema instanceof z.ZodNullable) {
    const inner = zodToJsonSchema(schema.unwrap() as z.ZodTypeAny)
    return { anyOf: [inner, { type: 'null' }] }
  }
  if (schema instanceof z.ZodEffects) {
    // refine / transform / preprocess — describe the underlying schema.
    return zodToJsonSchema(schema._def.schema as z.ZodTypeAny)
  }

  // ── Primitives ────────────────────────────────────────────────────────────────
  if (schema instanceof z.ZodString) return stringSchema(schema)
  if (schema instanceof z.ZodNumber) return numberSchema(schema)
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
  if (schema instanceof z.ZodDate) return { type: 'string', format: 'date-time' }
  if (schema instanceof z.ZodLiteral) {
    return { const: schema._def.value, type: literalType(schema._def.value) }
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: [...(schema._def.values as string[])] }
  }
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema._def.values as Record<string, string | number>)
    return { enum: values }
  }

  // ── Composites ──────────────────────────────────────────────────────────────
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema._def.type as z.ZodTypeAny) }
  }
  if (schema instanceof z.ZodObject) return objectSchema(schema)
  if (schema instanceof z.ZodRecord) {
    return { type: 'object', additionalProperties: zodToJsonSchema(schema._def.valueType as z.ZodTypeAny) }
  }
  if (schema instanceof z.ZodUnion) {
    const opts = schema._def.options as z.ZodTypeAny[]
    return { anyOf: opts.map((o) => zodToJsonSchema(o)) }
  }

  // ── Open types ────────────────────────────────────────────────────────────────
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) return {}

  throw new Error(`zodToJsonSchema: unsupported Zod type '${schema.constructor.name}'`)
}

function literalType(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':  return 'string'
    case 'number':  return 'number'
    case 'boolean': return 'boolean'
    default:        return undefined
  }
}

function stringSchema(schema: z.ZodString): JsonSchema {
  const out: JsonSchema = { type: 'string' }
  for (const check of schema._def.checks) {
    if (check.kind === 'min') out.minLength = check.value
    else if (check.kind === 'max') out.maxLength = check.value
    else if (check.kind === 'length') { out.minLength = check.value; out.maxLength = check.value }
    else if (check.kind === 'email') out.format = 'email'
    else if (check.kind === 'url') out.format = 'uri'
    else if (check.kind === 'uuid') out.format = 'uuid'
    else if (check.kind === 'regex') out.pattern = check.regex.source
  }
  return out
}

function numberSchema(schema: z.ZodNumber): JsonSchema {
  const out: JsonSchema = { type: 'number' }
  for (const check of schema._def.checks) {
    if (check.kind === 'int') out.type = 'integer'
    else if (check.kind === 'min') {
      out.minimum = check.value
      if (!check.inclusive) out.exclusiveMinimum = check.value
    } else if (check.kind === 'max') {
      out.maximum = check.value
      if (!check.inclusive) out.exclusiveMaximum = check.value
    }
  }
  return out
}

function objectSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  const shape = schema.shape
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const [key, propUnknown] of Object.entries(shape)) {
    const prop = propUnknown as z.ZodTypeAny
    properties[key] = zodToJsonSchema(prop)
    // Required unless the property is optional or carries a default (Zod's own rule).
    if (!prop.isOptional()) required.push(key)
  }
  const out: JsonSchema = { type: 'object', properties }
  if (required.length) out.required = required
  // passthrough() ⇒ additionalProperties true; strict()/strip() ⇒ false (default strip).
  out.additionalProperties = schema._def.unknownKeys === 'passthrough'
  return out
}
