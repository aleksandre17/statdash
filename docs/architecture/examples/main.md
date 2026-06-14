# main.tsx

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — src/main.tsx: top-level await bootstrap
 *
 * Demonstrates:
 * - Grafana bootData pattern: manifest is a prerequisite, resolved BEFORE React mounts
 * - fetchSiteManifest() layered: static (Phase 1) → MSW (dev:api) → real API (Phase 2)
 * - engine.buildStoreManifest() — async, resolves Tier 2 structure fetches in parallel
 * - App receives manifest + stores as props — SiteProvider never renders without data
 * - setupEngine() called once, before any rendering
 * - No loading state in React component tree — loading is HTML-level concern
 *
 * Why top-level await, not useEffect/useState:
 *   SiteManifest (pages, nav, stores) is required for every render.
 *   Showing any part of the app without it is impossible — no partial render benefit.
 *   Loading before React mounts = zero component tree complexity.
 *   Vite + modern browsers support top-level await natively.
 */

import React                      from 'react'
import ReactDOM                   from 'react-dom/client'
import { App }                    from './app/App'
import { setupRegistrations }     from './app/setupRegistrations'
import { fetchSiteManifest }      from './data/site-manifest'
import { engine }                 from '@geostat/engine'
import { applyTokens }            from '@geostat/react'

// 1. Register all plugins (datasources, nodes, chrome, controls).
//    Must happen before any engine.registerDatasource() / engine.renderNode() call.
setupRegistrations()

// 2. Fetch manifest — blocks until ready.
//    Phase 1 (static): returns immediately, no network.
//    Phase 2 (API):    awaits fetch('/api/site') — full manifest in one request.
//    During await: browser shows HTML skeleton (index.html #root spinner, if any).
const manifest = await fetchSiteManifest()

// 3. Apply brand tokens BEFORE createRoot — no FOUC.
//    Sets CSS custom properties on :root synchronously.
//    Phase 1: tokens = static defaults from manifest.ts
//    Phase 2: tokens = Constructor's brand panel → different per site/tenant
applyTokens(manifest.tokens ?? {})

// 4. Build stores — ASYNC, awaits all Tier 2 structure fetches in parallel.
//    Tier 1 (config.classifiers): sync — instant, zero HTTP
//    Tier 2 (config.structureUrl): fetch NOW, parallel via Promise.all
//    Tier 3 (neither): SuspenseStore { classifiers:{} } — fills on first data load
//    After await: all Tier 1 + Tier 2 classifiers populated. Observations: null (lazy).
const stores = await engine.buildStoreManifest(manifest.datasources)

// 5. Mount React — manifest + stores complete, tokens on :root.
//    App receives manifest (pages, nav, chrome) + stores (built DataStore instances).
//    SiteProvider renders once, synchronously — no null check, no loading state.
//    First paint = branded (tokens applied at step 3).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App manifest={manifest} stores={stores} />
  </React.StrictMode>
)


// ── HTTP timeline before React mounts ─────────────────────────────────────────
//
//   Phase 1 (static configs):
//     No network at all. DATASOURCE_CONFIGS from TypeScript. buildStoreManifest: instant.
//     Zero HTTP requests before React mounts.
//
//   Phase 2 (mixed tiers, e.g. gdp=Tier1, accounts=Tier2, regional=Tier3):
//     t=0   GET /api/site                        ← 1 request
//     t=x   manifest arrives
//     t=x   GET …/datastructure/NA_GE            ← 1 request (accounts Tier 2)
//           (gdp: Tier 1 — no request. regional: Tier 3 — no request yet.)
//     t=y   structure arrives → accounts classifiers populated
//     t=y   React mounts
//             filter dropdowns: accounts ✅ (Tier 2), gdp ✅ (Tier 1), regional ⏳ (Tier 3)
//
//   Data requests: ZERO before React mounts.
//   All observation fetches fire lazily on first page render via Suspense.


// ── src/app/setupRegistrations.ts ────────────────────────────────────────────
//
// Called once at startup. All plugins in one place — discoverable.

import { sdmxApiPlugin }           from '@geostat/engine/plugins/sdmx-api'
import { restJsonPlugin }          from '@geostat/engine/plugins/rest-json'
import { staticPlugin }            from '@geostat/engine/plugins/static'
import { nodeRegistry }            from '@geostat/react'
import { LandingPageRenderer }     from '../features/landing/LandingPageRenderer'
import { accountSequenceResolver } from '../features/accounts/resolvers'
import { fromSDMX }                from '@geostat/engine'

export function setupRegistrations() {
  // Datasource plugins — each handles a different data format/protocol
  engine.registerDatasource(sdmxApiPlugin)    // SDMX-JSON API + ApiResponse envelope
  engine.registerDatasource(restJsonPlugin)   // generic REST JSON (ApiResponse or raw array)
  engine.registerDatasource(staticPlugin)     // inline Observation[] (Phase 1 / dev / test)

  // Custom node types (Mode B)
  engine.extend(nodeRegistry)
  nodeRegistry.register('landing-page', LandingPageRenderer)

  // Custom DataSpec types
  engine.extendSpec('account-sequence', accountSequenceResolver)

  // Custom transforms (for href DataSpecs)
  engine.registerTransform('fromSDMX', fromSDMX)
}


// ── What this replaces ────────────────────────────────────────────────────────
//
// ❌ Anti-pattern: loading state in React
//
//   function App() {
//     const [data, setData] = useState(null)
//     useEffect(() => { fetchSiteManifest().then(m => buildStoreManifest(m.datasources).then(s => setData({m,s}))) }, [])
//     if (!data) return <Spinner />   ← null check everywhere
//     return <SiteProvider stores={data.stores} ...>
//   }
//
// Problems:
//   - null check propagates: SiteProvider, hooks, renderers all need guards
//   - Two renders minimum: null → data
//   - useEffect fires after paint: flash of empty state
//   - Harder to test: async state in root component
//
// ✅ Pattern: top-level await (this file)
//
//   manifest + stores are ready before React renders.
//   No null. No loading state. No two-render cycle. No guards.


// ── index.html native loading ─────────────────────────────────────────────────
//
// While fetchSiteManifest() + buildStoreManifest() await, #root is empty.
// Optionally show a native spinner in index.html that React removes on mount:
//
//   <div id="root">
//     <div class="app-loading">
//       <div class="app-loading__spinner"></div>
//     </div>
//   </div>
//
// ReactDOM.createRoot().render() overwrites #root content.
// Spinner is gone the moment React mounts — no extra code needed.


// ── Phase 2 — same file, zero changes ────────────────────────────────────────
//
// Phase 1 (static):
//   fetchSiteManifest() → { datasources: DATASOURCE_CONFIGS, pages: PAGES, nav: NAV }
//   buildStoreManifest(DATASOURCE_CONFIGS) → all static plugin → instant (Promise.resolve)
//
// Phase 2 (Constructor API):
//   fetchSiteManifest() → fetch('/api/site') → { datasources:[…], pages, nav, tokens, chrome }
//   buildStoreManifest(manifest.datasources) → mixed Tier 1/2/3 → sdmx-api plugin
//   Suspense handles lazy data loading per page.
//   main.tsx: ZERO CHANGES between Phase 1 and Phase 2.
//
// Layer switch: in fetchSiteManifest() — one line. main.tsx never changes.
```
