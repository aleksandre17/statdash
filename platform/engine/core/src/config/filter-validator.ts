// ── Filter Validator System ───────────────────────────────────────────────────
//
//  Per-field and cross-field validation.
//  Eurostat / SDMX data quality pattern: validation declared in config,
//  not scattered through UI components.
//
//  Validator message strings are locale-neutral English fallbacks.
//  The app layer is responsible for localisation (i18n adapter pattern).
//

import type { WhenMap } from './filter-condition'
import { evalWhen }     from './filter-condition'

// ── Validator — per-field validation ─────────────────────────────────────────

export interface Validator {
  /** Returns true if the value is valid. */
  test:    (value: string, state: Record<string, string>) => boolean
  message: string
}

/**
 * Named validator factories — mirror HTML5 constraint validation API.
 *
 * All default message strings are locale-neutral English.
 * Pass `msg` to supply a localised message from the app layer.
 */
export const validators = {
  required:  (msg = 'required'): Validator => ({ test: (v) => Boolean(v),              message: msg }),
  minYear:   (min: number, msg?: string): Validator => ({ test: (v) => !v || Number(v) >= min,   message: msg ?? `min year: ${min}` }),
  maxYear:   (max: number, msg?: string): Validator => ({ test: (v) => !v || Number(v) <= max,   message: msg ?? `max year: ${max}` }),
  oneOf:     (allowed: string[], msg?: string): Validator => ({
    test: (v) => !v || allowed.includes(v),
    message: msg ?? `allowed: ${allowed.join(', ')}`,
  }),
  minValue:  (min: number, msg?: string): Validator => ({ test: (v) => !v || Number(v) >= min, message: msg ?? `min: ${min}` }),
  maxValue:  (max: number, msg?: string): Validator => ({ test: (v) => !v || Number(v) <= max, message: msg ?? `max: ${max}` }),
} as const

// ── CrossValidator — multi-field validation ───────────────────────────────────
//
//  Validates relationships between fields (e.g. fromYear < toYear).
//  attachTo routes the error message to a specific field's error slot.
//  Eurostat data quality pattern: cross-dimension consistency checks.
//

export interface CrossValidator {
  fields:    string[]
  test:      (values: Record<string, string>) => boolean
  message:   string | ((values: Record<string, string>) => string)
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
//  set values may be static strings or (prevValue) => string transforms.
//  Phase 2: static strings only (full JSON-serialisability).
//

export interface Effect {
  when: WhenMap
  set:  Record<string, string | ((prevValue: string) => string)>
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
    if (!cv.test(vals)) {
      const target = cv.attachTo ?? cv.fields[0]
      if (!perField[target] && !extra[target])
        extra[target] = typeof cv.message === 'function' ? cv.message(vals) : cv.message
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
        mutations[k] = typeof v === 'function' ? v(projected[k] ?? '') : v
    }
  }
  setMany(mutations)
}
