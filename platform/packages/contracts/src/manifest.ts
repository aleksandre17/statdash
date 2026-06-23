// ── SiteManifest wire contract (GET /api/bootstrap) ───────────────────────────
//
//  The atomic boot payload the geostat runner fetches ONCE to hydrate the whole
//  site (Grafana bootData / Retool fetchAppManifest pattern). Produced by the api
//  (apps/api/src/routes/bootstrap), consumed by the runner (apps/geostat/src/data/
//  site-manifest.ts). BOTH sides previously re-declared this shape because the api
//  cannot import `@statdash/react`. This is the shared home.
//
//  LAYERING of the fields (why some are precise, some opaque):
//    - Backend/engine-owned JSON DTOs (modes, datasources) are JSON-serializable and
//      tenant-agnostic, so they are typed precisely here. They are STRUCTURALLY
//      identical to engine's ModeDef / DatasourceInstanceConfig (the engine remains
//      their semantic owner; this is the wire mirror, kept assignable both ways so
//      the engine type and the contract interoperate without a cast).
//    - React/renderer-owned blobs (pages, nav, chrome, chromeConfig, i18n) have their
//      INNER shape owned by the renderer (NodePageConfig, NavEntry, ChromeConfig…).
//      The backend is a pass-through projection and must NOT become a second source
//      of truth for the config schema, so those are opaque JSON here. The runner
//      refines them to its precise types via `SiteManifest = SiteManifestContract & {…}`.

import type { JsonRecord } from './json'

/**
 * Rendering mode descriptor (year/range/compare …). Wire mirror of engine ModeDef.
 * JSON-serializable; an open `id` string keeps it Constructor-extensible.
 */
export interface ManifestMode {
  id:       string
  label:    string
  icon?:    string
  dataKey?: string
}

/**
 * Named datasource descriptor. Wire mirror of engine DatasourceInstanceConfig.
 * `kind` is an open string ('external' | 'api' | 'stats' | …); `params` is
 * kind-specific JSON passed to the store builder.
 */
export interface ManifestDatasource {
  id:      string
  kind:    string
  url?:    string
  params?: Record<string, unknown>
}

/**
 * The SiteManifest as it crosses the api ↔ runner boundary.
 *
 * `pages`/`nav`/`chrome`/`chromeConfig`/`i18n` carry renderer-owned blobs typed as
 * opaque JSON — the runner refines them to NodePageConfig / NavEntry / ChromeConfig
 * / I18nConfig. Refine, never weaken: a consumer intersects this with its precise
 * field types; it never re-declares the envelope.
 */
export interface SiteManifestContract {
  /** Manifest envelope version — mirrors page schemaVersion forward-compat (ADR-0026). Optional for back-compat. */
  schemaVersion?: number
  /** The id of the page served at '/' — from site_config.index_page_id. */
  indexPageId:  string
  /** PUBLISHED page configs, keyed by renderer page id. Inner shape = NodePageConfig (renderer-owned). */
  pages:        Record<string, JsonRecord>
  /** Nav tree. Inner shape = NavEntry (renderer-owned). */
  nav:          JsonRecord[]
  /** Chrome slot → variant routing. Inner shape = Record<string, ChromeEntry> (renderer-owned). */
  chrome:       JsonRecord
  /** Brand identity. Inner shape = ChromeConfig (renderer-owned). */
  chromeConfig: JsonRecord
  /** Locale configuration. Inner shape = I18nConfig (renderer-owned). */
  i18n:         JsonRecord
  /** Filter modes registered at boot. */
  modes:        ManifestMode[]
  /** Connected datasource descriptors. */
  datasources?: ManifestDatasource[]
}
