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

import { registerStoreBuilder, registerStoreCapabilities } from '@statdash/react/engine'
import type {
  Classifier, DisplayMap, Observation, SourceMetadata, SourceTestResult,
} from '@statdash/engine'

/** Kind-specific params for a 'static' datasource descriptor. */
interface StaticParams {
  /** Inline literal observation rows — the Vega-Lite `values` payload. */
  values?:      Observation[]
  /** Inline classifiers for `$cl`/`$d` resolution + filter dropdowns (Tier-1, instant). */
  classifiers?: Record<string, Classifier>
  /** Inline display maps for label resolution. */
  display?:     Record<string, DisplayMap>
}

// ── Reserved measure-ish keys — the engine's canonical non-dimension columns ──
//  An inline static row mixes DIMENSION columns (geo, sector, …) with the
//  measure/value column + obs metadata. To browse a static source's structure we
//  split the keys: `value` is THE measure; the obs-metadata keys are neither dim
//  nor measure; everything else is a dimension. This is the static analogue of a
//  cube's DSD (dims) + measure list — derived PURELY from the inline rows.
const RESERVED_VALUE_KEYS = new Set(['value', 'obsStatus', 'time'])

/**
 * Derive a SourceMetadata from inline static rows — PURE, zero network. Unions
 * the keys across all rows (rows may be ragged): every non-reserved key is a
 * dimension; `value` (when present) is the single measure. The static source's
 * "structure" the Constructor browses, the same dims/measures shape the live
 * cube reports — so the Sources panel renders both kinds identically (OCP).
 */
export function deriveStaticMetadata(values: Observation[] | undefined): SourceMetadata {
  const dimKeys = new Set<string>()
  let hasValue = false
  for (const row of values ?? []) {
    for (const key of Object.keys(row)) {
      if (key === 'value') { hasValue = true; continue }
      if (RESERVED_VALUE_KEYS.has(key)) continue
      dimKeys.add(key)
    }
  }
  return {
    kind:       'static',
    dimensions: [...dimKeys].map((code) => ({ code })),
    measures:   hasValue ? [{ code: 'value' }] : [],
    note:       `Derived from ${(values ?? []).length} inline row(s).`,
  }
}

/**
 * Validate an inline static source — PURE, zero network. Well-formed = a
 * non-empty array of plain-object rows. Empty / non-array / non-object rows are
 * the author-fixable error cases the Test action surfaces.
 */
export function testStaticSource(values: unknown): SourceTestResult {
  if (!Array.isArray(values)) {
    return { ok: false, message: 'params.values must be an array of rows.' }
  }
  if (values.length === 0) {
    return { ok: false, message: 'No rows — add at least one inline row.' }
  }
  const allObjects = values.every(
    (r) => r !== null && typeof r === 'object' && !Array.isArray(r),
  )
  if (!allObjects) {
    return { ok: false, message: 'Every row must be a JSON object.' }
  }
  return { ok: true, message: `${values.length} row(s) — well-formed.` }
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

  // M2 authoring capabilities — both PURE (no network), as befits inline data.
  // getMetadata = derive dims/measures from the inline rows' keys; testConnection
  // = the rows are present + well-formed. This is what makes a static source
  // browsable + testable in the Constructor BEFORE it is saved.
  registerStoreCapabilities('static', {
    getMetadata: (config) =>
      Promise.resolve(deriveStaticMetadata((config.params as StaticParams | undefined)?.values)),
    testConnection: (config) =>
      Promise.resolve(testStaticSource((config.params as StaticParams | undefined)?.values)),
  })
}
