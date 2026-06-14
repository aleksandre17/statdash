# site-manifest.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — SiteManifest + App wiring + Multi-site
 *
 * Demonstrates:
 * - SiteManifest: datasources · pages · nav · chrome · tokens (5 concerns)
 * - datasources: DatasourceInstanceConfig[] — JSON-safe (replaces stores: Record<string,DataStore>)
 * - engine.buildStoreManifest() — async, awaits Tier 2, returns Record<string, DataStore>
 * - applyTokens() before createRoot — no FOUC
 * - Dynamic routes from manifest.pages (Constructor adds page → route appears)
 * - Mode B explicit routes (developer-owned)
 * - Multi-site: same plugins/, different manifests (ENstat example)
 * - Phase 2: one-line swap in fetchSiteManifest()
 */

import type { SiteManifest, NavItem, PageConfig }        from '@geostat/react'
import type { DataStore, DatasourceInstanceConfig }       from '@geostat/engine'
import { engine }                                         from '@geostat/engine'
import { SiteProvider, ThemeProvider, applyTokens, useSitePages } from '@geostat/react'
import { BrowserRouter, Routes, Route }                  from 'react-router-dom'
import { PageLoader }                                    from '@geostat/react'
import { GEOSTAT_THEME }                                 from './app/theme'


// ── SiteManifest — full interface ─────────────────────────────────────────────
//
//   datasources: DatasourceInstanceConfig[] — JSON-safe; engine builds stores from these
//   pages:       PageConfig JSON (Phase 1: static files | Phase 2: from DB)
//   nav:         NavItem[] (Phase 1: static | Phase 2: from DB)
//   chrome:      Record<string, string> — slot → key (Constructor writes)
//   tokens:      Record<string, string> — CSS custom properties (Constructor writes)
//
// JSON-serializable fields: datasources · pages · nav · chrome · tokens ✅
// NOT in manifest:          stores — built at bootstrap via engine.buildStoreManifest()
//
// Why datasources, not stores?
//   stores = class instances (DataStore) — NOT JSON-safe. Cannot store in DB.
//   datasources = plain config objects — JSON-safe. Constructor stores in DB.
//   buildStoreManifest() converts datasources → stores at bootstrap time.

// interface SiteManifest {
//   datasources: DatasourceInstanceConfig[]   // JSON-safe — replaces old stores field
//   pages:       Record<string, PageConfig>   // Phase 2: from DB
//   nav:         NavItem[]                    // Phase 2: from DB
//   chrome?:     Record<string, string>       // Constructor writes (slot → key)
//   tokens?:     Record<string, string>       // Constructor writes (CSS custom properties)
// }


// ── src/data/datasources.ts ───────────────────────────────────────────────────
//
// Phase 1: datasource configs in TypeScript (same data as old ExternalStore pattern).
// Phase 2: this entire file is deleted — configs come from GET /api/site response.

import { GDP_FACTS, GDP_CLASSIFIERS, GDP_DISPLAY }               from './data/gdp/raw'
import { ACCOUNTS_FACTS, ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY } from './data/accounts/raw'
import { REGIONAL_FACTS, REGIONAL_CLASSIFIERS, REGIONAL_DISPLAY } from './data/regional/raw'
import { fromGDPFacts, fromAccountsFacts, fromRegionalFacts }     from './data/adapters'

export const DATASOURCE_CONFIGS: DatasourceInstanceConfig[] = [
  {
    id:          'gdp',
    plugin:      'static',
    classifiers: GDP_CLASSIFIERS,       // Tier 1 — top-level, universal field
    display:     GDP_DISPLAY,           // Tier 1 — top-level, universal field
    options:     { observations: fromGDPFacts(GDP_FACTS) },
  },
  {
    id:          'accounts',
    plugin:      'static',
    classifiers: ACCOUNTS_CLASSIFIERS,
    display:     ACCOUNTS_DISPLAY,
    options:     { observations: fromAccountsFacts(ACCOUNTS_FACTS) },
  },
  {
    id:          'regional',
    plugin:      'static',
    classifiers: REGIONAL_CLASSIFIERS,
    display:     REGIONAL_DISPLAY,
    options:     { observations: fromRegionalFacts(REGIONAL_FACTS) },
  },
]
// Phase 2: deleted — Constructor writes DatasourceInstanceConfig to DB.
//   GET /api/site → manifest.datasources = [{ id:'gdp', plugin:'sdmx-api', url:'…' }, …]


