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
  minimum?:     number
  maximum?:     number
  pattern?:     string
  oneOf?:       JsonSchemaProperty[]
  $comment?:    string
}

/** Top-level JSON Schema Draft-7 object schema. */
export interface JsonSchemaObject {
  $schema:              'http://json-schema.org/draft-07/schema#'
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
  const base: JsonSchemaObject = {
    $schema:              'http://json-schema.org/draft-07/schema#',
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
