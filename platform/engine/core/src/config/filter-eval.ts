// ── Filter Pure Evaluators ────────────────────────────────────────────────────
//
//  All functions in this file are pure (no side effects, no React, no async).
//  Called by the defineFilters hook in FilterSchema.tsx on every render.
//

import type { ParamDef } from './filter-params'
import type { WhenMap }  from './filter-condition'
import { evalWhen }      from './filter-condition'

/** Parse a raw URL string into the typed value for a given ParamDef. */
export function autoParse(def: ParamDef, raw: string): unknown {
  switch (def.type) {
    case 'year-select':  return Number(raw) || Number(def.default) || 0
    case 'cascade':      return raw ? raw.split(',').map(Number) : []
    case 'range': {
      const p = raw ? raw.split(',').map(Number) : []
      return [isNaN(p[0]) ? (def.min ?? 0) : p[0], isNaN(p[1]) ? (def.max ?? 100) : p[1]] as [number, number]
    }
    case 'multi-select': return raw ? raw.split(',').filter(Boolean) : []
    default:             return raw
  }
}

/** True if the param should be rendered (not hidden, showWhen passes). */
export function isVisible(def: ParamDef, state: Record<string, string>): boolean {
  if (def.type === 'hidden') return false
  return !def.showWhen || evalWhen(def.showWhen as WhenMap, state)
}

/** True if the param control is interactive (enableWhen passes). */
export function isEnabled(def: ParamDef, state: Record<string, string>): boolean {
  return !def.enableWhen || evalWhen(def.enableWhen as WhenMap, state)
}

/**
 * Validate a single field. Returns an error message or null.
 *
 * The `required` fallback message is locale-neutral English.
 * Pass `required: 'custom message'` on ParamDef to localise.
 */
export function validateField(def: ParamDef, value: string, state: Record<string, string>): string | null {
  if (def.required && !value) return typeof def.required === 'string' ? def.required : 'required'
  for (const v of def.validate ?? []) if (!v.test(value, state)) return v.message
  return null
}