// ── src/data/pages.ts ─────────────────────────────────────────────────────────

import { GDP_PAGE }      from '../features/gdp/gdp.config'
import { ACCOUNTS_PAGE } from '../features/accounts/accounts.config'
import { REGIONAL_PAGE } from '../features/regional/regional.config'
import { LANDING_PAGE }  from '../features/landing/landing.config'

export const PAGES: Record<string, PageConfig> = {
  landing:  LANDING_PAGE,
  gdp:      GDP_PAGE,
  accounts: ACCOUNTS_PAGE,
  regional: REGIONAL_PAGE,
}
// Phase 2: entire file deleted — fetchSiteManifest() returns pages from DB


// ── src/data/nav.config.ts ────────────────────────────────────────────────────

export const NAV: NavItem[] = [
  { key: 'landing',  href: '/',         label: 'მთავარი'    },
  { key: 'gdp',      href: '/gdp',      label: 'მშპ'        },
  { key: 'accounts', href: '/accounts', label: 'ანგარიშები' },
  { key: 'regional', href: '/regional', label: 'რეგიონები'  },
]
// Phase 2: deleted — Constructor writes nav to DB, manifest returns it


// ── src/manifest.ts — THE SEAM ────────────────────────────────────────────────
//
// Phase 1 → Phase 2: ONE LINE changes (the return statement).
// Everything else — App.tsx, SiteProvider, routes.tsx — stays exactly the same.

async function fetchSiteManifest(): Promise<SiteManifest> {
  // Phase 1 (now): static TypeScript files — instant, no network
  return {
    datasources: DATASOURCE_CONFIGS,
    pages:       PAGES,
    nav:         NAV,
    chrome: {
      AppHeader:  'default',
      AppSidebar: 'default',
      AppFooter:  'default',
    },
    tokens: {
      '--color-primary':   '#005A9C',
      '--color-accent':    '#E8812A',
      '--color-text':      '#1A1A2E',
      '--color-surface':   '#FFFFFF',
      '--font-base':       "'BPG Arial', Arial, sans-serif",
    },
  }

  // Phase 2 (Constructor live) — this ONE LINE replaces everything above:
  // return fetch('/api/site').then(r => r.json())
}


// ── src/main.tsx — bootstrap sequence ────────────────────────────────────────
//
// Grafana bootData pattern: everything resolved BEFORE React mounts.
// No null checks. No loading state in component tree.

async function bootstrap() {
  // Step 1: register plugin types — datasource formats, node types, transforms
  setupEngine()

  // Step 2: fetch manifest — one HTTP request (Phase 2) or instant (Phase 1)
  const manifest = await fetchSiteManifest()

  // Step 3: tokens BEFORE createRoot — no FOUC
  applyTokens(manifest.tokens ?? {})

  // Step 4: build stores — ASYNC, resolves all Tier 2 structure fetches in parallel
  //   Tier 1 (config.classifiers): sync — zero HTTP
  //   Tier 2 (config.structureUrl): fetched now, parallel via Promise.all
  //   Tier 3 (neither): SuspenseStore { classifiers:{} } — fills on first data load
  //   After await: all Tier 1 + Tier 2 classifiers populated, observations: null
  const stores = await engine.buildStoreManifest(manifest.datasources)

  // Step 5: mount React — stores and classifiers ready, data lazy per page
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App manifest={manifest} stores={stores} />
    </React.StrictMode>
  )
}


// ── src/app/App.tsx ───────────────────────────────────────────────────────────
//
// manifest:  SiteManifest — pages, nav, chrome (JSON — from fetch or static)
// stores:    built separately by buildStoreManifest() — NOT in manifest
//
// Why separate? SiteManifest is JSON-safe (serializable). stores are runtime objects.
// SiteProvider receives both and merges them into context.

export function App({ manifest, stores }: { manifest: SiteManifest; stores: Record<string, DataStore> }) {
  return (
    <ThemeProvider theme={GEOSTAT_THEME}>
      <SiteProvider
        stores={stores}
        pages={manifest.pages}
        nav={manifest.nav}
        chrome={manifest.chrome}
        // tokens NOT passed to SiteProvider — applyTokens() handled at bootstrap
      >
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SiteProvider>
    </ThemeProvider>
  )
}


