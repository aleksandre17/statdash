# data-spec.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — DataSpec types + multi-store + by-mode
 *
 * Demonstrates:
 * - All DataSpec variants: query · row-list · timeseries · growth ·
 *   ratio-list · pivot · by-mode · custom
 * - ctx.stores: Record<string, DataStore> — multi-store access
 * - storeId in DataSpec — which store to query
 * - by-mode — routes to different spec based on ctx.timeMode
 * - interpretSpec(spec, ctx, store) — pure function, same interface for all types
 */

import type { DataSpec, SectionContext, DataRow } from '@geostat/engine'
import { interpretSpec }                          from '@geostat/engine'

// ── SectionContext ─────────────────────────────────────────────────────────
// What the renderer has available. dims = OLAP cube slice.

const ctx: SectionContext = {
  timeMode: 'year',                          // 'year' | 'range'
  dims: {
    time:     2023,                          // current year
    timeFrom: 2020,                          // range start (used in 'range' mode)
    timeTo:   2023,                          // range end
    geo:      'GE',                          // current region
    account:  'production',                  // current account filter
  },
}

// ctx.stores (from RenderContext) — multi-store registry
// interpretSpec picks the right store via spec.storeId
const stores: Record<string, DataStore> = {
  accounts: accountsStore,   // national accounts data
  gdp:      gdpStore,        // GDP breakdown data
  regional: regionalStore,   // regional statistics
}


// ── 1. query — filtered rows ──────────────────────────────────────────────
// Most basic: get rows matching indicator + current dims.

const querySpec: DataSpec = {
  type:      'query',
  storeId:   'accounts',
  indicator: 'B1G',
  // interpretSpec applies ctx.dims as filters automatically
}
// → DataRow[]: all B1G rows where time=2023, geo='GE'
// isCarryForward: 1 rows automatically excluded


// ── 2. timeseries — ordered by time ──────────────────────────────────────
// Sorted ascending. Used for line charts.

const timeseriesSpec: DataSpec = {
  type:      'timeseries',
  storeId:   'accounts',
  indicator: 'B1G',
  // returns all years for current geo — NOT filtered by ctx.dims.time
  // ctx.dims.geo IS applied
}
// → DataRow[]: [{ time: 2015, value: ... }, { time: 2016, ... }, ..., { time: 2023, ... }]


// ── 3. growth — year-over-year or period-over-period ──────────────────────
// Computes growth rate. yoy = (current - previous) / previous * 100.

const growthSpec: DataSpec = {
  type:      'growth',
  storeId:   'gdp',
  indicator: 'B1G',
  base:      'yoy',    // 'yoy' | 'period' (range mode: end vs start)
}
// → DataRow[]: [{ time: 2016, value: 120, growth: 5.2 }, ...]
// First row: growth = null (no previous period)


// ── 4. row-list — multiple indicators, one row per indicator ─────────────
// Used for KPI strips: each indicator = one card.

const rowListSpec: DataSpec = {
  type:       'row-list',
  storeId:    'accounts',
  indicators: ['B1G', 'P3', 'P51G', 'D1'],
  // returns one row per indicator, filtered by ctx.dims.time + ctx.dims.geo
}
// → DataRow[]: [
//     { indicator: 'B1G', value: 178837, label: 'GDP' },
//     { indicator: 'P3',  value: 130000, label: 'Final consumption' },
//     ...
//   ]


// ── 5. ratio-list — computed ratios ──────────────────────────────────────
// Each pair: value/base * 100. Used for structure charts.

const ratioListSpec: DataSpec = {
  type:    'ratio-list',
  storeId: 'accounts',
  pairs: [
    { numerator: 'P3',   denominator: 'B1G', label: 'მოხმარება / GDP' },
    { numerator: 'P51G', denominator: 'B1G', label: 'ინვესტიცია / GDP' },
    { numerator: 'D1',   denominator: 'B1G', label: 'შრომის ანაზღ. / GDP' },
  ],
}
// → DataRow[]: [{ label: 'მოხმარება / GDP', ratio: 72.4 }, ...]


// ── 6. pivot — wide format: one column per dimension value ───────────────
// Used for cross-tab charts. rows/cols = dimension names.

const pivotSpec: DataSpec = {
  type:      'pivot',
  storeId:   'accounts',
  indicator: 'B1G',
  rows:      'time',      // dimension → rows axis
  cols:      'account',   // dimension → columns (one col per account value)
}
// → DataRow[]: [
//     { time: 2020, production: 12000, income: 11500, capital: 8000 },
//     { time: 2021, production: 13500, income: 12000, capital: 8500 },
//     ...
//   ]
// Shell receives this — wide format — ready for grouped bar chart


