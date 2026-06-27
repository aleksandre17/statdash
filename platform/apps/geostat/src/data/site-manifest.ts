// ── Site Manifest + Bootstrap (PURE GENERIC RUNNER — ADR-0028) ────────────
//
//  SiteManifest  — JSON-serializable site config; the exact shape of the
//                  GET /api/bootstrap response (the api ↔ runner wire contract).
//
//  SiteBootstrap — runtime shell data (manifest + DataStore instances).
//
//  ── The runner carries NO tenant content ─────────────────────────────────
//  ADR-0028 (de-tenanting): all Geostat pages/nav/chrome/data were extracted to
//  provisioning + seed-data and DELETED from here. The PRIMARY path is the live
//  API: GET /api/bootstrap for the manifest, config.data_source rows for stores.
//  When the API is down or unconfigured, the runner FAILS SOFT to emptyManifest()
//  (a brand-free "site unavailable" page) — it always boots to something sane,
//  never crashes (graceful degradation / Principle of Least Astonishment).
//
//  Pattern: Grafana bootData (stores manifest + nav from API on startup),
//           Retool fetchAppManifest (resources + pages in one bootstrap call).
//
import type { SiteManifestContract }                          from '@statdash/contracts'
import type { DataStore, DatasourceInstanceConfig } from '@statdash/engine'
import type { NavEntry, I18nConfig, ChromeConfig, ChromeEntry } from '@statdash/react'
import type { NodePageConfig }                                 from '@statdash/react/engine'

// ── SiteManifest — JSON-serializable ──────────────────────────────────
//
//  The runner's PRECISE view of the @statdash/contracts SiteManifestContract (the
//  shared api ↔ runner wire shape). The contract types the renderer-owned blobs
//  (pages/nav/chrome/chromeConfig/i18n) as opaque JSON because the backend must not
//  own the config schema; HERE — the consumer that DOES own the renderer types — we
//  REFINE those fields to NodePageConfig / NavEntry / ChromeEntry / ChromeConfig /
//  I18nConfig. `datasources` is likewise narrowed to its engine type
//  (structurally identical to the contract's ManifestDatasource).
//  Refine, never re-declare: the envelope is single-sourced; only the blob fields
//  are tightened. Every field stays plain JSON — the same shape serializes from the
//  DB and renders here.

export interface SiteManifest extends Omit<
  SiteManifestContract,
  'pages' | 'nav' | 'chrome' | 'chromeConfig' | 'i18n' | 'datasources'
> {
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
  /** Named datasource descriptors — JSON-serializable; engine.buildStoreManifest(datasources) builds stores. */
  datasources?: DatasourceInstanceConfig[]
}

// ── SiteBootstrap — runtime shell data ────────────────────────────────
//   manifest = JSON from API (or emptyManifest fallback);
//   stores   = engine.buildStoreManifest(config.data_source) (or {} fallback).

export interface SiteBootstrap {
  manifest: SiteManifest
  /** DataStore instances — keyed by storeKey, injected into SiteProvider */
  stores:   Record<string, DataStore>
}

// ── emptyManifest — GENERIC FAIL-SOFT FALLBACK (ADR-0028 D4) ──────────────
//
//  The runner carries no tenant content; but it MUST still boot to something
//  sane when /api/bootstrap is unreachable or the platform is unconfigured
//  (resilience / graceful degradation). This is a tiny, brand-free SiteManifest:
//  a single en-only "site not configured" page, empty nav, neutral chrome, one
//  active locale. It is tenant-AGNOSTIC (Law 1) and astonishment-free — an
//  unconfigured runner SAYS SO, it does not crash. resolveManifest() falls back
//  to this on any API failure.
//
//  The copy is locale-agnostic ('en' only): the fallback must render before any
//  tenant i18n catalog exists, so it cannot depend on a {ka,en} bag.

const OFFLINE_PAGE_ID = '__offline'

/**
 * A minimal NodePageConfig that renders the generic empty state: an inner-page
 * holding a single registered `text` node. Locale-agnostic plain copy ('en'
 * only) — the fallback renders before any tenant i18n catalog exists, so it
 * carries a bare string, never a {ka,en} bag.
 */
