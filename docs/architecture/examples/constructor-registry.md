# constructor-registry.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Constructor registry: node metadata + schema + transforms + data catalog
 *
 * Demonstrates:
 * - NodeRegistryMeta interface — label, icon, category, variants, schema (all optional)
 * - nodeRegistry.register() — one call = rendering + Constructor introspection
 * - nodeRegistry.list() — Constructor type picker (auto-updates when new type registered)
 * - nodeRegistry.getSchema() — Constructor form rendering
 * - engine.listTransforms() — Constructor transform dropdown
 * - Data catalog API contract (GET /api/catalog → DatasetEntry[])
 * - buildDataSpecFromCatalog() — Constructor assembles DataSpec from user picks
 * - Full Constructor lifecycle: assemble PageConfig → save DB → manifest → render
 * - How "add new type → Constructor auto-sees it" works
 *
 * Two separate catalogs (never mix):
 *   nodeRegistry.list()   = UI component types  (section, chart, table…)
 *   GET /api/catalog      = data datasets        (GDP_GE, ACCOUNTS_GE…)
 */

import { engine, nodeRegistry }       from '@geostat/react'
import type { NodeRegistryMeta,
              PageConfig, NodeDef }   from '@geostat/react'
import { fromSDMX }                   from '@geostat/engine'
// Renderers live in plugins/ and are wired via setupRegistrations().
// Constructor reads nodeRegistry.list() — never imports renderers directly.


// ═══════════════════════════════════════════════════════════════════════════
// NodeRegistryMeta — Constructor introspection interface (all fields optional)
// ═══════════════════════════════════════════════════════════════════════════
//
// Defined in @geostat/react — shown here for reference.
// Without any meta: node renders fine, Constructor shows JSON editor fallback.
// Meta is added progressively — start with label, add schema later.

// interface NodeRegistryMeta {
//   label?:    string                  // 'სექცია' — Constructor type picker label
//   icon?:     string                  // 'layout-section' — icon key
//   category?: string                  // 'layout' | 'data' | 'page' — palette grouping
//   variants?: string[]                // CSS modifier hints — derived from component const
//   schema?:   Record<string, unknown> // JSON Schema → form UI (else JSON editor fallback)
//   preview?:  string                  // palette tile thumbnail path (optional)
//                                      // canvas preview = iframe of actual app, not this
// }
//
// variants source of truth rule:
//   List lives in the COMPONENT:  export const SECTION_VARIANTS = ['card','panel','hero'] as const
//   Registration imports it:      variants: [...SECTION_VARIANTS]
//   → CSS + registry + Constructor picker always in sync. Drift structurally impossible.
//   → CSS accepts any string — list is a UI hint, not enforcement. ✅ open, not narrowing.


// ═══════════════════════════════════════════════════════════════════════════
// JSON SCHEMA — node config forms (optional per type)
// ═══════════════════════════════════════════════════════════════════════════
//
// Without schema → Constructor shows raw JSON editor (Monaco/CodeMirror)
// With schema    → Constructor shows form UI (react-jsonschema-form or custom)
// Teams add schemas progressively: start without, add when UX matters.

const SectionNodeSchema = {
  type: 'object',
  title: 'სექცია',
  properties: {
    title:    { type: 'string', title: 'სათაური' },
    variant:  { type: 'string', title: 'სტილი', enum: ['card', 'panel', 'hero'] },
    data:     { title: 'მონაცემები', $ref: '#/definitions/DataSpec' },
    children: { type: 'array',  title: 'შიგთავსი', items: { $ref: '#/definitions/NodeDef' } },
  },
  required: ['children'],
}

const KpiStripNodeSchema = {
  type: 'object',
  title: 'KPI ზოლი',
  properties: {
    data: { title: 'მონაცემები', $ref: '#/definitions/DataSpec' },
  },
  required: ['data'],
}

// Chart, Table: complex schemas — add later.
// Constructor shows JSON editor fallback until schema provided.


