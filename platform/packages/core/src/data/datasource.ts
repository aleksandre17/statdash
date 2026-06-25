// ── DatasourceInstanceConfig — JSON descriptor for a named datasource ────────
//
//  The JSON-serializable identity of one DataStore instance.
//  Phase 1: field exists in SiteManifest; stores are still built from static imports.
//  Phase 2: buildStoreManifest(manifest.datasources) → Record<string, DataStore>
//           replaces the imperative store construction in site-manifest.ts.
//
//  Design references:
//    Grafana datasource provisioning — id / type / url / jsonData
//    Retool resource manifest       — id / kind / params
//    Cube.dev datasource config     — type / connection string / schema
//
//  `kind` is an open string — the source-mode discriminant (the Vega-Lite
//  `data: { values | url | name }` trichotomy, placed at the store tier).
//  Built-in / planned kinds (ADR adr_data_source_reference_spectrum):
//    'static'  — ExternalStore built from inline literal `params.values`        ← STATIC (Vega-Lite values)
//                + inline `params.classifiers`/`display`. Zero network.
//                REGISTERED — see @statdash/plugins/datasources static-registrations.
//    'href'    — fetch(url) + format-parse → rows                                ← HREF   (Vega-Lite url + format)
//                DEFERRED behind door D-HREF (no consumer today).
//    'stats'   — live stats API (per-query ApiStore + CachedStore)              ← STOREID (Vega-Lite name, the live cube)
//
//  `url` carries the HREF target; `params` is the kind-specific, fully
//  JSON-serializable payload (e.g. `params.values` for 'static'). When a new
//  datasource kind is added, register a builder + extend params — the dispatch
//  (buildStoreManifest) is OCP-open, so no engine resolver edit is needed.
//
//  Legacy note: the kinds 'external' (ExternalStore) and 'api' (mock fetch)
//  predate the spectrum; 'static' is now the canonical inline-data kind and
//  'href' the canonical url-data door.
//

/** JSON descriptor for one named data source in the site manifest. */
export interface DatasourceInstanceConfig {
  /** Registry key — the `storeKey` that page nodes reference. */
  id:      string
  /** Datasource kind — the source-mode discriminant. Open string: 'static' | 'href' | 'stats' | … */
  kind:    string
  /** Optional URL for network-backed kinds ('href', 'stats'). */
  url?:    string
  /** Kind-specific parameters — JSON-serializable; passed to the store builder. */
  params?: Record<string, unknown>
}

// ── SourceMetadata — the introspectable STRUCTURE of one source (M2) ─────────
//
//  The kind-agnostic shape a Constructor BROWSES to know what a source offers:
//  its dimensions + measures. The store-builder registry's optional
//  `getMetadata(config)` capability returns this (see @statdash/react/engine
//  storeManifest). It is the source-tier analogue of the cube-profile bundle
//  (apps/panel cubeApi `CubeProfile`) — but normalized across ALL kinds:
//    • 'stats'  derives it from the live cube-profile (datasetCode → dims/measures).
//    • 'static' derives it PURELY from the inline `params.values` keys (no network).
//  A new kind that implements getMetadata becomes browsable with ZERO UI change
//  (OCP — the Sources panel renders whatever metadata the kind reports).
//
//  JSON-serializable (Law 2): plain code/label records, never functions. Kept
//  deliberately minimal (codes + optional labels) — richer per-kind detail (cube
//  members, units) stays in the kind's own richer profile; this is the COMMON
//  denominator every kind can answer.

/** One dimension a source exposes — a code, with an optional display label. */
export interface SourceMetadataDimension {
  code:   string
  label?: string
}

/** One measure a source exposes — a code, with an optional display label. */
export interface SourceMetadataMeasure {
  code:   string
  label?: string
}

/**
 * The kind-agnostic structural bundle a Constructor browses for a source.
 * `kind` echoes the source's discriminant (provenance); `dimensions`/`measures`
 * are the browsable axes. `note` carries an optional human hint (e.g. how the
 * structure was derived) — never load-bearing, purely informational.
 */
export interface SourceMetadata {
  kind:       string
  dimensions: SourceMetadataDimension[]
  measures:   SourceMetadataMeasure[]
  note?:      string
}

/** Result of a source's optional `testConnection` capability. */
export interface SourceTestResult {
  ok:       boolean
  message?: string
}