function offlinePage(): NodePageConfig {
  return {
    id:       OFFLINE_PAGE_ID,
    type:     'inner-page',
    children: [
      {
        type:    'text',
        format:  'plain',
        content:
          'This dashboard is not configured, or the data service is currently ' +
          'unavailable. Please try again later.',
      },
    ],
  } as NodePageConfig
}

export function emptyManifest(): SiteManifest {
  return {
    pages:        { [OFFLINE_PAGE_ID]: offlinePage() },
    indexPageId:  OFFLINE_PAGE_ID,
    nav:          [],
    chrome:       {},
    chromeConfig: {} as ChromeConfig,
    i18n:         { locales: ['en'], defaultLocale: 'en', fallbackLocale: 'en' },
    datasources:  [],
  }
}

// ── Manifest source: API with fail-soft fallback ──────────────────────────
//
//  fetchBootstrap mirrors fetch-store-manifest.ts: one fetch over the HTTP
//  boundary, fail-fast (throws) so the caller owns the fallback. GET
//  /api/bootstrap returns the SiteManifest superset verbatim (ADR-0026); the
//  app owns its own wire contract — the API never imports app types (Law 3).
//
//  The { data } envelope matches the rest of the API (stats-api.ts getAt);
//  liberal-in-what-we-accept (Postel): a bare manifest (no envelope) is also
//  honored so a future endpoint shape change doesn't hard-break the client.

export async function fetchBootstrap(baseUrl: string): Promise<SiteManifest> {
  const res = await fetch(`${baseUrl}/api/bootstrap`)
  if (!res.ok) throw new Error(`GET /api/bootstrap: ${res.status}`)
  const json = (await res.json()) as { data?: SiteManifest } & Partial<SiteManifest>
  return (json.data ?? (json as SiteManifest))
}

// ── resolveManifest — API with empty-state fallback ───────────────────────
//
//  Fetch the manifest from /api/bootstrap; on ANY failure fall back to the
//  generic emptyManifest() (graceful degradation). The runner is API-first; the
//  empty state is the offline/unconfigured net, NOT tenant content.

async function resolveManifest(): Promise<SiteManifest> {
  // Empty fallback → relative `/api/...` (same-origin). See ADR RC-2 / D1.
  const base = import.meta.env.VITE_API_STATS_URL ?? ''
  try {
    return await fetchBootstrap(base)
  } catch (err) {
    console.warn(
      '[bootstrap] fetchBootstrap failed — falling back to generic empty manifest (offline/unconfigured).',
      err,
    )
    return emptyManifest()
  }
}

// ── Store manifest: live config.data_source rows, empty fallback ──────────
//
//  The store manifest is built from config.data_source rows (the Constructor's
//  persisted datasources) via fetchStoreManifest. config.data_source is the SSOT
//  for "which stores exist" — the Constructor writes it; the dashboard reads it.
//  Dynamic import keeps the HTTP adapter + engine factory out of the entry bundle
//  (Hexagonal: adapter at the port).
//
//  RESILIENCE (graceful degradation): if the data-sources read fails (API down
//  at boot), fall back to NO stores ({}) and log a warning, rather than crash.
//  Paired with emptyManifest, the runner boots its generic empty state.

async function fetchStores(base: string): Promise<Record<string, DataStore>> {
  const { fetchStoreManifest } = await import('./fetch-store-manifest')
  try {
    return await fetchStoreManifest(base)
  } catch (err) {
    console.warn(
      '[bootstrap] fetchStoreManifest failed — no stores (offline/unconfigured).',
      err,
    )
    return {}
  }
}

// ── Public entry point ─────────────────────────────────────────────────
//
//  Manifest + stores resolve independently (each owns its own fail-soft
//  fallback), then compose into the SiteBootstrap App.tsx renders from.

export async function bootstrapSite(): Promise<SiteBootstrap> {
  // Empty fallback → relative `/api/...` (same-origin). See ADR RC-2 / D1.
  const base = import.meta.env.VITE_API_STATS_URL ?? ''
  const [manifest, stores] = await Promise.all([resolveManifest(), fetchStores(base)])
  return { manifest, stores }
}