// ═══════════════════════════════════════════════════════════════════════════
// setupEngine() — one function, full registration
// ═══════════════════════════════════════════════════════════════════════════
//
// Called once in main.tsx before render.
// After this: engine renders nodes + Constructor can introspect.

// setupRegistrations (src/setupRegistrations.ts) does the actual registration via barrels.
// See: examples/vertical-slice-registration.md for the full pattern.
// This file focuses on: Constructor introspection AFTER registrations are done.
//
// After setupRegistrations() runs:
//   nodeRegistry has: section/default, chart/default, table/default, kpi-strip/default,
//                     filter-bar/default, inner-page/default, tab-page/default,
//                     container-page/default, container-page/landing,
//                     landing-hero/default, landing-stats/default
//   chromeRegistry has: AppHeader/default, AppHeader/minimal, AppHeader/compact,
//                       AppSidebar/default, AppSidebar/collapsed, AppSidebar/hidden,
//                       AppFooter/default, AppFooter/minimal
//   engine has: account-sequence spec, fromSDMX transform, http store


// ═══════════════════════════════════════════════════════════════════════════
// "ახალი node type დავამატე — Constructor-ი ხედავს?"
// ═══════════════════════════════════════════════════════════════════════════
//
// YES. ავტომატურად. ეს არის open registry-ის მთავარი სარგებელი.
//
// Step 1: Developer adds new type anywhere in the app:
//
//   nodeRegistry.register('map', MapRenderer, {
//     label:    'რუქა',
//     icon:     'map',
//     category: 'data',
//     variants: ['choropleth', 'bubble'],
//   })
//
// Step 2: Constructor next time it loads:
//
//   nodeRegistry.list()
//   → [..., { type: 'map', label: 'რუქა', category: 'data', variants: ['choropleth','bubble'] }]
//
// Step 3: Constructor shows 'რუქა' in palette — zero Constructor code change.
//
// Step 4: Constructor sets node.variant = 'choropleth' in config JSON.
//         CSS: .section--choropleth { ... } — renders. Done.
//
// "CSS variant list updated, Constructor doesn't know?"
//   → Constructor can still pass ANY string as variant.
//     CSS applies it if rule exists, ignores if not. Graceful. No crash.
//   → Add new variant to NodeRegistryMeta.variants → picker shows it. Optional.


// ═══════════════════════════════════════════════════════════════════════════
// Constructor type picker — nodeRegistry.list()
// ═══════════════════════════════════════════════════════════════════════════

const types = nodeRegistry.list()
// → [
//     { type: 'section',      label: 'სექცია',           icon: 'layout-section', category: 'layout', variants: ['card','panel','hero'], schema: {...} },
//     { type: 'kpi-strip',    label: 'KPI ზოლი',         icon: 'bar-chart',      category: 'data',   schema: {...} },
//     { type: 'chart',        label: 'გრაფიკი',          icon: 'chart-line',     category: 'data'                  },
//     { type: 'table',        label: 'ცხრილი',           icon: 'table',          category: 'data'                  },
//     { type: 'filter-bar',   label: 'ფილტრის პანელი',   icon: 'filter',         category: 'layout'                },
//     { type: 'landing-page', label: 'სალანდინგო გვერდი',icon: 'home',           category: 'page'                  },
//   ]

// Constructor groups by category → palette:
//   layout: [სექცია, ფილტრის პანელი]
//   data:   [KPI ზოლი, გრაფიკი, ცხრილი]
//   page:   [სალანდინგო გვერდი]


// ═══════════════════════════════════════════════════════════════════════════
// Constructor config form — nodeRegistry.getSchema(type)
// ═══════════════════════════════════════════════════════════════════════════

function ConstructorNodeForm({ type }: { type: string }) {
  const schema = nodeRegistry.getSchema(type)

  if (schema) {
    return <JsonSchemaForm schema={schema} onSubmit={saveNode} />
  }

  // Fallback — always works, zero setup required
  return <MonacoEditor language="json" onSave={saveNode} />
}