// ── 7. by-mode — routes to different spec based on ctx.timeMode ───────────
// Key innovation: single DataSpec that adapts to filter mode.
// No if/switch in config — engine resolves at render time.

const byModeSpec: DataSpec = {
  type: 'by-mode',
  year: {
    // When timeMode = 'year': show single-year KPI strip
    type:       'row-list',
    storeId:    'accounts',
    indicators: ['B1G', 'P3', 'P51G'],
  },
  range: {
    // When timeMode = 'range': show timeseries for the selected range
    type:      'timeseries',
    storeId:   'accounts',
    indicator: 'B1G',
  },
}
// interpretSpec routes internally:
//   ctx.timeMode === 'year'  → interprets row-list spec
//   ctx.timeMode === 'range' → interprets timeseries spec
// Shell receives DataRow[] either way — shape differs, renderer handles both


// ── 8. url — fetch from arbitrary endpoint, no named store needed ────────
// Built-in HttpDataStore handles this. No setup in store-manifest required.
// JSON-safe: transform is a string key → engine resolves to function at runtime.

const urlSpec: DataSpec = {
  type:      'url',
  href:      '/api/regional/2024.json',
  transform: 'fromSDMX',   // 'fromSDMX' | 'raw'
                            // stored as string in DB (Phase 2 safe)
                            // HttpDataStore: TRANSFORM_MAP['fromSDMX'] → fromSDMX()
}
// → HttpDataStore fetches href, applies fromSDMX(), caches result → DataRow[]
// Suspense: throws Promise if not yet cached — React shows fallback

const urlSpecRaw: DataSpec = {
  type:      'url',
  href:      '/api/custom/endpoint.json',
  transform: 'raw',   // already Observation[] — no conversion needed
}


// ═══════════════════════════════════════════════════════════════════════════
// THREE DATA PATHS — all produce DataRow[], renderer cannot tell the difference
// ═══════════════════════════════════════════════════════════════════════════
//
//  Declarative named  →  { type: 'timeseries', storeId: 'gdp' }
//                         → named DataStore in ctx.stores['gdp']
//                         → interpretSpec → ctx.rows
//
//  Declarative URL    →  { type: 'url', href: '/api/regional/2024.json', transform: 'fromSDMX' }
//                         → HttpDataStore (built-in 'http', always available)
//                         → interpretSpec → ctx.rows
//
//  Imperative         →  ctx.stores + useStoreQuery hook (component wrapper pattern)
//                         → DataRow[] directly in component
//
//  სამივე → DataRow[] → renderer ვერ ხვდება სხვაობას
// ═══════════════════════════════════════════════════════════════════════════


// ── 9. extended types — engine.extendSpec() ──────────────────────────────
// When no built-in type fits, register a custom resolver via engine.extendSpec().
// The type string IS the discriminant — no wrapper 'custom' type needed.
// JSON-serializable ✅ — Constructor-safe ✅ (no functions in config)

// Registration (src/app/setupEngine.ts):
// engine.extendSpec('account-sequence', (spec, ctx, stores) => {
//   const store = stores[(spec as any).storeId ?? 'accounts']
//   return buildAccountSequence(store.query({}), ctx.dims)
// })

// Config — type string is the key registered with extendSpec:
const accountSequenceSpec = {
  type:    'account-sequence',   // registered in engine.extendSpec()
  storeId: 'accounts',
  // Any extra fields → passed as spec to the resolver
}
// interpretSpec: 'account-sequence' not in built-in union
//   → extendSpec registry lookup → resolver(spec, ctx, stores) → DataRow[]
// Renderer: receives DataRow[] — does not know spec type. ✅


// ── Multi-store: different specs use different stores ─────────────────────
// A page with two sections pulling from different datasets:

const gdpSection = {
  type: 'section',
  data: { type: 'timeseries', storeId: 'gdp',      indicator: 'B1G' },
  children: [
    { type: 'chart', layout: { role: 'chart' } },
    { type: 'table', layout: { role: 'table' } },
  ],
}

const regionalSection = {
  type: 'section',
  data: { type: 'query', storeId: 'regional', indicator: 'B1G' },
  children: [
    { type: 'chart', layout: { role: 'chart' } },
  ],
}
// interpretSpec(gdpSection.data, ctx, stores['gdp'])
// interpretSpec(regionalSection.data, ctx, stores['regional'])
// Each section uses its own store — zero coupling


