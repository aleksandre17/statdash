// ── propSchemaToJsonSchema — JSON Schema bridge for the Constructor ────
//
//  Converts our typed PropSchema (PropField[]) to JSON Schema Draft-7,
//  enabling the Constructor to use standard form generators (react-jsonschema-form,
//  AutoForm, JSON Forms, etc.) for the property panel.
//
//  Architecture: §15-constructor "JSON-schema forms" item.
//    PropSchema is our canonical type; JSON Schema is the wire format
//    for external form generators. This is a ONE-WAY bridge: PropSchema
//    → JSON Schema only.
//
//  Locale: this module is app-agnostic (engine/react law).
//    LocaleString labels are resolved as plain English strings (the 'en' key
//    when present, otherwise the first available value). App-layer callers
//    that need locale-aware titles should post-process the returned schema.
//
//  Dot-path fields ('view.width'):
//    PropField.field may be a dot-path. In Draft-7 output, dot-path fields
//    are FLATTENED as top-level property keys (key = 'view.width').
//    Nesting expansion is a future enhancement gated on form-generator adoption.
//
//  JSON-serializable invariant: the return value satisfies
//    JSON.parse(JSON.stringify(result)) deep-equals result.
//

import type { PropSchema, PropField } from './types'

// ── JSON Schema Draft-7 types ──────────────────────────────────────────

/** A single JSON Schema property descriptor. */
export interface JsonSchemaProperty {
  type?:        string | string[]
  title?:       string
  description?: string
  default?:     unknown
  enum?:        unknown[]
  const?:       unknown
  minimum?:     number
  maximum?:     number
  pattern?:     string
  oneOf?:       JsonSchemaProperty[]
  /** $ref pointer — used by the document-level generator ($defs composition). */
  $ref?:        string
  /** Array item schema — used for `children`/array properties. */
  items?:       JsonSchemaProperty
  /** Nested object properties — used for the `presentation` bag at the page root. */
  properties?:  Record<string, JsonSchemaProperty>
  /** Whether extra keys are permitted on a nested object property. */
  additionalProperties?: boolean
  $comment?:    string
}

/** The Draft-2020-12 dialect URI — the document-root dialect (ADR §7.7). */
export const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema' as const
/** The Draft-07 dialect URI — retained for node-level authoring subschemas. */
export const DRAFT_07 = 'http://json-schema.org/draft-07/schema#' as const

/** Top-level JSON Schema object schema (dialect carried in `$schema`). */
export interface JsonSchemaObject {
  $schema:              typeof DRAFT_07 | typeof DRAFT_2020_12
  type:                 'object'
  properties:           Record<string, JsonSchemaProperty>
  required:             string[]
  additionalProperties: boolean
}

/**
 * A node-level subschema — the same object body as JsonSchemaObject but with
 * NO `$schema` dialect declaration. Used as a `$defs` member inside a
 * Draft-2020-12 document, where only the document ROOT declares the dialect
 * (embedding a `$schema` on every subschema is non-idiomatic 2020-12).
 */
export interface JsonSubSchema {
  type:                 'object'
  properties:           Record<string, JsonSchemaProperty>
  required:             string[]
  additionalProperties: boolean
}

// ── propSchemaToJsonSchema — public API ───────────────────────────────

/**
 * Convert a PropSchema to a JSON Schema Draft-7 object schema.
 *
 * Labels are resolved from the `en` key (or first available value) of each
 * `LocaleString`. App-layer callers needing locale-aware titles should
 * substitute the `title` fields after calling this function.
 *
 * @param schema  - PropField[] from nodeRegistry.getSchema(), or null/empty.
 * @returns A JSON Schema Draft-7 object schema.
 *
 * JSON-serializable: `JSON.parse(JSON.stringify(result))` deep-equals `result`.
 */
export function propSchemaToJsonSchema(
  schema: PropSchema | null | undefined,
): JsonSchemaObject {
  return { $schema: DRAFT_07, ...propSchemaToSubSchema(schema) }
}

/**
 * Convert a PropSchema to a JSON Schema object BODY without a `$schema`
 * dialect declaration — for embedding as a `$defs` member of a Draft-2020-12
 * document (`generatePageConfigSchema`). Shares the exact per-field conversion
 * (`buildProperty`) with `propSchemaToJsonSchema` — no forked truth.
 *
 * @param schema - PropField[] or null/empty (empty ⇒ open object).
 */