// ═══════════════════════════════════════════════════════════════════════════
// Constructor transform dropdown — engine.listTransforms()
// ═══════════════════════════════════════════════════════════════════════════

const transforms = engine.listTransforms()
// → ['fromSDMX']   (+ any added via engine.registerTransform)
//
// DataSpec form — 'transform' field → <select> populated from this list.
// New transform registered → select shows it automatically. ✅


// ═══════════════════════════════════════════════════════════════════════════
// DATA CATALOG — completely separate from node type catalog
// ═══════════════════════════════════════════════════════════════════════════
//
//   nodeRegistry.list()  = WHAT node types can Constructor place on a page
//   GET /api/catalog     = WHAT datasets can nodes pull data from
//
// Backend derives catalog from SDMX DSD — pre-processed, Constructor-friendly.
// Frontend never fetches raw SDMX. Catalog API is the boundary.
//
// "New dataset available?"
//   Backend adds table → DSD published → catalog endpoint returns new entry.
//   Constructor data picker shows it next load. Zero frontend change. ✅

interface DimensionMeta {
  key:    string                               // 'geo' | 'time' | 'sector'
  label:  string                               // 'გეოგრაფია' | 'პერიოდი'
  values: Array<{ code: string; label: string }>
}

interface IndicatorMeta {
  code:  string   // 'B1G' | 'P3' | 'P51G'
  label: string   // 'მშპ' | 'მოხმარება' | 'ინვესტიციები'
}

interface DatasetEntry {
  id:         string   // 'GDP_GE'
  label:      string   // 'მთლიანი შიდა პროდუქტი'
  href:       string   // 'https://api.geostat.ge/sdmx/v1/data/GDP_GE'
  transform:  string   // 'fromSDMX' — matches engine.listTransforms() key
  dimensions: DimensionMeta[]
  indicators: IndicatorMeta[]
}

const catalogExample: DatasetEntry[] = [
  {
    id:        'GDP_GE',
    label:     'მთლიანი შიდა პროდუქტი',
    href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
    transform: 'fromSDMX',
    dimensions: [
      { key: 'geo',    label: 'გეოგრაფია', values: [{ code: 'GE', label: 'საქართველო' }] },
      { key: 'time',   label: 'პერიოდი',   values: [{ code: '2023', label: '2023' }, { code: '2024', label: '2024' }] },
      { key: 'sector', label: 'სექტორი',   values: [{ code: 'S1', label: 'სულ' }, { code: 'S11', label: 'კორპ.' }] },
    ],
    indicators: [
      { code: 'B1G',  label: 'მშპ' },
      { code: 'P3',   label: 'მოხმარება' },
      { code: 'P51G', label: 'ინვესტიციები' },
    ],
  },
  {
    id:        'ACCOUNTS_GE',
    label:     'ეროვნული ანგარიშები',
    href:      'https://api.geostat.ge/sdmx/v1/data/ACCOUNTS_GE',
    transform: 'fromSDMX',
    dimensions: [
      { key: 'geo',     label: 'გეოგრაფია', values: [{ code: 'GE', label: 'საქართველო' }] },
      { key: 'time',    label: 'პერიოდი',   values: [] },
      { key: 'account', label: 'ანგარიში',  values: [{ code: 'P1', label: 'წარმოება' }] },
    ],
    indicators: [
      { code: 'B1G', label: 'დამატებული ღირებულება' },
      { code: 'D1',  label: 'შრომის ანაზღაურება' },
    ],
  },
]


// ═══════════════════════════════════════════════════════════════════════════
// buildDataSpecFromCatalog — Constructor assembles DataSpec from user picks
// ═══════════════════════════════════════════════════════════════════════════
//
// User flow in Constructor UI:
//   1. Browse catalog → pick 'GDP_GE'
//   2. Pick spec type → 'timeseries'
//   3. Pick indicator → 'B1G'
//   4. Pick dims → ['geo', 'time']
//   → buildDataSpecFromCatalog() → JSON saved to DB