// ── interpretSpec call (engine internal) ─────────────────────────────────
// Pure function. Same signature for ALL DataSpec types.
// Renderer never calls this directly — engine calls it during renderNode().

const rows: DataRow[] = interpretSpec(querySpec, ctx, stores['accounts'])
// → DataRow[] = Record<string, DimVal | null>[]
// chart/table receives this — they don't know which DataSpec type produced it


// ═══════════════════════════════════════════════════════════════════════════
// STATIC STORE vs API STORE — SAME interpretSpec, ZERO CONFIG CHANGE
// ═══════════════════════════════════════════════════════════════════════════
//
// DataStore is an interface. interpretSpec depends on it — not on implementation.
// Swap static ↔ API = change one line in store-manifest.ts. Nothing else.
//
//   DataSpec (WHAT)  +  SectionContext (WHERE)  +  DataStore (SOURCE)
//           ↓                    ↓                        ↓
//                    interpretSpec(spec, ctx, store)
//                              ↓
//                          DataRow[]    ← same shape regardless of source
//
// ═══════════════════════════════════════════════════════════════════════════

import type { DataStore, Observation } from '@geostat/engine'
import { fromSDMX, fromRawSQL }        from '@geostat/engine'


// ── Static Store (development / MSW mock) ────────────────────────────────
// Data lives in a .ts file. No network. Instant. Used in dev + tests.

import { RAW_ACCOUNTS_DATA } from '../data/accounts/raw'

const staticObservations: Observation[] = fromRawSQL(RAW_ACCOUNTS_DATA)
// fromRawSQL = ერთადერთი ადგილი raw SQL format → Observation[]
// e.g. Georgian column names ('wlebi', 'angarishebi') → canonical fields

export const accountsStoreStatic: DataStore = createStaticStore(staticObservations)
// createStaticStore wraps Observation[] with DataStore interface:
//   getRows(filter) → DataRow[]  (in-memory filter, sync)


// ── API Store (production) ────────────────────────────────────────────────
// Fetches SDMX-JSON from backend. Caches. Uses same DataStore interface.

export const accountsStoreApi: DataStore = createApiStore({
  endpoint: '/api/sdmx/national_accounts',
  fromResponse: fromSDMX,
  // fromSDMX = ერთადერთი ადგილი SDMX-JSON → Observation[]
  // SQL → Java DTO → SDMX-JSON response
  //                        ↓  fromSDMX() — boundary
  //                  Observation[]
})
// createApiStore wraps fetch + cache with same DataStore interface:
//   getRows(filter) → DataRow[]  (reads from cache, triggers fetch if stale)


// ── The swap — STORE_MANIFEST is the ONLY thing that changes ─────────────

// Development:
export const STORE_MANIFEST_DEV: Record<string, DataStore> = {
  accounts: accountsStoreStatic,   // ← static
  gdp:      gdpStoreStatic,
  regional: regionalStoreStatic,
}

// Production:
export const STORE_MANIFEST_PROD: Record<string, DataStore> = {
  accounts: accountsStoreApi,      // ← API
  gdp:      gdpStoreApi,
  regional: regionalStoreApi,
}

// In site-manifest.ts:
// const MANIFEST = {
//   stores: import.meta.env.PROD ? STORE_MANIFEST_PROD : STORE_MANIFEST_DEV,
//   pages:  PAGES,
//   nav:    NAV,
// }

// DataSpec configs — IDENTICAL in both cases:
const spec: DataSpec = { type: 'timeseries', storeId: 'accounts', indicator: 'B1G' }
// interpretSpec(spec, ctx, stores['accounts'])
// → DataRow[]  — same result shape, same downstream code, zero changes in config


// ── fromSDMX vs fromRawSQL — the only two boundary adapters ──────────────
//
// fromRawSQL(raw):  raw SQL rows (Georgian cols) → Observation[]   [dev]
// fromSDMX(resp):  SDMX-JSON response            → Observation[]   [prod]
//
// Both return Observation[]. Everything downstream is identical.
// Adapter is the ONLY format-aware code. Engine/React never know the source.
//
//   Raw SQL (dev)      SDMX-JSON API (prod)
//        ↓                     ↓
//   fromRawSQL()          fromSDMX()          ← boundary (one per source format)
//        ↓                     ↓
//   Observation[]         Observation[]       ← same type
//        ↓                     ↓
//   DataStore             DataStore           ← same interface
//        ↓                     ↓
//   interpretSpec()       interpretSpec()     ← same call
//        ↓                     ↓
//   DataRow[]             DataRow[]           ← same output
//        ↓                     ↓
//   Chart / Table         Chart / Table       ← zero change


