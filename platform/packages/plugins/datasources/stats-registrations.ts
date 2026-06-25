// ── Stats datasource plugin builder (SHARED — G3.0 SSOT) ─────────────────────
//
//  Registers the 'stats' kind with the engine's store-builder registry.
//  Call registerStoreBuilders() once at app boot.
//
//  SSOT (G3.0): this builder is shared by BOTH the geostat runner
//  (apps/geostat setupRegistrations) AND the panel Constructor (G3 live-data
//  preview). It lives in @statdash/plugins/datasources — below apps in the
//  dependency arrow — so neither app imports the other (Law 3). The arrow holds
//  for every symbol it pulls in:
//    • registerStoreBuilder  ← @statdash/react/engine   (react, below plugins)
//    • ApiStore / CachedStore ← @statdash/engine          (core,  below plugins)
//    • fetchDimClassifiers / fromStatsObsRow / fetchDatasetMeta ← ./stats-api
//      (co-located tenant-agnostic stats plumbing — the SDMX obs→row mapper +
//       /api/stats HTTP boundary; carries NO tenant content).
//
//  Descriptor shape expected by the builder:
//    { id: 'gdp', kind: 'stats', url: string, params: { datasetCode: string, nonTimeDims: string[] } }
//
//  Hexagonal: dynamic imports keep stats-api + the store impls out of the static/api bundles.
//
//  ADR-STORE-001 — per-query live store (P1-1):
//    The 'stats' kind no longer whole-cube-loads via ExternalStore. It builds an
//    engine ApiStore that issues one GET /api/stats/observations per ObsQuery
//    (Cache-Aside, on-demand) and wraps it in CachedStore for memoization.
//    Classifiers are still fetched at build time — they are small and needed
//    immediately for dim resolution + filter options (only OBSERVATIONS loading
//    moved off the eager path).
//
//    The engine ApiStore is app-agnostic: it takes `fromStatsObsRow` as a DI
//    `mapRow` (raw wire row → engine Observation), so the engine never imports
//    app adapters (Law 3 / dependency arrow).
//

import { registerStoreBuilder, registerStoreCapabilities } from '@statdash/react/engine'
import type { SourceMetadata, SourceTestResult } from '@statdash/engine'
import { registerStaticStoreBuilder } from './static-registrations'
import { registerHrefStoreBuilder } from './href-registrations'

/**
 * Resolve the stats API base for one source config — the SAME precedence the
 * 'stats' builder uses (config.url → VITE_API_STATS_URL → localhost). Shared by
 * the builder + the M2 capabilities so a source's metadata/test hit exactly the
 * endpoint the live store will.
 */
function resolveStatsBase(url: string | undefined): string {
  return url ?? (import.meta.env.VITE_API_STATS_URL ?? 'http://localhost:3001')
}

export function registerStoreBuilders(): void {
  // 'static' source kind — config-level inline literal data (zero network).
  // Registered alongside 'stats' so BOTH apps get it through this one shared
  // call. See static-registrations.ts + adr_data_source_reference_spectrum.
  registerStaticStoreBuilder()

  // 'href' source kind — author-supplied remote url + format (the 3rd mode of
  // the spectrum, D-HREF). Fetch + parse lives in the adapter layer; the engine
  // stays pure. SSRF-safe by default (blocked unless an origin is allowlisted).
  registerHrefStoreBuilder()

  // M2 authoring capabilities for 'stats' — both go over the network (the cube
  // is live). getMetadata = the cube-profile (dims/measures) for datasetCode;
  // testConnection = the dataset resolves (its meta is reachable). These let a
  // non-programmer pick a cube and BROWSE/TEST it before saving the source.
  registerStoreCapabilities('stats', {
    getMetadata: async (config): Promise<SourceMetadata> => {
      const base        = resolveStatsBase(config.url)
      const datasetCode = (config.params?.datasetCode as string) ?? config.id
      const { fetchCubeProfile } = await import('./stats-api')
      const profile = await fetchCubeProfile(base, datasetCode)
      return {
        kind:       'stats',
        dimensions: profile.dimensions.map((d) => ({
          code:  d.code,
          label: d.conceptRole ? `${d.code} (${d.conceptRole})` : d.code,
        })),
        measures:   profile.measures.map((m) => ({
          code:  m.code,
          label: m.label?.['en'] ?? m.label?.['ka'] ?? m.code,
        })),
        note:       `Live cube '${datasetCode}'.`,
      }
    },
    testConnection: async (config): Promise<SourceTestResult> => {
      const base        = resolveStatsBase(config.url)
      const datasetCode = (config.params?.datasetCode as string) ?? config.id
      if (!datasetCode) return { ok: false, message: 'No datasetCode — pick a cube.' }
      const { fetchDatasetMeta } = await import('./stats-api')
      try {
        const meta = await fetchDatasetMeta(base, datasetCode)
        return { ok: true, message: `Resolved cube '${meta.code}'.` }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Dataset did not resolve.' }
      }
    },
  })

  registerStoreBuilder('stats', async (config) => {
    const base        = config.url ?? (import.meta.env.VITE_API_STATS_URL ?? 'http://localhost:3001')
    const datasetCode = (config.params?.datasetCode as string) ?? config.id
    const nonTimeDims = (config.params?.nonTimeDims as string[]) ?? []

    const [{ fetchDimClassifiers, fromStatsObsRow, fetchDatasetMeta }, { ApiStore, CachedStore }] =
      await Promise.all([
        import('./stats-api'),
        import('@statdash/engine'),
      ])

    // Build-time classifier load — small, needed immediately (dim resolution +
    // filter dropdown options). NOT moved to the lazy path.
    const classifierArrays = await Promise.all(
      nonTimeDims.map((dim) => fetchDimClassifiers(base, dim)),
    )
    const classifiers = Object.fromEntries(
      nonTimeDims.map((dim, i) => [dim, classifierArrays[i]]),
    )

    // P2-3 — dataset-level provenance, read once at build time alongside the
    // classifiers and folded into a MetadataPort (the existing engine seam, not
    // a new one). Resilient/graceful-degradation: a failed meta read must never
    // block store construction — the store still serves data, just without the
    // provenance badge. `provenance()` ignores the per-code arg here because the
    // `preliminary` flag is dataset-wide (any obs_status='P'); a future per-code
    // refinement keeps the same MetadataPort signature.
    const meta = await fetchDatasetMeta(base, datasetCode).catch(() => undefined)
    const metadata = meta
      ? {
          provenance: () =>
            meta.preliminary
              ? { status: 'p' as const, vintage: meta.version ?? undefined }
              : undefined,
        }
      : undefined

    // Live, per-query store: fetches exactly the slice each ObsQuery needs.
    // fromStatsObsRow is the DI mapper (raw → engine Observation). CachedStore
    // memoizes resolved queries on top and transparently forwards the MetadataPort.
    const apiStore = new ApiStore(
      base,
      datasetCode,
      nonTimeDims,
      classifiers,
      fromStatsObsRow,
      metadata,
    )

    return new CachedStore(apiStore)
  })
}