function buildDataSpecFromCatalog(
  dataset:   DatasetEntry,
  specType:  string,      // open — any registered DataSpec type. NOT a closed union.
  indicator: string,
  dims:      string[],    // dimension keys to bind to $ctx
) {
  return {
    type:      specType,
    href:      dataset.href,         // from catalog — Constructor never types URLs manually
    transform: dataset.transform,    // from catalog — always matches what engine expects
    indicator,
    dims: Object.fromEntries(
      dims.map(key => [key, { $ctx: key }])
    ),
    // → { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } }
    // interpretSpec() resolves $ctx from RenderContext.dims at render time
  }
}

const generatedSpec = buildDataSpecFromCatalog(
  catalogExample[0],   // GDP_GE
  'timeseries',        // spec type chosen by Constructor user
  'B1G',
  ['geo', 'time'],
)
// → {
//     type:      'timeseries',
//     href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
//     transform: 'fromSDMX',
//     indicator: 'B1G',
//     dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
//   }


// ═══════════════════════════════════════════════════════════════════════════
// Constructor full lifecycle — assemble → save → manifest → render
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor user builds this page visually. Output = plain JSON:

const constructedPage: PageConfig = {
  type:  'inner-page',
  id:    'gdp-q3-2024',
  title: 'მშპ — 2024 III კვარტალი',
  children: [
    {
      type: 'filter-bar',
      id:   'fb-1',
      bars: {
        main: {
          position: 'sticky',
          filters: {
            time: { type: 'year-select', default: 2024 },
            geo:  { type: 'hidden',      default: 'GE'  },
          },
        },
      },
    } satisfies NodeDef,
    {
      type:    'section',
      id:      'section-gdp-annual',
      variant: 'card',              // picked from NodeRegistryMeta.variants → CSS: .section--card
      title:   'წლიური მშპ',
      data:    generatedSpec,       // from buildDataSpecFromCatalog
      children: [
        { type: 'chart', id: 'chart-1', def: { mark: 'bar', encoding: { x: { field: 'time' }, y: { field: 'value' } } } },
        { type: 'table', id: 'table-1', columns: [{ field: 'time', label: 'წელი' }, { field: 'value', label: 'მლნ. ლარი' }] },
      ],
    } satisfies NodeDef,
  ],
}

// Constructor saves to DB:
//   INSERT INTO pages (id, type, title, config)
//   VALUES ('gdp-q3-2024', 'inner-page', 'მშპ — 2024 III კვარტალი', $config)
//   — config = JSON.stringify(constructedPage) ✅ fully serializable

// App reads via manifest API:
//   GET /api/site-manifest
//   → { pages: { ..., 'gdp-q3-2024': constructedPage }, nav: [...], stores: {...} }

// SiteRenderer:
//   engine.renderNode(constructedPage, baseCtx)
//   ← same pipeline. Does not know or care config came from Constructor.

// Zero app code changes for new Constructor page. ✅


// ═══════════════════════════════════════════════════════════════════════════
// Summary — what Constructor reads vs writes
// ═══════════════════════════════════════════════════════════════════════════
//
//  READS (discovery — stays in sync automatically):
//   nodeRegistry.list()      → available node types + variants + schemas
//   engine.listTransforms()  → available DataSpec transforms
//   GET /api/catalog         → available datasets + dimensions + indicators
//
//  WRITES (content — saved to DB):
//   INSERT pages             → PageConfig JSON
//   INSERT nav_items         → NavItem rows
//   UPDATE tokens            → SiteManifest.tokens (CSS overrides)
//
//  Open/Closed check:
//   New node type registered  → list() returns it    → Constructor sees it  ✅
//   New transform registered  → listTransforms()     → Constructor sees it  ✅
//   New dataset in backend    → catalog API returns  → Constructor sees it  ✅
//   New CSS variant in CSS    → string passes freely → renders              ✅
//   New page built            → saved to DB          → manifest returns it  ✅
```
