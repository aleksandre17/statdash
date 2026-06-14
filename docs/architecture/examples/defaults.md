# defaults.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Defaults System: three-tier default resolution
 *
 * Every param in useFilters resolves its value in this priority order:
 *   1. URL param → highest priority, always wins
 *   2. resolveDefaults() → fills absent params from defaultValue
 *   3. validateCascadeValues() → invalidates stale cascade selections
 *   4. Effects (Pass 2) → set:null params re-resolved by defaults
 *
 * Three default tiers:
 *   Tier 1  DimVal literal      defaultValue: 2023 / 'GE' / true
 *   Tier 2  ExprVal expression  defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 4 }
 *   Tier 3  OptionsDefault      defaultValue: { from: 'options', pick: 'first' }
 *
 * Platform precedents:
 *   Grafana  — query variable `useFirstResult: true` (Tier 3) + variable expressions (Tier 2)
 *   Retool   — `defaultValue: {{ query.data[0].id }}` (Tier 3) + template expression (Tier 2)
 *   RHF      — `async defaultValues()` — fetch then set (Tier 3 via async)
 *   Observable — upstream reactive cell (Tier 2) + Inputs.select(opts, {value: opts[0]}) (Tier 3)
 *
 * All three tiers are plain JSON. Constructor stores all three in DB. Zero functions in config.
 */

import type { ExprVal, DimVal, DataRow, OptionsSource, YearsSource } from '@geostat/engine'
import { buildDependencyGraph, scanCtxRefs } from './derive-effects'


