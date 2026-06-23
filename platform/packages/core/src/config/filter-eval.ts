// ── Filter Pure Evaluators ────────────────────────────────────────────────────
//
//  All functions in this file are pure (no side effects, no React, no async).
//  Called by the defineFilters hook in FilterSchema.tsx on every render.
//

import type { ParamDef, DefaultSpec, OptionsDefault } from './filter-params'
import type { WhenMap }  from './filter-condition'
import { evalWhen }      from './filter-condition'
import { evalValidatorPredicate } from './filter-validator'
import type { DimVal }   from '../sdmx'
import { evalExpr }      from '@statdash/expr'
import type { ExprScope, ExprVal } from '@statdash/expr'
import type { EngineRow } from '../data/encoding'

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
export function validateField(def: ParamDef, value: string): string | null {
  if (def.required && !value) return typeof def.required === 'string' ? def.required : 'required'
  for (const v of def.validate ?? []) {
    if (!evalValidatorPredicate(v.check, value)) {
      // LocaleString: resolve Record<string,string> to English fallback here;
      // shells that need a locale-specific message should resolveLocaleString() at the boundary.
      return typeof v.message === 'string' ? v.message : (v.message['en'] ?? Object.values(v.message)[0] ?? 'invalid')
    }
  }
  return null
}

// ── DefaultSpec discrimination helpers ───────────────────────────────────────

/** True when spec is a Tier 3 OptionsDefault ({ from: 'options', pick }). */
function isOptionsDefault(spec: DefaultSpec): spec is OptionsDefault {
  return (
    spec !== null &&
    typeof spec === 'object' &&
    !Array.isArray(spec) &&
    (spec as Record<string, unknown>)['from'] === 'options'
  )
}

/** True when spec is a Tier 1 DimVal (null | string | number | boolean). */
function isDimValDefault(spec: DefaultSpec): spec is DimVal {
  return spec === null || typeof spec !== 'object'
}

// ── Topological sort for Tier 2 ExprVal defaults ─────────────────────────────
//
//  Scan an ExprVal tree for all { $ctx: key } references so we can resolve
//  params in dependency order (a param whose default references another param
//  must resolve AFTER that param).
//

function scanCtxRefs(expr: unknown, refs: Set<string>): void {
  if (expr === null || typeof expr !== 'object') return
  if (Array.isArray(expr)) { expr.forEach((item) => scanCtxRefs(item, refs)); return }
  const o = expr as Record<string, unknown>
  if ('$ctx' in o && typeof o['$ctx'] === 'string') { refs.add(o['$ctx']); return }
  for (const v of Object.values(o)) scanCtxRefs(v, refs)
}

/**
 * Topological sort of param entries by their Tier 2 ExprVal $ctx dependencies.
 * Returns a stable ordering where each param is resolved after its dependencies.
 * Cycles are broken by original order (first occurrence wins).
 */
function topoSort(entries: Array<{ key: string; def: ParamDef }>): Array<{ key: string; def: ParamDef }> {
  const keySet = new Set(entries.map((e) => e.key))
  const deps   = new Map<string, Set<string>>()

  for (const { key, def } of entries) {
    const spec = def.default
    if (spec !== null && typeof spec === 'object' && !isOptionsDefault(spec)) {
      const refs = new Set<string>()
      scanCtxRefs(spec, refs)
      // Only track deps that are also params in our set
      deps.set(key, new Set([...refs].filter((r) => keySet.has(r))))
    } else {
      deps.set(key, new Set())
    }
  }

  const result:  Array<{ key: string; def: ParamDef }> = []
  const visited  = new Set<string>()
  const inStack  = new Set<string>()

  function visit(key: string): void {
    if (visited.has(key)) return
    if (inStack.has(key)) return  // cycle — skip to break it
    inStack.add(key)
    for (const dep of deps.get(key) ?? []) visit(dep)
    inStack.delete(key)
    visited.add(key)
    const entry = entries.find((e) => e.key === key)
    if (entry) result.push(entry)
  }

  for (const { key } of entries) visit(key)
  return result
}

// ── resolveDefaults ──────────────────────────────────────────────────────────