// ── src/routes.tsx — DYNAMIC from manifest.pages ─────────────────────────────
//
// Mode A routes: auto-generated from manifest.pages
//   Constructor adds a page → manifest.pages gets new entry → route appears
//
// Mode B routes: explicit, developer-owned
//   Constructor NEVER touches these

import { CustomReportPage } from '../app/views/custom-report'

export function AppRoutes() {
  const pages = useSitePages()

  return (
    <Routes>
      {/* Mode A — dynamic from manifest.pages */}
      {Object.entries(pages).map(([id, page]) => (
        <Route
          key={id}
          path={(page as any).path ?? `/${id}`}
          element={<PageLoader pageId={id} />}
        />
      ))}

      {/* Mode B — explicit, no Constructor involvement */}
      <Route path="/custom-report" element={<CustomReportPage />} />
    </Routes>
  )
}


// ── Phase 1 → Phase 2 migration ───────────────────────────────────────────────
//
// Phase 1 (now — TypeScript configs):
//   DATASOURCE_CONFIGS: static array, classifiers imported from TypeScript
//   buildStoreManifest: all Tier 1 — synchronous, zero HTTP
//   Static plugin → SuspenseStore wrapping Promise.resolve(obs)
//
// Phase 1.5 (real API, classifiers still in TypeScript):
//   DATASOURCE_CONFIGS: { plugin:'sdmx-api', url:'https://…', classifiers: GDP_CLASSIFIERS }
//   buildStoreManifest: Tier 1 classifiers, no extra fetch
//   sdmx-api plugin → SuspenseStore: observations lazy via Suspense
//
// Phase 2 (Constructor live — configs from DB):
//   fetchSiteManifest() → fetch('/api/site') — one line change in manifest.ts
//   manifest.datasources: from DB → { plugin:'sdmx-api', url, auth, classifiers(if Tier1) }
//   buildStoreManifest: Tier 1/2/3 per datasource
//   App.tsx, SiteProvider, routes.tsx: ZERO CHANGES
//
// Phase 2+ (multi-tenant):
//   GET /api/site routes per tenant (subdomain or header)
//   Different datasource URLs + tokens per tenant, same plugins/
//   Zero code change


// ── Multi-site — same plugins/, different manifests ──────────────────────────

const ENSTAT_MANIFEST_EXAMPLE: Partial<SiteManifest> = {
  datasources: [
    { id: 'gdp', plugin: 'sdmx-api', url: 'https://data.stat.ee/sdmx/v1/data/GDP_EE', auth: { type: 'bearer', token: '***' } },
  ],
  chrome: { AppHeader: 'compact', AppSidebar: 'hidden', AppFooter: 'minimal' },
  tokens: {
    '--color-primary':   '#003F87',
    '--color-accent':    '#E86A10',
    '--color-text':      '#1A1A2E',
    '--font-base':       "'Arial', sans-serif",
  },
}
// Same plugins registered in setupEngine(). Different instance configs per tenant.
// Constructor writes different records to DB per tenant site. Zero code change.


// ── Hook usage ────────────────────────────────────────────────────────────────

import { useStores, useSiteNav, usePageById } from '@geostat/react'

function FullHeader() {
  const nav = useSiteNav()
  return null
}

function StoreDebug() {
  const stores = useStores()
  const gdp    = stores['gdp']
}

function PageMeta({ pageId }: { pageId: string }) {
  const page = usePageById(pageId)
  if (!page) return null
  return null
}


// ── Phase 2 DB schema ─────────────────────────────────────────────────────────
//
// Table: site_manifests
//   site_id     TEXT PK
//   datasources JSONB   ← DatasourceInstanceConfig[] (replaces old stores metadata)
//   pages       JSONB   ← Record<string, PageConfig>
//   nav         JSONB   ← NavItem[]
//   chrome      JSONB   ← Record<string, string>
//   tokens      JSONB   ← Record<string, string>
//
// Table: datasource_instances (alternative — normalized per datasource)
//   id          TEXT PK
//   site_id     TEXT FK → site_manifests
//   plugin      TEXT
//   url         TEXT
//   auth        JSONB
//   classifiers JSONB
//   display     JSONB
//   options     JSONB
//
// Constructor edits site_manifests per site. Different rows = different sites.
// Same plugins/ binary served to all. Manifest decides everything.

declare const React:      { StrictMode: any; createElement: (...a: unknown[]) => unknown }
declare const ReactDOM:   { createRoot: (el: Element | null) => { render: (n: unknown) => void } }
declare function setupEngine(): void
```
