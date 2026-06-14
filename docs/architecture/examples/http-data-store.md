# http-data-store.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — HttpDataStore: TRANSFORM_MAP + href pattern
 *
 * Demonstrates:
 * - TRANSFORM_MAP as open registry — any project registers its own transforms
 * - engine.registerTransform() — how a project adds a custom parse fn
 * - type: 'url' DataSpec — raw URL fetch, all rows returned (no query filtering)
 * - href on DataSpecBase — Phase 2 pattern: fetch URL + apply spec query logic
 * - The difference between type:'url' and href on a named spec
 * - Suspense pattern — HttpDataStore throws Promise if not cached
 */

import type { DataSpec, DataStore, Observation, DataRow } from '@geostat/engine'
import { engine, fromSDMX, fromRawSQL }                   from '@geostat/engine'


// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORM_MAP — open registry, project-level registration
// ═══════════════════════════════════════════════════════════════════════════
//
// HttpDataStore ships with two built-in entries.
// Every project adds its own via engine.registerTransform().
// The type DataSpecBase.transform?: string stays agnostic — no closed union.

// Built-in (engine/core — always available):
//   'fromSDMX' → fromSDMX()    SDMX-JSON → Observation[]
//   'raw'      → identity      already Observation[], no parsing needed

// Geostat registers in src/app/setupEngine.ts (alongside engine.extend + engine.extendSpec):
engine.registerTransform('fromSDMX', fromSDMX)
// engine.registerTransform('raw', (r) => r as Observation[])  ← built-in, no need to re-register

// Another project (CSV-based):
// engine.registerTransform('fromCSV', (raw: string) => parseCSV(raw))

// Another project (GraphQL):
// engine.registerTransform('fromGraphQL', (raw) => raw.data.observations)

// The DataSpec config stores the string key — agnostic at type level:
//   transform: 'fromSDMX'      → resolved to fromSDMX() at runtime
//   transform: 'fromCSV'       → resolved to parseCSV() at runtime
//   transform: 'fromGraphQL'   → resolved to graphqlAdapter() at runtime


// ═══════════════════════════════════════════════════════════════════════════
// type: 'url' — raw fetch, ALL rows returned, no query filtering
// ═══════════════════════════════════════════════════════════════════════════
//
// Use when: renderer needs raw unfiltered data, or data is pre-aggregated at API level.
// HttpDataStore fetches href → transform → DataRow[] (everything, no slicing by interpretSpec).

const rawUrlSpec: DataSpec = {
  type:      'url',
  href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
  transform: 'fromSDMX',     // string key → TRANSFORM_MAP['fromSDMX'] at runtime
}
// → DataRow[]: ALL rows from GDP_GE — no indicator/dims filtering applied
// Shell receives full dataset — it must handle slicing/grouping itself
// Use case: custom chart that needs all years × all indicators for its own logic

const rawJsonSpec: DataSpec = {
  type:      'url',
  href:      '/api/regional/custom-aggregates.json',
  transform: 'raw',          // already DataRow[] — no conversion
}
// → DataRow[]: exactly what the endpoint returns


// ═══════════════════════════════════════════════════════════════════════════
// href on DataSpecBase — Phase 2 pattern
// ═══════════════════════════════════════════════════════════════════════════
//
// Use when: you want the FULL interpretSpec query logic (indicator filter, dims slice,
// sort, derive) but the data source is a URL, not a named store.
//
// interpretSpec store resolution:
//   href present  → HttpDataStore for that URL (fetch + cache)
//   storeId       → ctx.stores[storeId] (named store from STORE_MANIFEST)
//   (neither)     → ctx.stores[pageStoreKey] ?? ctx.stores['default']
//
// The ONLY difference from a named store: WHERE the data comes from.
// interpretSpec applies the same query logic either way.

// Phase 1 (named store):
const phase1Timeseries: DataSpec = {
  type:      'timeseries',
  storeId:   'gdp',                    // looks up ctx.stores['gdp']
  indicator: 'B1G',
  dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
}

// Phase 2 (URL — same query logic, different source):
const phase2Timeseries: DataSpec = {
  type:      'timeseries',
  href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',   // HttpDataStore
  transform: 'fromSDMX',
  indicator: 'B1G',
  dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
  // sort, filter, derive — all work identically
}
// interpretSpec: fetches href via HttpDataStore → Observation[] → applies timeseries logic
// → DataRow[]: [{time:2020, value:…}, {time:2021, value:…}, …] — sorted ascending
// Shell: zero changes. Sees DataRow[]. Does not know source was a URL.