/**
 * Resolve DefaultSpec for each param whose key is absent (or null) in rawDims.
 *
 * - Tier 1 (DimVal): applied immediately.
 * - Tier 2 (ExprVal): resolved in topological order (params that reference others via
 *   { $ctx: 'key' } resolve after their dependency).
 * - Tier 3 (OptionsDefault): calls getOptions(key); if null → adds to pendingKeys;
 *   if loaded → picks first/last row by field.
 *
 * @param params     Flat list of { key, def } pairs (all bars flattened)
 * @param rawDims    Current URL state + already-resolved defaults (string values)
 * @param getOptions Sync getter: (key) → EngineRow[] | null (null = loading)
 * @returns dims:        Record<string, string> with defaults filled in
 *          pendingKeys: keys with Tier 3 defaults still loading
 */
export function resolveDefaults(
  params:     Array<{ key: string; def: ParamDef }>,
  rawDims:    Record<string, string>,
  getOptions: (key: string) => EngineRow[] | null,
): { dims: Record<string, string>; pendingKeys: string[] } {
  const dims:        Record<string, string> = { ...rawDims }
  const pendingKeys: string[]               = []

  // Pass A: Tier 1 (DimVal) + Tier 3 (OptionsDefault) — no inter-param deps
  for (const { key, def } of params) {
    if (dims[key] != null && dims[key] !== '') continue  // URL state wins

    const spec = def.default

    if (isDimValDefault(spec)) {
      // Tier 1: literal value
      dims[key] = spec != null ? String(spec) : ''
    } else if (isOptionsDefault(spec)) {
      // Tier 3: pick from loaded options
      const rows = getOptions(key)
      if (rows === null) {
        pendingKeys.push(key)
      } else if (rows.length > 0) {
        const row   = spec.pick === 'last' ? rows[rows.length - 1] : rows[0]
        const field = spec.field ?? 'code'
        const val   = row[field]
        dims[key]   = val != null ? String(val) : ''
      } else {
        dims[key] = ''
      }
    }
    // Tier 2 handled in Pass B below
  }

  // Pass B: Tier 2 (ExprVal) in topological order so $ctx deps are already resolved
  const tier2 = params.filter(({ def }) => {
    const spec = def.default
    return spec !== null && typeof spec === 'object' && !isOptionsDefault(spec)
  })

  const sorted = topoSort(tier2)

  for (const { key, def } of sorted) {
    if (dims[key] != null && dims[key] !== '') continue  // URL state or Tier 1/3 wins

    const spec = def.default as ExprVal
    const scope: ExprScope = {
      dims:    { ...dims } as Record<string, DimVal>,
      derived: {},
    }
    const result = evalExpr<DimVal>(spec, scope)
    dims[key] = result != null ? String(result) : ''
  }

  return { dims, pendingKeys }
}

// ── validateCascadeValues ────────────────────────────────────────────────────

/**
 * Invalidate stale cascade values.
 *
 * For each cascade/select param whose current dim value is not in its current
 * options: clears the dim to '' so resolveDefaults Pass 2 can fill it.
 *
 * @param params     Flat list of { key, def } pairs
 * @param dims       Current resolved dims (output of resolveDefaults)
 * @param getOptions Same getter as resolveDefaults
 * @returns Updated dims (stale cascade values cleared to '')
 */
export function validateCascadeValues(
  params:     Array<{ key: string; def: ParamDef }>,
  dims:       Record<string, string>,
  getOptions: (key: string) => EngineRow[] | null,
): Record<string, string> {
  const result = { ...dims }

  for (const { key, def } of params) {
    // Only validate cascade and select params (options-backed controls)
    if (def.type !== 'cascade' && def.type !== 'select') continue

    const current = result[key]
    if (!current) continue  // already empty — nothing to invalidate

    const rows = getOptions(key)
    if (rows === null) continue  // still loading — skip

    // Determine the value field for lookup
    let valueField: string
    if (def.type === 'cascade') {
      valueField = def.dimField ?? 'code'
    } else {
      // ParamSelect: options is OptionsSource — valueField lives on the source config
      const src = def.options
      valueField = (src as { valueField?: string }).valueField ?? 'code'
    }

    const validValues = new Set(rows.map((r) => r[valueField] != null ? String(r[valueField]) : ''))
    if (!validValues.has(current)) {
      result[key] = ''
    }
  }

  return result
}
