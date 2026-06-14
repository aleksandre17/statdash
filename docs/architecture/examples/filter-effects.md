# filter-effects.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Effect + CrossValidator — evaluation order and real examples
 *
 * useFilters evaluation order:
 *
 *   1. URL params parsed → base dims  (e.g. { time: 2023, geo: 'KA' })
 *   2. Defaults for unset keys        (ParamDef.defaultValue fills gaps)
 *   3. Effects (array order)          when → set dims; single pass
 *   4. CrossValidators (array order)  expr=false → errors[key] = message; full pass
 *   5. return FiltersResult           (ctx.dims, bars, errors)
 *
 * Effects: single pass, no cascading (Grafana: same decision).
 *   If Effect B depends on a value set by Effect A → place A before B in the array.
 *   Infinite loop prevention: dims are read once per effect evaluation, never re-triggered.
 *
 * CrossValidators: all run regardless of earlier failures (collect all errors).
 *   Shell reads errors[filter.key] per control and shows inline message.
 */

import type { Effect, CrossValidator, FilterSchemaInput } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Effects — when → set
// ═══════════════════════════════════════════════════════════════════════════

// Effect 1 — sector availability by year
// სექტორის დაყოფა მხოლოდ 2010-დან. ადრინდელ წლებში force TOTAL.
const EFFECT_SECTOR_FLOOR: Effect = {
  when: { op: 'lt', left: { $ctx: 'time' }, right: 2010 },
  set:  { sector: { $literal: 'TOTAL' } },
}

// Effect 2 — price base resets on methodology change
// მიმდინარე ფასების რეჟიმში previous-year base არ გამოიყენება.
const EFFECT_PRICE_BASE_RESET: Effect = {
  when: { op: 'eq', left: { $ctx: 'prices' }, right: 'current' },
  set:  { priceBase: { $ctx: 'time' } },   // base year = selected year
}

// Effect 3 — national total clears region breakdown
// ეროვნული ჯამი (geo='GEO') — რეგიონული კატეგორიზაცია არ ვრცელდება.
const EFFECT_NATIONAL_CLEARS_REGION: Effect = {
  when: { op: 'eq', left: { $ctx: 'geo' }, right: 'GEO' },
  set:  { region: null },
}

// Effect ordering matters when A's output feeds B:
//
//   effects: [EFFECT_PRICE_BASE_RESET, EFFECT_SECTOR_FLOOR]
//
//   single pass → EFFECT_PRICE_BASE_RESET runs first (sets priceBase).
//   EFFECT_SECTOR_FLOOR runs second (reads time, sets sector).
//   If EFFECT_SECTOR_FLOOR's `when` referenced priceBase, it would see the updated value.
//   Reverse order → EFFECT_SECTOR_FLOOR sees ORIGINAL priceBase (not yet updated). Bug.
//   Fix: reorder, not add cascading.


// ═══════════════════════════════════════════════════════════════════════════
// CrossValidators — expr → errors[key]
// ═══════════════════════════════════════════════════════════════════════════

// CrossValidator 1 — range: from ≤ to
// timeFrom > timeTo = invalid range. Error attached to timeFrom filter control.
const CV_RANGE_ORDER: CrossValidator = {
  key:     'timeFrom',
  expr:    { op: 'lte', left: { $ctx: 'timeFrom' }, right: { $ctx: 'timeTo' } },
  message: { $literal: 'საწყისი წელი ბოლო წელს ვერ გადაასწრებს' },
}

// CrossValidator 2 — range width ≤ 10 years (performance + chart readability)
// Error attached to timeTo — "reduce the end year" message.
const CV_RANGE_MAX: CrossValidator = {
  key:     'timeTo',
  expr:    {
    op:    'lte',
    left:  { op: 'sub', left: { $ctx: 'timeTo' }, right: { $ctx: 'timeFrom' } },
    right: 10,
  },
  message: { $literal: 'მაქსიმუმ 10 წლის პერიოდი შეიძლება შეირჩეს' },
}

