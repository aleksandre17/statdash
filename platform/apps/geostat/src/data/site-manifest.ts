// ── Site Manifest + Bootstrap ──────────────────────────────────────────
//
//  SiteManifest  — JSON-serializable site config.
//                  Phase 2: exact shape of GET /api/site response.
//
//  SiteBootstrap — runtime shell data (manifest + DataStore instances).
//                  Phase 2 — two lines change in main.tsx:
//                    const manifest = await fetch('/api/site').then(r => r.json())
//                    const stores   = await engine.buildStoreManifest(manifest.datasources)
//                  Everything else stays.
//
//  ── Layer 1: static (VITE_STORE_MODE=static, default) ─────────────────
//  In-memory ExternalStore. No network. Instant. Dev default.
//
//  ── Layer 2: mock API (VITE_STORE_MODE=api) ───────────────────────────
//  MSW intercepts fetch('/api/datasets/*'), returns raw dataset JSON.
//  Simulates real network: latency, loading states, error scenarios.
//  Switch: `npm run dev:api`
//
//  Pattern: Grafana bootData (stores manifest + nav from API on startup),
//           Retool fetchAppManifest (resources + pages in one bootstrap call).
//
import type { DataStore, DatasourceInstanceConfig }          from '@geostat/engine'
import type { NavEntry, I18nConfig, ChromeConfig, ChromeEntry } from '@geostat/react'
import type { NodePageConfig }                               from '@geostat/react/engine'
import { buildStoreManifest }     from '@geostat/react/engine'
import { STORE_MANIFEST }                        from './store-manifest'
import { listPages }                             from './pages/registry'
import { NAV }                                   from './nav.config'
import { CHROME_CONFIG }                         from './chrome-config'
import { GLOBAL_CHROME, I18N_CONFIG }            from './site-config'

// ── SiteManifest — JSON-serializable ──────────────────────────────────

export interface SiteManifest {
  /** Named datasource descriptors — JSON-serializable; Phase 2: engine.buildStoreManifest(datasources) builds stores. */
  datasources?: DatasourceInstanceConfig[]
  /** All page configs — keyed by pageId, drives dynamic routes */
  pages:        Record<string, NodePageConfig>
  /** Sidebar nav entries */
  nav:          NavEntry[]
  /** Chrome slot → variant key or full ChromeEntry (Constructor writes; default = 'default') */
  chrome:       Record<string, ChromeEntry>
  /** Brand identity data injected into chrome shells via useChromeConfig() */
  chromeConfig: ChromeConfig
  /** Locale configuration */
  i18n:         I18nConfig
}

// ── SiteBootstrap — runtime shell data ────────────────────────────────
// Phase 1: both fields built locally (TypeScript imports).
// Phase 2: manifest = JSON from API; stores = engine.buildStoreManifest(manifest.datasources).

export interface SiteBootstrap {
  manifest: SiteManifest
  /** DataStore instances — keyed by storeKey, injected into SiteProvider */
  stores:   Record<string, DataStore>
}

// ── helpers ────────────────────────────────────────────────────────────

function pagesRecord(pages: NodePageConfig[]): Record<string, NodePageConfig> {
  return Object.fromEntries(pages.map(p => [p.id, p]))
}

function buildManifest(): SiteManifest {
  return {
    pages:        pagesRecord(listPages()),
    nav:          NAV,
    chrome:       GLOBAL_CHROME,
    chromeConfig: CHROME_CONFIG,
    i18n:         I18N_CONFIG,
  }
}

// ── Layer 1: static ────────────────────────────────────────────────────

async function fetchStatic(): Promise<SiteBootstrap> {
  await Promise.resolve()   // yield — matches async API contract
  return { manifest: buildManifest(), stores: STORE_MANIFEST }
}

// ── Layer 2: mock API (MSW) ────────────────────────────────────────────

async function fetchApi(): Promise<SiteBootstrap> {
  // Dynamic imports — adapters and ExternalStore load only at the HTTP boundary.
  // In static mode this function never runs, so these chunks are never fetched.
  // Pattern: Hexagonal Architecture — adapter code lives at the port, not in the core.
  const [
    [gdpRaw, accountsRaw, regionalRaw],
    { fromGDPFacts },
    { GDP_CLASSIFIERS, GDP_DISPLAY },
    { fromAccountsFacts, fromSDMX },
    { ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY },
    { fromRegionalFacts },
    { ExternalStore },
  ] = await Promise.all([
    Promise.all([
      fetch('/api/datasets/gdp').then((r) => r.json()),
      fetch('/api/datasets/accounts').then((r) => r.json()),
      fetch('/api/datasets/regional').then((r) => r.json()),
    ]),
    import('./gdp/adapter'),
    import('./gdp/raw'),
    import('./accounts/adapter'),
    import('./accounts/raw'),
    import('./regional/adapter'),
    import('@geostat/engine'),
  ])

  return {
    manifest: buildManifest(),
    stores: {
      gdp: new ExternalStore(
        fromGDPFacts(gdpRaw),
        { classifiers: GDP_CLASSIFIERS, display: GDP_DISPLAY },
      ),
      accounts: new ExternalStore(
        fromAccountsFacts(fromSDMX(accountsRaw, { locales: I18N_CONFIG.locales })),
        { classifiers: ACCOUNTS_CLASSIFIERS, display: ACCOUNTS_DISPLAY },
      ),
      regional: new ExternalStore(fromRegionalFacts(regionalRaw.facts), { classifiers: regionalRaw.classifiers }),
    },
  }
}

// ── Layer 3: real stats API (VITE_STORE_MODE=stats) ──────────────────────
//
//  Fetches live observations + classifiers from the stats API and wraps each
//  dataset in an ExternalStore. Dynamic imports keep the HTTP adapter and
//  ExternalStore out of the static/api bundles (Hexagonal: adapter at the port).
//
//  Graceful degradation: an empty datasets list yields stores = {} — the
//  renderer falls back to staticStore for any unresolved storeKey, no crash.

async function fetchStats(): Promise<SiteBootstrap> {
  const base             = import.meta.env.VITE_API_STATS_URL ?? 'http://localhost:3001'
  const { fetchDatasets } = await import('./stats-api')

  const datasets = await fetchDatasets(base)

  const datasources: DatasourceInstanceConfig[] = datasets.map((ds) => ({
    id:     ds.code,
    kind:   'stats',
    url:    base,
    params: {
      datasetCode: ds.code,
      nonTimeDims: ds.dimensions.filter((d) => !d.is_time_dim).map((d) => d.dim_code),
    },
  }))

  const stores = await buildStoreManifest(datasources)
  return { manifest: buildManifest(), stores }
}

// ── Public entry point ─────────────────────────────────────────────────

export async function bootstrapSite(): Promise<SiteBootstrap> {
  if (import.meta.env.VITE_STORE_MODE === 'stats') return fetchStats()
  if (import.meta.env.VITE_STORE_MODE === 'api')   return fetchApi()
  return fetchStatic()
}