// ═══════════════════════════════════════════════════════════════════════════
// DefaultSpec — the three tiers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OptionsDefault — Tier 3: pick a value from this param's options data.
 *
 * 'first' — first row in options list (most common: default to first available choice)
 * 'last'  — last row (useful for: latest year, highest value)
 * field   — which row field to use as the value (default: param's valueField ?? 'code')
 */
export interface OptionsDefault {
  from:   'options'
  pick:   'first' | 'last'
  field?: string
}

/**
 * DefaultSpec — discriminated at runtime by type:
 *   null | string | number | boolean → Tier 1 (DimVal literal)
 *   { from: 'options', pick }        → Tier 3 (OptionsDefault)
 *   any other object                 → Tier 2 (ExprVal)
 *
 * JSON.parse(JSON.stringify(spec)) === spec ✅ for all three tiers.
 */
export type DefaultSpec = DimVal | ExprVal | OptionsDefault

function isOptionsDefault(v: DefaultSpec): v is OptionsDefault {
  return typeof v === 'object' && v !== null && (v as OptionsDefault).from === 'options'
}

function isExprVal(v: DefaultSpec): v is ExprVal {
  return typeof v === 'object' && v !== null && !isOptionsDefault(v)
}


// ═══════════════════════════════════════════════════════════════════════════
// ParamDef — updated: defaultValue accepts DefaultSpec (not just DimVal)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ParamDefBase — shared across all filter types (unchanged).
 */
interface ParamDefBase {
  dependsOn?: string[]
}

/**
 * ParamDef — all types updated to accept DefaultSpec.
 *
 * Backward compatible: current `defaultValue: 2023` (Tier 1 literal) stays valid.
 * hidden: defaultValue required (hidden params must always have a value).
 */
export type ParamDef =
  | (ParamDefBase & { type: 'hidden';       defaultValue:  DefaultSpec })
  | (ParamDefBase & { type: 'year-select';  defaultValue?: DefaultSpec;   years?: YearsSource })
  | (ParamDefBase & { type: 'range';        defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'select';       options: OptionsSource;       defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'multi-select'; options: OptionsSource;       defaultValue?: DefaultSpec })
  | (ParamDefBase & { type: 'cascade';      options: OptionsSource;       defaultValue?: DefaultSpec })
  //   cascade uses dependsOn + options.type='query' with { $ctx: 'parent' } dims
  //   options: OptionsSource replaces storeId? + optionsQuery: DataSpec + valueField?

interface SelectOption { value: string; label: string }

// Returns the valueField for OptionsSource variants that have one (inline/query).
// Static and api sources don't carry a valueField — defaults to 'code'.
function optionsValueField(options: OptionsSource): string {
  return options.type === 'static' || options.type === 'api' ? 'code' : options.valueField
}

// Extracts options from a cascade/select param — returns undefined for other types.
function getParamOptions(param: ParamDef): OptionsSource | undefined {
  if (param.type === 'cascade' || param.type === 'select' || param.type === 'multi-select')
    return param.options
  return undefined
}


// ═══════════════════════════════════════════════════════════════════════════
// resolveDefaults — main entry point
// ═══════════════════════════════════════════════════════════════════════════

export interface DefaultResolutionResult {
  dims:        Record<string, DimVal>  // all resolved params (URL + defaults)
  pendingKeys: string[]                // Tier 3 params waiting for options to load
}

/**
 * resolveDefaults — fills absent params from defaultValue.
 *
 * Called in useFilters() BEFORE evalComputed and applyEffects.
 * Called again (Pass 2) for any key that effects set to null.
 *
 * Algorithm:
 *   1. For params present in URL → use URL value (skip default resolution entirely)
 *   2. Build dep graph from Tier 2 ExprVal defaults (scan { $ctx: key } references)
 *   3. Topological sort — Tier 1 and Tier 3 params have no deps, evaluated first
 *   4. In topo order: Tier 1 → literal; Tier 2 → evalExpr; Tier 3 → pick from options
 *   5. Tier 3 params where getOptions returns undefined → pendingKeys (options loading)
 *
 * @param params     All param definitions (ParamDef per key, from schema root + all bars)
 * @param rawDims    URL-parsed values; missing keys (undefined) need default resolution
 * @param getOptions Returns resolved options rows for a cascade param; undefined = still loading
 */
export function resolveDefaults(
  params:     Record<string, ParamDef>,
  rawDims:    Record<string, DimVal | undefined>,
  getOptions: (key: string) => DataRow[] | undefined,
): DefaultResolutionResult {
  const resolved: Record<string, DimVal> = {}
  const pending:  string[]               = []

  // URL params — highest priority, skip default resolution
  for (const [key, val] of Object.entries(rawDims)) {
    if (val !== undefined) resolved[key] = val
  }

  // Keys that need default resolution (absent from URL)
  const needsDefault = Object.keys(params).filter(k => rawDims[k] === undefined)
  if (!needsDefault.length) return { dims: resolved, pendingKeys: [] }

  // Build dependency graph from ExprVal defaults
  // Tier 2: { $ctx: 'otherKey' } → dependency on otherKey's resolved value
  const entries = needsDefault.map(key => {
    const spec = params[key].defaultValue
    return {
      key,
      deps: (spec && isExprVal(spec))
        ? scanCtxRefs(spec as ExprVal).filter(d => needsDefault.includes(d))
        : [],
    }
  })

  const graph = buildDependencyGraph(entries)
  if (graph.hasCycle) {
    throw new Error(`[defaults] Circular dependency: ${graph.cycleKeys.join(' → ')}`)
  }

  // Resolve in topological order
  for (const key of graph.order) {
    const param = params[key]
    const spec  = param.defaultValue

    if (spec === undefined || spec === null) {
      resolved[key] = null
      continue
    }

    const result = resolveDefaultValue(spec, key, resolved, getOptions, param)
    if (result === PENDING) {
      pending.push(key)
      resolved[key] = null   // placeholder — pendingKeys signals loading state
    } else {
      resolved[key] = result
    }
  }

  return { dims: resolved, pendingKeys: pending }
}

const PENDING = Symbol('pending')

/**
 * resolveDefaultValue — resolves one DefaultSpec to a DimVal (or PENDING sentinel).
 */
function resolveDefaultValue(
  spec:       DefaultSpec,
  key:        string,
  resolved:   Record<string, DimVal>,
  getOptions: (key: string) => DataRow[] | undefined,
  param:      ParamDef,
): DimVal | typeof PENDING {
  // Tier 3: OptionsDefault
  if (isOptionsDefault(spec)) {
    const options = getOptions(key)
    if (options === undefined) return PENDING       // still loading
    if (!options.length)       return null          // no options available

    const row       = spec.pick === 'first' ? options[0] : options[options.length - 1]
    const opts      = getParamOptions(param)
    const field     = spec.field ?? (opts ? optionsValueField(opts) : undefined) ?? 'code'
    return (row[field] as DimVal) ?? null
  }

  // Tier 2: ExprVal
  if (isExprVal(spec)) {
    const scope = { dims: resolved, derived: {} }
    return evalExpr(spec as ExprVal, scope)
  }

  // Tier 1: DimVal literal
  return spec as DimVal
}


// ═══════════════════════════════════════════════════════════════════════════
// validateCascadeValues — invalidate stale selections after options refresh
// ═══════════════════════════════════════════════════════════════════════════

/**
 * validateCascadeValues — checks cascade params' current values against loaded options.
 *
 * Called after resolveDefaults, before effects. When a parent param changes,
 * the options list changes. The previously-selected value may no longer exist.
 *
 * Pattern:
 *   parent changes → options refetch → validateCascadeValues → stale value → null
 *   → Pass 2 resolveDefaults → picks first valid option from new list
 *
 * Same mechanism as Grafana: variable refresh → current value absent in new list → auto-select first.
 *
 * @returns Updated dims + list of keys that were invalidated (for Pass 2)
 */
export function validateCascadeValues(
  params:     Record<string, ParamDef>,
  dims:       Record<string, DimVal>,
  getOptions: (key: string) => DataRow[] | undefined,
): { dims: Record<string, DimVal>; invalidatedKeys: string[] } {
  const result:        Record<string, DimVal> = { ...dims }
  const invalidated:   string[]               = []

  for (const [key, param] of Object.entries(params)) {
    if (param.type !== 'cascade') continue

    const currentValue = dims[key]
    if (currentValue === null || currentValue === undefined) continue  // already empty — nothing to invalidate

    const options = getOptions(key)
    if (options === undefined) continue  // not loaded yet — can't validate

    const opts    = getParamOptions(param)
    const idField = opts ? optionsValueField(opts) : 'code'
    const isValid = options.some(row => row[idField] === currentValue)

    if (!isValid) {
      result[key] = null
      invalidated.push(key)
    }
  }

  return { dims: result, invalidatedKeys: invalidated }
}


// ═══════════════════════════════════════════════════════════════════════════
// useFilters pipeline — two-pass defaults (pseudocode, not real hook)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * useFilters — updated resolution pipeline (conceptual, not runnable).
 *
 * Two-pass default resolution:
 *   Pass 1: initial defaults for all URL-absent params
 *   Pass 2: re-resolve params that effects reset to null
 *
 * Order is critical:
 *   defaults → validate cascade → effects → Pass 2 defaults → computed → crossValidate
 */
function useFiltersConceptual(schema: FilterSchemaInput) {
  const rawDims    = parseURLParams(schema)           // URL → raw values
  const allParams  = collectAllParams(schema)         // schema root + all bars
  const getOptions = buildOptionsGetter(schema)       // useStoreQuery per cascade

  // Pass 1 — resolve defaults for URL-absent params
  const { dims: pass1Dims, pendingKeys } = resolveDefaults(allParams, rawDims, getOptions)

  // Cascade invalidation — stale values cleared
  const { dims: validatedDims, invalidatedKeys } = validateCascadeValues(allParams, pass1Dims, getOptions)

  // Effects — single pass
  const afterEffects = applyEffects(schema.effects ?? [], validatedDims)

  // Pass 2 — re-resolve params set to null by effects OR cascade invalidation
  const nullAfterEffects = Object.keys(allParams).filter(
    k => afterEffects[k] === null && (invalidatedKeys.includes(k) || /* effects cleared it */ true)
  )
  const { dims: finalDims } = resolveDefaults(
    Object.fromEntries(nullAfterEffects.map(k => [k, allParams[k]])),
    Object.fromEntries(Object.entries(afterEffects).map(([k, v]) => [k, v === null ? undefined : v])),
    getOptions,
  )
  const mergedDims = { ...afterEffects, ...finalDims }

  // computed — pure expressions (may reference any resolved dim)
  const computedVals = evalComputed(schema.computed ?? [], mergedDims)
  const fullDims     = { ...mergedDims, ...computedVals }

  // crossValidate — collect all errors (UI display only)
  const errors    = runCrossValidators(schema.crossValidate ?? [], fullDims)
  const isLoading = pendingKeys.length > 0

  return { ctx: { dims: fullDims }, bars: buildBars(schema, fullDims), isLoading, errors }
}

// Declare external dependencies to satisfy type check:
declare function parseURLParams(schema: FilterSchemaInput): Record<string, DimVal | undefined>
declare function collectAllParams(schema: FilterSchemaInput): Record<string, ParamDef>
declare function buildOptionsGetter(schema: FilterSchemaInput): (key: string) => DataRow[] | undefined
declare function applyEffects(effects: unknown[], dims: Record<string, DimVal>): Record<string, DimVal>
declare function evalComputed(entries: unknown[], dims: Record<string, DimVal>): Record<string, DimVal>
declare function runCrossValidators(validators: unknown[], dims: Record<string, DimVal>): Record<string, string>
declare function buildBars(schema: FilterSchemaInput, dims: Record<string, DimVal>): unknown[]
declare function evalExpr(expr: ExprVal, scope: { dims: Record<string, DimVal>; derived: Record<string, DimVal> }): DimVal
declare interface FilterSchemaInput { effects?: unknown[]; computed?: unknown[]; crossValidate?: unknown[] }


// ═══════════════════════════════════════════════════════════════════════════
// Example A — simple form (all Tier 1 literals)
// ═══════════════════════════════════════════════════════════════════════════

export const SIMPLE_FORM_SCHEMA = {
  bars: {
    main: {
      position: 'sticky' as const,
      order:    1,
      filters: {
        sector: { type: 'select'      as const, options: { type: 'static', items: SECTOR_OPTIONS }, defaultValue: '_T'      },
        prices: { type: 'select'      as const, options: { type: 'static', items: PRICE_OPTIONS  }, defaultValue: 'current' },
        year:   { type: 'year-select' as const,                                                      defaultValue: 2023       },
      },
    },
  },
}
// resolveDefaults: all Tier 1 → no dep graph needed → trivial resolution.
// isLoading: false immediately. pendingKeys: []. ✅


// ═══════════════════════════════════════════════════════════════════════════
// Example B — computed defaults (Tier 2 ExprVal)
// ═══════════════════════════════════════════════════════════════════════════

export const COMPUTED_DEFAULTS_SCHEMA = {
  params: {
    // Tier 1 — anchor value
    latestYear: { type: 'hidden' as const, defaultValue: 2025 },
  },
  bars: {
    main: {
      position: 'sticky' as const,
      order:    1,
      filters: {
        // Tier 2 — references latestYear (resolved before this in topo order)
        year:     {
          type:         'year-select' as const,
          defaultValue: { $ctx: 'latestYear' },   // → 2025
        },

        // Tier 2 — references year (resolved before this in topo order)
        fromYear: {
          type:         'year-select' as const,
          defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 4 },  // → 2021
        },

        // Tier 2 — references year (independent of fromYear — parallel resolution)
        toYear:   {
          type:         'year-select' as const,
          defaultValue: { $ctx: 'year' },  // → 2025
        },
      },
    },
  },
}
// Topo order: latestYear (Tier 1) → year (refs latestYear) → fromYear (refs year), toYear (refs year)
// fromYear and toYear: no dep between them → declaration order
// Result: { latestYear: 2025, year: 2025, fromYear: 2021, toYear: 2025 } ✅