// CrossValidator 3 — sector TOTAL required when year < 2010 (guard: Effect 1 may not run)
// Belt-and-suspenders: even if Effect was somehow bypassed, validator catches the bad state.
// Error attached to sector control.
const CV_SECTOR_YEAR: CrossValidator = {
  key:     'sector',
  expr:    {
    op: 'or',
    exprs: [
      { op: 'gte', left: { $ctx: 'time' }, right: 2010 },
      { op: 'eq',  left: { $ctx: 'sector' }, right: 'TOTAL' },
    ],
  },
  message: { op: 'template', tmpl: '{time} წლისთვის სექტორული დაყოფა არ არსებობს' },
}


// ═══════════════════════════════════════════════════════════════════════════
// Full schema — Effects + CrossValidators together
// ═══════════════════════════════════════════════════════════════════════════

export const ACCOUNTS_FILTER_SCHEMA: FilterSchemaInput = {
  bars: {
    main: {
      position: 'sticky',
      order:    1,
      filters: {
        time:      { type: 'year-select', defaultValue: 2023 },
        sector:    { type: 'select',      options: SECTOR_OPTIONS, defaultValue: 'TOTAL' },
        prices:    { type: 'select',      options: PRICE_OPTIONS,  defaultValue: 'current' },
        priceBase: { type: 'hidden',      defaultValue: 2023 },
      },
    },
    range: {
      position: 'float',
      order:    2,
      filters: {
        timeFrom: { type: 'year-select', defaultValue: 2015 },
        timeTo:   { type: 'year-select', defaultValue: 2023 },
      },
    },
  },

  // Effects run in this order (single pass):
  //   1. EFFECT_PRICE_BASE_RESET — sets priceBase from time
  //   2. EFFECT_SECTOR_FLOOR    — sets sector to TOTAL for years < 2010
  effects: [
    EFFECT_PRICE_BASE_RESET,
    EFFECT_SECTOR_FLOOR,
  ],

  // CrossValidators run after all effects (full pass — all errors collected):
  crossValidate: [
    CV_RANGE_ORDER,   // timeFrom ≤ timeTo
    CV_RANGE_MAX,     // range ≤ 10 years
    CV_SECTOR_YEAR,   // sector=TOTAL guard for years < 2010
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// How shell reads errors
// ═══════════════════════════════════════════════════════════════════════════
//
// FiltersResult.errors: Record<string, string>
//   errors['timeFrom'] = 'საწყისი წელი ბოლო წელს ვერ გადაასწრებს'  ← from CV_RANGE_ORDER
//   errors['timeTo']   = 'მაქსიმუმ 10 წლის პერიოდი...'               ← from CV_RANGE_MAX
//   errors['sector']   = '2005 წლისთვის სექტორული...'                ← from CV_SECTOR_YEAR
//
// Shell pattern (per ActiveFilter):
//   const { errors } = useFilter()
//   // in filter control loop:
//   const error = errors[filter.key]
//   return (
//     <>
//       <FilterControl filter={filter} />
//       {error && <span className="filter-error">{error}</span>}
//     </>
//   )


// ═══════════════════════════════════════════════════════════════════════════
// What Effects are NOT
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Effects do NOT replace DimContract:
//    contract: { sector: 'wildcard' }  ← correct for optional sector
//    Effect that sets sector=TOTAL on null ← wrong, adds logic where data contract belongs

// ❌ Effects do NOT load options (cascade does):
//    Effect cannot trigger an async options reload — it only sets DimVal scalars.
//    For conditional options: use cascade ParamDef with a dynamic options: OptionsSource.

// ❌ Effects do NOT validate (CrossValidators do):
//    Using an Effect to "undo" invalid state (e.g. reset timeFrom when timeFrom > timeTo)
//    is correct as UX guard, but CrossValidator must still fire — Effect alone is not validation.

// declare to satisfy type check in example:
declare const SECTOR_OPTIONS: Array<{ value: string; label: string }>
declare const PRICE_OPTIONS:  Array<{ value: string; label: string }>
```
