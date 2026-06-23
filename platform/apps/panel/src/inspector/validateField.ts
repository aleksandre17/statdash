// ── validateField — per-field validation from the PropField descriptor ──────
//
//  Pure: (field, value) → error message | null. The Inspector renders the
//  message inline (role="alert", aria-describedby). Validation is declared in
//  the schema (PropField.required / .validation), so a new node type's rules
//  come from its schema — no Inspector change (schema-driven, like the controls).
//
//  Messages are short, English, control-agnostic. i18n of validation messages
//  is a later catalog concern (flagged); the rule source is the schema.
//
import type { PropField } from '@statdash/react/engine'

/** True for "no value entered" across the primitive shapes. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

/** Returns the first validation error for a field's value, or null if valid. */
export function validateField(field: PropField, value: unknown): string | null {
  if (field.required && isEmpty(value)) return 'Required'

  // Skip range/pattern checks on an empty optional value (nothing to validate).
  if (isEmpty(value)) return null

  const v = field.validation
  if (!v) return null

  if (field.type === 'number' && typeof value === 'number') {
    if (v.min !== undefined && value < v.min) return `Must be ≥ ${v.min}`
    if (v.max !== undefined && value > v.max) return `Must be ≤ ${v.max}`
  }

  if (typeof value === 'string' && v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return 'Invalid format'
    } catch {
      /* invalid author-supplied pattern → treat as no constraint (fail-soft) */
    }
  }

  return null
}