// ═══════════════════════════════════════════════════════════════════════════
// Example C — cascade chain (Tier 3 + validateCascadeValues)
// ═══════════════════════════════════════════════════════════════════════════

export const CASCADE_CHAIN_SCHEMA = {
  bars: {
    main: {
      position: 'sticky' as const,
      order:    1,
      filters: {
        // Tier 1 — known good static default
        country: {
          type:         'select' as const,
          options:      { type: 'static', items: COUNTRY_OPTIONS },
          defaultValue: 'GE',
        },

        // Tier 3 — first region for selected country
        region: {
          type:         'cascade' as const,
          options:      { type: 'query' as const,
                          data: { type: 'query', storeId: 'geo', indicator: 'REGIONS',
                                  dims: { country: { $ctx: 'country' } } },
                          valueField: 'code', labelField: 'label' },
          dependsOn:    ['country'],
          defaultValue: { from: 'options', pick: 'first' } satisfies OptionsDefault,
          // → first row in REGIONS query result for current country
        },

        // Tier 3 — first city for selected region
        city: {
          type:         'cascade' as const,
          options:      { type: 'query' as const,
                          data: { type: 'query', storeId: 'geo', indicator: 'CITIES',
                                  dims: { region: { $ctx: 'region' } } },
                          valueField: 'code', labelField: 'label' },
          dependsOn:    ['region'],
          defaultValue: { from: 'options', pick: 'first' } satisfies OptionsDefault,
        },
      },
    },
  },
}

