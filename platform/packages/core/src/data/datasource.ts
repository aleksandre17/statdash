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
//  `kind` is an open string — built-in kinds:
//    'external' — ExternalStore built from static observations + classifiers
//    'api'      — MSW-intercepted fetch (dev mock)
//    'stats'    — live stats API (production)
//
//  `params` is kind-specific and fully JSON-serializable.
//  When a new datasource kind is added, params extends without engine changes.
//

/** JSON descriptor for one named data source in the site manifest. */
export interface DatasourceInstanceConfig {
  /** Registry key — the `storeKey` that page nodes reference. */
  id:      string
  /** Datasource kind — open string: 'external' | 'api' | 'stats'. */
  kind:    string
  /** Optional API URL for network-backed kinds ('api', 'stats'). */
  url?:    string
  /** Kind-specific parameters — JSON-serializable; passed to the store builder. */
  params?: Record<string, unknown>
}
