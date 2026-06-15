// ── Filter Validator System ───────────────────────────────────────────────────
//
//  Per-field and cross-field validation.
//  Eurostat / SDMX data quality pattern: validation declared in config,
//  not scattered through UI components.
//
//  Validator message strings are locale-neutral English fallbacks.
//  The app layer is responsible for localisation (i18n adapter pattern).
//
//  All types are 100% JSON-serializable and Constructor-authorable.
//

import type { WhenMap }        from './filter-condition'
import type { LocaleString }   from '../i18n/types'
import { evalWhen }     from './filter-condition'

// ── ValidatorPredicate — declarative, JSON-serializable predicate ─────────────
//
//  Evaluated by evalValidatorPredicate(check, value).
//  OCP: new ops add a new discriminant; Validator interface unchanged.
//
export type ValidatorPredicate =
  | { op: 'required' }                    // value is non-empty
  | { op: 'min';   value: number }        // Number(value) >= value, or empty passes
  | { op: 'max';   value: number }        // Number(value) <= value, or empty passes
  | { op: 'oneOf'; values: string[] }     // value ∈ values, or empty passes

export function evalValidatorPredicate(check: ValidatorPredicate, value: string): boolean {
  switch (check.op) {
    case 'required': return Boolean(value)
    case 'min':      return !value || Number(value) >= check.value
    case 'max':      return !value || Number(value) <= check.value
    case 'oneOf':    return !value || check.values.includes(value)
  }
}

// ── Validator — per-field validation ─────────────────────────────────────────

export interface Validator {
  /** Declarative predicate — JSON-serializable, Constructor-authorable. */
  check:   ValidatorPredicate
  message: LocaleString
}

/**
 * Named validator factories — mirror HTML5 constraint validation API.
 *
 * All default message strings are locale-neutral English.
 * Pass `msg` to supply a localised message from the app layer.
 */
export const validators = {
  required:  (msg = 'required'): Validator => ({ check: { op: 'required' },                    message: msg }),
  minYear:   (min: number, msg?: string): Validator => ({ check: { op: 'min',   value: min },   message: msg ?? `min year: ${min}` }),
  maxYear:   (max: number, msg?: string): Validator => ({ check: { op: 'max',   value: max },   message: msg ?? `max year: ${max}` }),
  oneOf:     (allowed: string[], msg?: string): Validator => ({ check: { op: 'oneOf', values: allowed }, message: msg ?? `allowed: ${allowed.join(', ')}` }),
  minValue:  (min: number, msg?: string): Validator => ({ check: { op: 'min',   value: min },   message: msg ?? `min: ${min}` }),
  maxValue:  (max: number, msg?: string): Validator => ({ check: { op: 'max',   value: max },   message: msg ?? `max: ${max}` }),
} as const

// ── CrossValidator — multi-field validation ───────────────────────────────────
//
//  Validates relationships between fields (e.g. fromYear < toYear).
//  attachTo routes the error message to a specific field's error slot.
//  Eurostat data quality pattern: cross-dimension consistency checks.
//

export interface CrossValidator {
  fields:    string[]
  /** Declarative WhenMap predicate — JSON-serializable, Constructor-authorable. */
  check:     WhenMap
  message:   LocaleString
  attachTo?: string
}

// ── Effect — reactive side-effect on filter change ───────────────────────────
//
//  When a filter value changes and `when` evaluates to true, `set` mutations
//  are applied atomically.
//
//  Commercial equivalents:
//    Grafana   — chained template variables (${region} change resets ${city})
//    AppSmith  — widget event handlers (onChange → resetWidget)
//    Retool    — component event handlers (onChange → setValue)
//
//  set values are static strings — 100% JSON-serializable, Constructor-authorable.
//

export interface Effect {
  when: WhenMap
  set:  Record<string, string>
}

/** Collect cross-field validation errors, returning a key → message map. */
export function applyCrossValidation(
  crossValidate: CrossValidator[],
  raw:           Record<string, string>,
  perField:      Record<string, string>,
): Record<string, string> {
  const extra: Record<string, string> = {}
  for (const cv of crossValidate) {
    const vals = Object.fromEntries(cv.fields.map((f) => [f, raw[f] ?? '']))
    if (!evalWhen(cv.check, vals)) {
      const target = cv.attachTo ?? cv.fields[0]
      if (!perField[target] && !extra[target])
        extra[target] = cv.message
    }
  }
  return extra
}

/**
 * Apply effects triggered by a filter change, writing all mutations atomically.
 *
 * setMany is injected by the caller (React hook) — function stays pure/testable.
 */
export function applyEffects(
  key:     string,
  value:   string,
  raw:     Record<string, string>,
  effects: Effect[],
  setMany: (m: Record<string, string>) => void,
): void {
  const projected = { ...raw, [key]: value }
  const mutations: Record<string, string> = { [key]: value }
  for (const effect of effects) {
    if (evalWhen(effect.when, projected)) {
      for (const [k, v] of Object.entries(effect.set))
        mutations[k] = v
    }
  }
  setMany(mutations)
}