// First load flow:
//   country = 'GE' (Tier 1, immediate)
//   isLoading: true — region options fetching for country='GE'
//   → options arrive: ['GE-TB', 'GE-AJ', ...] → region = 'GE-TB' (first)
//   → city options fetching for region='GE-TB'
//   → options arrive: ['tbilisi', ...] → city = 'tbilisi' (first)
//   isLoading: false ✅

// User changes country to 'AM':
//   validateCascadeValues: region='GE-TB' not in AM regions → region = null, city = null
//   Pass 2: region options load for 'AM' → region = 'AM-ER' (first)
//           city options load for 'AM-ER' → city = 'yerevan' (first) ✅


// ═══════════════════════════════════════════════════════════════════════════
// Example D — form reset pattern (effects + Tier 1 defaults)
// ═══════════════════════════════════════════════════════════════════════════

export const FORM_RESET_SCHEMA = {
  bars: {
    main: {
      position: 'sticky' as const,
      order:    1,
      filters: {
        reportType: {
          type:         'select' as const,
          options:      { type: 'static', items: REPORT_TYPE_OPTIONS },
          defaultValue: 'annual',
        },
        quarter: {
          type:         'select' as const,
          options:      { type: 'static', items: QUARTER_OPTIONS },
          defaultValue: 'Q1',       // Tier 1 — picked up by Pass 2 after effect clears
          dependsOn:    ['reportType'],
        },
        month: {
          type:         'select' as const,
          options:      { type: 'static', items: MONTH_OPTIONS },
          defaultValue: 'Jan',      // Tier 1
          dependsOn:    ['reportType'],
        },
      },
    },
  },

  effects: [
    // reportType → 'annual': clear quarterly granularity fields
    { when: { op: 'eq', left: { $ctx: 'reportType' }, right: 'annual' },
      set:  { quarter: null, month: null } },

    // reportType → 'quarterly': clear monthly granularity
    { when: { op: 'eq', left: { $ctx: 'reportType' }, right: 'quarterly' },
      set:  { month: null } },
  ],
}