// ═══════════════════════════════════════════════════════════════════════════
// EXISTING CODEBASE PATTERNS → NEW ARCHITECTURE MAPPING
// "if data already exists, it should be able to work on top of it"
// ═══════════════════════════════════════════════════════════════════════════


// ── 1. Nested query object → flat DataSpecBase ───────────────────────────
// Old pattern: { type:'query', query: { measure, filter, orderBy } }
// New pattern: flat fields directly on DataSpec (no nested query object)
//
// Mapping:
//   query.measure  → indicators (row-list) or indicator (query/timeseries)
//   query.filter   → filter  (already in DataSpecBase)
//   query.orderBy  → sort    (already in DataSpecBase)
//   isCarryForward: 0 → filter value — DimVal (number) → ExprVal ✅

// Old (pre-refactor accounts page):
// { type: 'query', query: { measure: ['P1','B1G',...], filter: { isCarryForward: 0 }, orderBy: { field:'time', dir:'asc' } } }

// New architecture — same intent, flat:
const accountsSequenceSpec: DataSpec = {
  type:       'row-list',
  storeId:    'accounts',
  indicators: ['P1', 'P2', 'B1G', 'D1', 'ACC_NET_TAX', 'B2G',
               'D4_REC', 'D4_PAY', 'B5G', 'D5_REC', 'D5_PAY',
               'B6G', 'P3', 'B8G', 'D9R', 'P5', 'B9'],
  filter:     { isCarryForward: 0 },                     // ← preserved as-is
  sort:       { field: { $literal: 'time' }, dir: 'asc' },  // orderBy → sort
}
// → DataRow[] — one row per indicator, sorted by time, isCarryForward excluded ✅


// ── 2. account-sequence — custom app DataSpec type ───────────────────────
// App-specific spec type not in the built-in DataSpec union.
// Registered via engine.extendSpec() in src/app/setupEngine.ts.
// Config is identical to old — only the resolver moves to the registry.

// DataSpec in page config (unchanged from old):
const accountSeqSpec = {
  type:    'account-sequence',   // custom type — registered, not in union
  storeId: 'accounts',
  filter:  {
    account: { $ctx: 'account' },   // runtime: current account dim
    measure: { $ctx: 'measure' },   // runtime: current measure dim
  },
}

// Registration in src/app/setupEngine.ts:
//   engine.extendSpec('account-sequence', (spec, ctx, stores) => {
//     const store = stores[spec.storeId ?? 'accounts']
//     const rows  = store.query({ filter: evalFilter(spec.filter, ctx.scope) })
//     return buildAccountSequence(rows, ctx.dims)
//     // buildAccountSequence: orders SNA accounts, computes balancing items
//   })
//
// interpretSpec sees 'account-sequence' → specRegistry.get('account-sequence') → resolver
// Renderer sees DataRow[] — does NOT know it came from a custom resolver ✅


// ── 3. encoding → ChartNode.def (data ≠ rendering) ───────────────────────
// Old pattern: encoding inside data:{} — mixed data declaration + render hints
// New pattern: encoding on ChartNode.def (Grammar of Graphics separation)
//
// Old (pre-refactor):
// data: {
//   type: 'query',
//   query: { measure: 'GVA_SECTOR', filter: { geo:{$ctx:'geo'}, time:{$ctx:'time'} }, orderBy: {...} },
//   encoding: { label: 'label', value: 'value', color: 'color', pct: { field: 'pct' } },
// }

// New architecture — same data, encoding moved to ChartNode.def:
const gvaSectorSection = {
  type:   'section',
  data: {
    type:      'query',          // WHAT: fetch GVA by sector
    storeId:   'accounts',
    indicator: 'GVA_SECTOR',    // single indicator, returns rows per sector
    filter:    { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
    sort:      { field: { $literal: 'value' }, dir: 'desc' as const },
  },
  children: [
    {
      type:   'chart',
      layout: { role: 'chart' },
      def: {
        // HOW: encoding lives here — maps DataRow fields to visual channels
        encoding: {
          label: 'label',         // row.label → axis/legend
          value: 'value',         // row.value → bar height
          color: 'color',         // row.color → fill color
          pct:   { field: 'pct' },// row.pct   → label overlay
        },
      },
    },
    { type: 'table', layout: { role: 'table' } },
  ],
}
// interpretSpec → DataRow[] with label/value/color/pct fields
// ChartRenderer reads def.encoding → maps to ApexCharts series/labels
// TableRenderer reads ctx.rows directly — no encoding needed ✅
```
