# filter-schema.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — defineFilters + useFilters
 *
 * Demonstrates:
 * - defineFilters: pure schema builder (no hooks, JSON-in)
 * - useFilters: hook (URL state, live dims)
 * - Phase 2 compatibility (schema survives JSON.parse/stringify)
 * - effects (cross-filter)
 * - crossValidate
 * - derive (DeriveMap — pure ExprVal)
 * - ParamDef types: hidden, year-select (YearsSource), select (OptionsSource), cascade
 */

import { defineFilters, useFilters, FilterProvider, useTheme, useStores, engine } from '@geostat/react'
import type { FiltersResult, RenderContext, FlatFilters }                          from '@geostat/react'

// ── Step 1: defineFilters — PURE schema (no hooks, no React) ─────────────
// This object can be: serialized to JSON, stored in DB, fetched from API.
// Constructor (Phase 2) builds this schema through GUI.

export const gdpFilterSchema = defineFilters({
  bars: {
    main: {
      position: 'sticky',
      order:    1,
      filters: {
        // hidden: URL param, no UI control
        mode: {
          type:         'hidden',
          defaultValue: 'year',
        },
        // year-select: dynamic years from classifier (replaces range: [min, max])
        time: {
          type:         'year-select',
          years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
          defaultValue: { from: 'options', pick: 'last' },   // most recent year
        },
        // cascade: options from DataStore query (replaces storeId + optionsQuery)
        geo: {
          type:    'cascade',
          options: {
            type:       'query',
            data:       { type: 'query', indicator: 'GEO_LIST' },
            valueField: 'code',
            labelField: 'label',
          },
          defaultValue: { from: 'options', pick: 'first' },
        },
      },
    },
    secondary: {
      position: 'float',
      order:    2,
      filters: {
        // select: OptionsSource (static — replaces raw SelectOption[])
        measure: {
          type:    'select',
          options: { type: 'static', items: [
            { value: 'current', label: 'მიმდინარე ფასებში' },
            { value: 'real',    label: 'უცვლელ ფასებში' },
          ]},
          defaultValue: 'current',
        },
      },
    },
  },

  // Cross-filter effects — Retool pattern (JSON, declarative)
  effects: [
    {
      // When mode switches to 'range', clear time year selection
      when: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' },
      set:  { time: null },
    },
  ],

  // Cross-validation — must all pass for valid state
  crossValidate: [
    {
      expr:    { op: 'exists', value: { $ctx: 'geo' } },
      message: 'გთხოვთ აირჩიოთ რეგიონი',
    },
  ],

  // Derived dims — DeriveMap (Array, ordered, pure ExprVal)
  // tree-field/map-field → engine DeriveEntry (not here)
  derive: [
    {
      key:  'isYearMode',
      expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
    },
    {
      key:  'activeLabel',
      expr: {
        op:   'if',
        cond: { $derived: 'isYearMode' },      // references earlier entry ✅
        then: { op: 'template', tmpl: '{time} · მლნ ₾' },
        else: { op: 'template', tmpl: '{timeFrom}–{timeTo} · მლნ ₾' },
      },
    },
  ],
})
// → FilterSchema (pure, no hooks, DB-serializable)
// JSON.parse(JSON.stringify(gdpFilterSchema)) === gdpFilterSchema ✅


// ── Step 2: useFilters — HOOK (in React component only) ─────────────────
// SiteRenderer calls this. Never call useFilters outside React.

// This is what engine/react/SiteRenderer does internally.
// In your app: use <SiteRenderer page={page} /> — do not replicate this.
function GDPSiteRenderer({ page }: { page: typeof GDP_PAGE }) {
  const theme         = useTheme()          // from ThemeProvider (outer)
  const stores        = useStores()         // from SiteProvider  (outer)
  const filtersResult = useFilters(gdpFilterSchema)
  // filtersResult.ctx.dims = { mode: 'year', time: 2023, geo: 'ka', measure: 'current', isYearMode: true, activeLabel: '2023 · მლნ ₾' }
  // filtersResult.bars = FilterBarSpec[] (ready for FilterBarShell)
  // filtersResult.isLoading = false (or true if cascade options loading)
  // filtersResult.errors = {} (or validation errors)

  const baseCtx: RenderContext = {
    theme,
    stores,
    rows:    [],                           // populated per-node by interpretSpec
    derived: {},                           // populated per-node by engine.evalDerived()
    view:    {},                           // populated per-node by evalViewParams
    dims:    filtersResult.ctx.dims,       // injected into all DataSpec.$ctx references
    scope:   { dims: filtersResult.ctx.dims, derived: {} },
  }

  return (
    <FilterProvider value={filtersResult}>
      {engine.renderNode(page, baseCtx)}
    </FilterProvider>
  )
}


// ── Phase 2 Scenario ────────────────────────────────────────────────────
// Constructor stores filterSchema JSON in DB.
// At runtime: load from DB → defineFilters → useFilters. Zero code changes.

async function phase2Example() {
  const pageConfig = await loadPage('gdp')            // from API
  // pageConfig.filterSchema = the same JSON as defineFilters input
  const schema = defineFilters(pageConfig.filterSchema)  // JSON input ✅
  // useFilters(schema) in React component — identical behavior
}


// ── FlatFilters<B> — typed key union across bars ─────────────────────────
// FlatFilters<B> = UnionToIntersection<B[keyof B]['filters']>
// Merges all bars' filter Records into one flat typed object.

type GDPFilters = FlatFilters<(typeof gdpFilterSchema)['bars']>
// Resolves to:
// {
//   mode:    HiddenParamDef
//   time:    YearSelectParamDef
//   geo:     CascadeParamDef
//   measure: SelectParamDef
// }

// Use case: compile-time key verification on $ctx references.
// keyof GDPFilters → 'mode' | 'time' | 'geo' | 'measure'
//
// Runtime: always access through ctx.dims (plain Record<string, DimVal>).
// const time = filtersResult.ctx.dims['time'] as number   ← runtime access
// { $ctx: 'time' satisfies keyof GDPFilters }             ← compile-time key check
```