// Flow when reportType changes to 'annual':
//   effects: quarter=null, month=null
//   Pass 2: quarter.defaultValue='Q1' → quarter='Q1'; month.defaultValue='Jan' → month='Jan'
//   BUT quarter.dependsOn=['reportType'] and reportType='annual' → control disabled in UI
//   Dims still have the value (for potential data queries) — control just shows disabled state ✅
//
// This matches React Hook Form's resetField() behavior:
//   resetField('quarter', { defaultValue: 'Q1' }) → same outcome, imperative form


// ═══════════════════════════════════════════════════════════════════════════
// Example E — mixed: accounts page (Tier 1 + Tier 2 + params field)
// ═══════════════════════════════════════════════════════════════════════════

export const ACCOUNTS_DEFAULTS_SCHEMA = {
  params: {
    // Page-level hidden params — declared once (not duplicated across bars)
    measure: { type: 'hidden' as const, defaultValue: '' },
  },
  bars: {
    'year-bar': {
      position: 'sticky' as const,
      order:    1,
      filters: {
        account:  { type: 'select'      as const, options: { type: 'static', items: ACCOUNT_OPTIONS },  defaultValue: 'B1G'     },
        year:     { type: 'year-select' as const,                                                        defaultValue: 2023      },
        prices:   { type: 'select'      as const, options: { type: 'static', items: PRICE_OPTIONS },     defaultValue: 'current' },
        priceBase:{
          type:         'hidden' as const,
          // Tier 2: priceBase defaults to the selected year (base year = current year)
          defaultValue: { $ctx: 'year' },
        },
      },
    },
    'range-bar': {
      position: 'float' as const,
      order:    2,
      filters: {
        fromYear: {
          type:         'year-select' as const,
          // Tier 2: fromYear defaults to year - 4 (4-year lookback window)
          defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 4 },
        },
        toYear: {
          type:         'year-select' as const,
          defaultValue: { $ctx: 'year' },  // same as year (Tier 2)
        },
      },
    },
  },

  effects: [
    // price mode 'current' → set priceBase = selected year (mirrors effect in filter-effects.ts)
    { when: { op: 'eq', left: { $ctx: 'prices' }, right: 'current' },
      set:  { priceBase: { $ctx: 'year' } } },
  ],
}