// Phase 2 row-list (kpi-strip):
const phase2RowList: DataSpec = {
  type:       'row-list',
  href:       'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
  transform:  'fromSDMX',
  indicators: ['B1G', 'P3', 'P51G'],
  dims:       { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
}
// → DataRow[]: [{indicator:'B1G', value:…}, {indicator:'P3', value:…}, …]

// Phase 2 pivot (multi-series chart):
const phase2Pivot: DataSpec = {
  type:      'pivot',
  href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
  transform: 'fromSDMX',
  indicator: 'B1G',
  rows:      'time',
  cols:      'sector',
  dims:      { geo: { $ctx: 'geo' } },
}
// → DataRow[]: [{time:2020, production:…, income:…}, …] — wide format


// ═══════════════════════════════════════════════════════════════════════════
// type:'url'  vs  href on DataSpecBase — the difference
// ═══════════════════════════════════════════════════════════════════════════
//
//   type:'url'                              href on DataSpecBase
//   ─────────────────────────────────────   ───────────────────────────────
//   fetch → transform → DataRow[] (ALL)     fetch → transform → Observation[]
//                                             → interpretSpec query logic
//                                             → DataRow[] (filtered/sliced)
//
//   No indicator filter                     indicator filter applied ✅
//   No dims slice                           dims slice applied ✅
//   No sort / derive                        sort / derive applied ✅
//   Renderer handles everything             Renderer gets clean DataRow[] ✅
//
//   Use: raw/pre-aggregated endpoints       Use: Phase 2 Constructor pages


// ═══════════════════════════════════════════════════════════════════════════
// Suspense — HttpDataStore throws Promise (React catches)
// ═══════════════════════════════════════════════════════════════════════════
//
// HttpDataStore.query() — three outcomes:
//   cache hit   → return DataRow[]    (sync, instant)
//   cache miss  → throw Promise        (React Suspense catches → shows fallback)
//   fetch error → throw Error          (NodeErrorBoundary catches → shows error UI)
//
// Engine never awaits. interpretSpec is always sync.
// React handles async via Suspense boundary around the page or section.

// In App.tsx or PageLoader — wrap in Suspense:
//
// <Suspense fallback={<PageSkeleton />}>
//   <PageLoader pageId="gdp" />
// </Suspense>
//
// First render:   HttpDataStore throws Promise → Suspense shows skeleton
// After fetch:    React re-renders → cache hit → DataRow[] returned → page shows ✅
//
// Multiple sections with same href: cache keyed by href → one fetch, shared across sections.


// ═══════════════════════════════════════════════════════════════════════════
// Error path — HttpDataStore throws Error (fetch failed)
// ═══════════════════════════════════════════════════════════════════════════
//
// throw Promise  = loading  → Suspense fallback    → page continues after load
// throw Error    = failure  → NodeErrorBoundary     → one node shows error, page continues
//
// Boundary mapping:
//   <Suspense>          wraps page/section — catches throw Promise (HttpDataStore loading)
//   <NodeErrorBoundary> wraps each node    — catches throw Error   (fetch failure, unknown node type)
//
// Example tree:
//
//   <Suspense fallback={<PageSkeleton />}>       ← loading boundary (outer)
//     <NodeErrorBoundary>                         ← error boundary per node (inner)
//       <SectionNode>  ← interpretSpec → HttpDataStore.query() → throws Promise or Error
//     </NodeErrorBoundary>
//   </Suspense>
//
// HttpDataStore internal contract:
//   fetch ok  → set cache → re-render triggers → cache hit → DataRow[]
//   fetch fail → set error state → re-render triggers → throw Error('fetch failed: 404 …')
//   → NodeErrorBoundary catches → renders <NodeErrorFallback />
//   → sibling nodes unaffected — Suspense boundary not touched
//
// Why two separate boundaries (not one)?
//   Suspense cannot catch Error.  ErrorBoundary cannot catch Promise.
//   React requires both when using Suspense-based data fetching.
//   Grafana panels follow the same pattern: loading skeleton + per-panel error state.

// NodeErrorBoundary — class component (React requirement for componentDidCatch):
//
// class NodeErrorBoundary extends React.Component<{ children: ReactNode }> {
//   state = { error: Error | null }
//   static getDerivedStateFromError(e: Error) { return { error: e } }
//   render() {
//     if (this.state.error) return <NodeErrorFallback message={this.state.error.message} />
//     return this.props.children
//   }
// }
//
// Engine wraps each node in NodeErrorBoundary before calling the renderer.
// See architecture/04-render-pipeline.md — G-5 (Error handling).


// ═══════════════════════════════════════════════════════════════════════════
// src/app/setupEngine.ts — full registration (node types + spec types + transforms)
// ═══════════════════════════════════════════════════════════════════════════

import { nodeRegistry }                  from '@geostat/react'
import { LandingPageRenderer }           from '../features/landing/LandingPageRenderer'
import { accountSequenceResolver }       from '../features/accounts/resolvers'
import { fromSDMX }                      from '@geostat/engine'
import { sdmxApiPlugin }                 from '@geostat/engine/plugins/sdmx-api'
import { restJsonPlugin }                from '@geostat/engine/plugins/rest-json'
import { staticPlugin }                  from '@geostat/engine/plugins/static'

export function setupEngine() {
  // 1. Datasource plugins — format/protocol handlers
  engine.registerDatasource(sdmxApiPlugin)    // SDMX-JSON API + ApiResponse envelope
  engine.registerDatasource(restJsonPlugin)   // generic REST JSON (envelope or raw array)
  engine.registerDatasource(staticPlugin)     // inline Observation[] (Phase 1 / dev / test)

  // 2. Custom node types
  engine.extend(nodeRegistry)
  nodeRegistry.register('landing-page', LandingPageRenderer)

  // 3. Custom DataSpec types
  engine.extendSpec('account-sequence', accountSequenceResolver)

  // 4. Custom transforms (for href DataSpecs + type:'url')
  engine.registerTransform('fromSDMX', fromSDMX)
  // engine.registerTransform('fromCSV', myCSVParser)   // if needed
}

// Call once at startup, before any rendering:
// src/main.tsx:  setupEngine()
//                ReactDOM.createRoot(...).render(<App />)


// ═══════════════════════════════════════════════════════════════════════════
// BOTH PATHS COEXIST — storeId (named) + href (URL) in the same SiteProvider
// ═══════════════════════════════════════════════════════════════════════════
//
// These two mechanisms are independent. App.tsx never changes.
// SiteProvider receives stores: STORE_MANIFEST for hand-crafted pages.
// Constructor pages emit href — they work even with stores: {}.
// Both can be on the same page (different sections use different paths).

// App.tsx — unchanged between Phase 1 and Phase 2:
//
//   <SiteProvider
//     stores={manifest.stores}   // STORE_MANIFEST (Phase 1 pages need it)
//     pages={manifest.pages}
//     nav={manifest.nav}
//   >
//
// STORE_MANIFEST still fully populated for hand-crafted pages:
//   { gdp: StaticDataStore | ApiDataStore, accounts: ..., regional: ... }
// Constructor pages emit href → HttpDataStore → stores entry not needed.

// PATH A — named store (storeId): as before, unchanged
const namedStoreSpec: DataSpec = {
  type:      'timeseries',
  storeId:   'gdp',                             // looks up ctx.stores['gdp']
  indicator: 'B1G',
  dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
}
// interpretSpec:
//   storeId = 'gdp' → ctx.stores['gdp'].query({ indicator:'B1G', dims:resolved })
//   → DataRow[]: [{time:2020, value:…}, {time:2021, value:…}, …]
// Nothing new. Works exactly as in Phase 1.

// PATH B — URL (href): Phase 2 / Constructor
const urlSpec: DataSpec = {
  type:      'timeseries',
  href:      'https://api.geostat.ge/sdmx/v1/data/GDP_GE',  // HttpDataStore
  transform: 'fromSDMX',
  indicator: 'B1G',
  dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
}
// interpretSpec:
//   href present → HttpDataStore.query({ href, transform })
//   → fetch → parse → Observation[] → same timeseries query logic
//   → DataRow[]: [{time:2020, value:…}, {time:2021, value:…}, …]
// Shell: zero changes. Sees same DataRow[]. Does not know source.

// RESOLUTION ORDER (interpretSpec):
//   1. spec.href    → HttpDataStore (built-in, always registered)
//   2. spec.storeId → ctx.stores[storeId]
//   3. (neither)    → ctx.stores[pageStoreKey] ?? ctx.stores['default']

// SAME PAGE, DIFFERENT PATHS — valid:
//   Section A:  storeId: 'gdp'       → ctx.stores['gdp']
//   Section B:  href: 'https://...'  → HttpDataStore
//   Both render identically. App.tsx: zero changes.
```