export function propSchemaToSubSchema(
  schema: PropSchema | null | undefined,
): JsonSubSchema {
  const base: JsonSubSchema = {
    type:                 'object',
    properties:           {},
    required:             [],
    additionalProperties: false,
  }

  if (!schema || schema.length === 0) {
    base.additionalProperties = true
    return base
  }

  for (const field of schema) {
    base.properties[field.field] = buildProperty(field)
    if (field.required) {
      base.required.push(field.field)
    }
  }

  return base
}

// ── buildProperty — per-field conversion ─────────────────────────────

function buildProperty(field: PropField): JsonSchemaProperty {
  const prop: JsonSchemaProperty = {}

  // ── title (resolved from LocaleString — en preferred)
  const label = resolveLocaleString(field.label)
  if (label) prop.title = label

  // ── description — type label as readable hint
  prop.description = `${field.type} field`

  // ── default
  if (field.default !== undefined) prop.default = field.default

  // ── type mapping
  Object.assign(prop, typeDescriptor(field.type))

  // ── NESTED-ITEM SCHEMA (D7 / ADR-022) — recurse the sub-schema, lossless.
  //  A field WITH `itemSchema` is a STRUCTURED nested container, not opaque: an
  //  `array` field emits a proper `items` sub-schema, an `object` field emits
  //  `properties`. WITHOUT `itemSchema` the emission is unchanged (a bare
  //  `{type:'array'}`/`{type:'object'}`), so every existing config round-trips
  //  byte-identically. Recursion is free — `propSchemaToSubSchema` calls back
  //  into `buildProperty`, so an `itemSchema` sub-field's own `itemSchema`
  //  descends to arbitrary depth. Mirrors the dot-path grammar's numeric-segment
  //  descent (`prop-path.ts`) so read/write and wire agree.
  if (field.itemSchema) {
    const sub = propSchemaToSubSchema(field.itemSchema)
    if (field.type === 'array') {
      prop.items = sub
    } else if (field.type === 'object') {
      prop.properties           = sub.properties
      prop.additionalProperties = sub.additionalProperties
    }
  }

  // ── options → enum (string-valued select fields)
  if (field.options && field.options.length > 0) {
    prop.enum = field.options.map(o => o.value)
    // Readable description: "value: label" pairs
    const optLabels = field.options
      .map(o => `${o.value}: ${resolveLocaleString(o.label)}`)
      .join(', ')
    if (optLabels) prop.description = optLabels
  }

  // ── validation constraints
  if (field.validation) {
    if (field.validation.min     !== undefined) prop.minimum = field.validation.min
    if (field.validation.max     !== undefined) prop.maximum = field.validation.max
    if (field.validation.pattern !== undefined) prop.pattern = field.validation.pattern
  }

  return prop
}

// ── typeDescriptor — PropFieldType → JSON Schema type shape ──────────

function typeDescriptor(type: PropField['type']): Partial<JsonSchemaProperty> {
  switch (type) {
    case 'string':      return { type: 'string' }
    case 'number':      return { type: 'number' }
    case 'boolean':     return { type: 'boolean' }
    case 'object':      return { type: 'object' }
    case 'array':       return { type: 'array' }
    case 'color':       return { type: 'string', $comment: 'color' }
    case 'icon':        return { type: 'string', $comment: 'icon' }
    case 'LocaleString':
      // string OR { [locale: string]: string } bilingual object
      return { oneOf: [{ type: 'string' }, { type: 'object' }], $comment: 'LocaleString' }
    case 'DataSpec':
      return { type: 'object', $comment: 'DataSpec' }
    case 'ChartDef':
      return { type: 'object', $comment: 'ChartDef' }
    case 'style':
      // a NodeStyles object (responsive style-prop object) — validated as an object
      // so saveGuard accepts authored `view.styles`; the token constraint is enforced
      // at the authoring boundary (StyleField), not the JSON-schema type.
      return { type: 'object', $comment: 'NodeStyles' }
    default:
      return { type: 'string' }
  }
}

// ── resolveLocaleString — engine-agnostic label extraction ───────────

type AnyLocaleString = string | Record<string, string>

/**
 * Extract a plain string from a LocaleString value.
 * Prefers the 'en' key; falls back to the first available value.
 * Never references app-specific locale codes.
 */
function resolveLocaleString(ls: AnyLocaleString | undefined): string {
  if (!ls) return ''
  if (typeof ls === 'string') return ls
  return ls['en'] ?? Object.values(ls)[0] ?? ''
}
