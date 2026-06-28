// ── SiteManifest wire contract (GET /api/bootstrap) ───────────────────────────
//
//  The atomic boot payload the geostat runner fetches ONCE to hydrate the whole
//  site (Grafana bootData / Retool fetchAppManifest pattern). Produced by the api
//  (apps/api/src/routes/bootstrap), consumed by the runner (apps/geostat/src/data/
//  site-manifest.ts). BOTH sides previously re-declared this shape because the api
//  cannot import `@statdash/react`. This is the shared home.
//
//  LAYERING of the fields (why some are precise, some opaque):
//    - Backend/engine-owned JSON DTOs (datasources) are JSON-serializable and
//      tenant-agnostic, so they are typed precisely here. They are STRUCTURALLY
//      identical to engine's DatasourceInstanceConfig (the engine remains
//      their semantic owner; this is the wire mirror, kept assignable both ways so
//      the engine type and the contract interoperate without a cast).
//    - React/renderer-owned blobs (pages, nav, chrome, chromeConfig, i18n) have their
//      INNER shape owned by the renderer (NodePageConfig, NavEntry, ChromeConfig…).
//      The backend is a pass-through projection and must NOT become a second source
//      of truth for the config schema, so those are opaque JSON here. The runner
//      refines them to its precise types via `SiteManifest = SiteManifestContract & {…}`.

import type { JsonRecord } from './json'

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
 * Named metric descriptor — the wire shape of one entry in a tenant's semantic
 * layer (the SAME delivery channel as `datasources`: pure config-data the api
 * projects out of site_config and the runner registers at boot via
 * `registerMetrics`). The runner refines this opaque blob into the engine's
 * `MetricDef` exactly as it refines `datasources` into DatasourceInstanceConfig —
 * the api is a pass-through projection and never owns the engine's semantic shape
 * (Law 3: api cannot import @statdash/engine's MetricDef across the arrow; this
 * zero-dep mirror is the shared home).
 *
 * `id` is the registry KEY (a metric-id a DataSpec references as its `measure`);
 * `code` is the underlying SDMX measure code(s) the store is queried with. A raw
 * code that is NOT a registered id passes through unchanged (Postel /
 * FF-RAW-CODE-IDENTICAL); a registered id additionally carries the governance
 * below. `unit`/`label` are LocaleString maps (Law 4 bilingual). `dataSource` is
 * the storeKey the metric lives in (the Cube.dev `dataSource`-on-measure pattern).
 */
export interface ManifestMetric {
  /** Registry key — the metric-id a DataSpec `measure` references. */
  id:           string
  /** Underlying SDMX measure code(s) the store is actually queried with. */
  code:         string | string[]
  /** Bilingual display label (LocaleString {ka,en}). */
  label:        Record<string, string>
  /** Bilingual unit of measure (LocaleString). Flows to provenance badges + panels. */
  unit?:        Record<string, string>
  /** External methodology page URL — flows into ProvenanceRecord.methodology. */
  methodology?: string
  /** Default dimension filters merged as query DEFAULTS (explicit query filters win). */
  dims?:        Record<string, unknown>
  /** storeKey this metric routes a referencing node to (explicit node storeKey wins). */
  dataSource?:  string
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
  /** Connected datasource descriptors. */
  datasources?: ManifestDatasource[]
  /**
   * The tenant's semantic layer — named metrics the runner registers at boot
   * (`registerMetrics`) so a DataSpec can reference a metric-id instead of a raw
   * code, picking up its unit/methodology (provenance badges) + dataSource
   * routing. Delivered as config-data exactly like `datasources`. Absent/empty ⇒
   * the raw-code status quo (byte-identical, FF-RAW-CODE-IDENTICAL).
   */
  metrics?:     ManifestMetric[]
}
