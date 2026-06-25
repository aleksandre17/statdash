// ── Static datasource plugin builder (SHARED — the STATIC source kind) ───────
//
//  Registers the 'static' kind with the engine's store-builder registry.
//  This is the canonical config-level static data source: an author-supplied
//  literal `values` array becomes a zero-network in-memory DataStore.
//
//  Source-kind spectrum (ADR adr_data_source_reference_spectrum, the Vega-Lite
//  `data: { values | url | name }` trichotomy mapped to store KINDS behind the
//  ONE DataStore port):
//    • 'static' — THIS builder. Vega-Lite `values`: inline literal rows, no
//                 backend. The named, reusable, round-trippable home for
//                 config-level static data.
//    • 'href'   — DEFERRED behind door D-HREF (Vega-Lite `url` + `format`).
//                 No consumer today; see the ADR.
//    • 'stats'  — the live cube (Vega-Lite `name`). See stats-registrations.ts.
//
//  Relationship to the OTHER static surfaces (S1 unification note):
//    • This 'static' KIND          = the registered, named, manifest-tier static
//                                    source addressable by a node's storeKey.
//                                    ← the canonical config-level static source.
//    • DataSpec `transform.source` / `pivot.rows`
//                                  = node-local inline literal rows consumed
//                                    directly by TransformResolver — needs NO
//                                    store at all. The bounded node-level
//                                    exception (Adaptive-Cards `$data`). KEPT.
//    • engine `staticStore`        = the empty Null Object fallback that
//                                    resolveStore returns when no store matches.
//                                    Returns [] for everything — NOT this kind.
//    • selector `StaticSource`/`InlineSource` (data/source.ts)
//                                  = the filter-options descriptor shape (dropdown
//                                    items), a different layer from store kinds.
//
//  Descriptor shape expected by the builder (100% JSON-serializable — Law 2;
//  NO functions, NO url, NO fetch — `static` data is literal values only):
//    { id: 'demo', kind: 'static',
//      params: { values: EngineRow[], classifiers?: …, display?: …, nonTimeDims?: string[] } }
//
//  Arrow (Law 3): imports only @statdash/react/engine (registerStoreBuilder)
//  and @statdash/engine (ExternalStore) — both below apps. Same shape as the
//  'stats' builder; neither app imports the other.
//

import { registerStoreBuilder } from '@statdash/react/engine'
import type { Classifier, DisplayMap, Observation } from '@statdash/engine'

/** Kind-specific params for a 'static' datasource descriptor. */
interface StaticParams {
  /** Inline literal observation rows — the Vega-Lite `values` payload. */
  values?:      Observation[]
  /** Inline classifiers for `$cl`/`$d` resolution + filter dropdowns (Tier-1, instant). */
  classifiers?: Record<string, Classifier>
  /** Inline display maps for label resolution. */
  display?:     Record<string, DisplayMap>
}

/**
 * Register the 'static' store-builder. Called from registerStoreBuilders()
 * (alongside 'stats') so BOTH the geostat runner and the panel Constructor get
 * it via their existing single registration call. Idempotent — the registry is
 * a Map keyed by kind, so a second call overwrites with the identical builder.
 */
export function registerStaticStoreBuilder(): void {
  registerStoreBuilder('static', async (config) => {
    const params = (config.params ?? {}) as StaticParams
    const { ExternalStore } = await import('@statdash/engine')
    return new ExternalStore(params.values ?? [], {
      classifiers: params.classifiers,
      display:     params.display,
    })
  })
}