// Topo resolution order (across both bars + params):
//   measure (Tier 1, no deps)
//   account (Tier 1, no deps)
//   year    (Tier 1, no deps)
//   prices  (Tier 1, no deps)
//   priceBase (Tier 2, refs year — resolved after year) ✅
//   fromYear  (Tier 2, refs year — resolved after year) ✅
//   toYear    (Tier 2, refs year — resolved after year) ✅


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ $derived in defaultValue — not available at filter time:
// { type: 'year-select', defaultValue: { $derived: 'latestAvailableYear' } }
// $derived is render-time (engine.evalDerived). Defaults resolve at filter time (useFilters).
// ✅ Use { from: 'options', pick: 'last' } with years: YearsSource { type: 'inline', items: { $cl: 'time' } }.

// ❌ Circular default dependency:
// { key: 'a', defaultValue: { $ctx: 'b' } }  AND  { key: 'b', defaultValue: { $ctx: 'a' } }
// → buildDependencyGraph → cycleKeys: ['a', 'b']
// → throws "[defaults] Circular dependency: a → b"

// ❌ Effect that clears but param has no defaultValue:
// effects: [{ when: ..., set: { region: null } }]
// params: { region: { type: 'cascade', options: { type: 'query', ... } } }  ← no defaultValue
// → Pass 2: no defaultValue → region stays null → contracts: required → blocked state
// ✅ Add defaultValue: { from: 'options', pick: 'first' } to region.

// ❌ Using defaultValue for user-required choice:
// { type: 'cascade', options: {...}, defaultValue: 'GE-TB' }  // silently forces a region
// ✅ No defaultValue → null → contracts: { region: 'required' } → EmptyState with "please select"

// ❌ Tier 3 on non-options types:
// { type: 'year-select', defaultValue: { from: 'options', pick: 'first' } }
// → getOptions('year') returns undefined (no options registered) → permanently PENDING
// ✅ { from: 'options' } only on types with options: OptionsSource (cascade, select, multi-select)

// declare to satisfy type checks:
declare const SECTOR_OPTIONS:      SelectOption[]
declare const PRICE_OPTIONS:       SelectOption[]
declare const COUNTRY_OPTIONS:     SelectOption[]
declare const REPORT_TYPE_OPTIONS: SelectOption[]
declare const QUARTER_OPTIONS:     SelectOption[]
declare const MONTH_OPTIONS:       SelectOption[]
declare const ACCOUNT_OPTIONS:     SelectOption[]
```
