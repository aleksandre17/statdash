// ── validateNodeConfig — PropSchema-based node config validation ────────
//
//  Implements the "save-validation contract" from ARCHITECTURE-TARGET.md §15-constructor.
//  Completes the N10/N11 story: "Engine reads PropSchema → validates stored config on load."
//
//  Design notes:
//    - Pure function: accepts PropSchema | null directly, never calls nodeRegistry.
//      This makes it testable in isolation without the singleton.
//    - validateNodeByType is the registry-aware wrapper used by the Constructor.
//    - showWhen is a UI hint only — it is NOT evaluated here (no runtime expression eval).
//    - Dot-path resolution via getAtPath: 'view.width' → obj.view?.width.
//
//  Architecture: packages/react layer — app-agnostic, no plugin/src imports.
//

import type { PropSchema, PropField, ValidationError } from './types'
import { nodeRegistry } from './register-all'
// P1: the ONE dot-path reader (config-semantics SSOT) — no local fork.
import { getAtPath } from '@statdash/engine'

// ── isPlainObject — guards the config root and object-typed fields ────────

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── checkType — returns true when value satisfies PropFieldType ───────────

function checkType(value: unknown, type: PropField['type']): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return isPlainObject(value)
    case 'array':
      return Array.isArray(value)
    case 'LocaleString':
      return typeof value === 'string' || isPlainObject(value)
    case 'DataSpec':
      return (
        isPlainObject(value) &&
        '$type' in (value as Record<string, unknown>)
      )
    case 'ChartDef':
      return (
        isPlainObject(value) &&
        'type' in (value as Record<string, unknown>)
      )
    case 'color':
    case 'icon':
      return typeof value === 'string'
    default:
      return false
  }
}

// ── validateNodeConfig — pure validation ──────────────────────────────────

/**
 * Validate a node config object against a PropSchema.
 *
 * @param schema  - PropField[] from nodeRegistry.getSchema(), or null.
 * @param config  - The raw config to validate (unknown shape from JSON/JSONB).
 * @returns Flat array of ValidationError. Empty → config is valid.
 *
 * Rules (in order per field):
 *  1. schema null/empty  → []
 *  2. config not plain object → single error at '<root>'
 *  3. required + missing → error, skip further checks for that field
 *  4. type mismatch      → error
 *  5. options mismatch   → warning  (string values only)
 *  6. min/max/pattern    → error    (only when type check passed)
 *
 * showWhen is deliberately ignored — it is a Constructor UI hint,
 * not a runtime predicate.
 */
export function validateNodeConfig(
  schema: PropSchema | null,
  config: unknown,
): ValidationError[] {
  // Rule 1: null or empty schema → valid
  if (!schema || schema.length === 0) return []

  // Rule 2: config must be a plain object
  if (!isPlainObject(config)) {
    return [{ field: '<root>', message: 'Config must be a plain object', level: 'error' }]
  }

  const errors: ValidationError[] = []

  for (const propField of schema) {
    const { field, type, required, options, validation } = propField
    const value = getAtPath(config, field)
    const isMissing = value === null || value === undefined

    // Rule 3: required check
    if (required && isMissing) {
      errors.push({ field, message: 'Required', level: 'error' })
      continue  // skip further checks for this field
    }

    // Skip type/options/validation checks when value is absent
    if (isMissing) continue

    // Rule 4: type check
    const typeOk = checkType(value, type)
    if (!typeOk) {
      errors.push({ field, message: `Expected ${type}`, level: 'error' })
      // Still check options/validation even when type fails? No —
      // options and pattern checks are only meaningful when type matches.
      continue
    }

    // Rule 5: options check (string values only — enum-like select fields)
    if (options && options.length > 0 && typeof value === 'string') {
      const allowed = options.map(o => o.value)
      if (!allowed.includes(value)) {
        errors.push({ field, message: 'Value not in allowed options', level: 'warning' })
      }
    }

    // Rule 6: validation constraints (type check passed above)
    if (validation) {
      const { min, max, pattern } = validation

      if (min !== undefined && typeof value === 'number' && value < min) {
        errors.push({ field, message: `Must be ≥ ${min}`, level: 'error' })
      }

      if (max !== undefined && typeof value === 'number' && value > max) {
        errors.push({ field, message: `Must be ≤ ${max}`, level: 'error' })
      }

      if (pattern !== undefined && typeof value === 'string' && !new RegExp(pattern).test(value)) {
        errors.push({ field, message: `Must match pattern ${pattern}`, level: 'error' })
      }
    }
  }

  return errors
}

// ── validateNodeByType — registry-aware wrapper ───────────────────────────

/**
 * Convenience form used by the Constructor.
 * Looks up PropSchema via nodeRegistry then delegates to validateNodeConfig.
 *
 * @param type    - Registered node type (e.g. 'section', 'chart').
 * @param variant - Registered variant (e.g. 'default', 'compact').
 * @param config  - Raw config object from JSONB / Constructor state.
 * @returns Flat array of ValidationError.
 */
export function validateNodeByType(
  type:    string,
  variant: string,
  config:  unknown,
): ValidationError[] {
  return validateNodeConfig(nodeRegistry.getSchema(type, variant), config)
}
