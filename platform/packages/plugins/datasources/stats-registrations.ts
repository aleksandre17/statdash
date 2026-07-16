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
// Base for GET /api/stats/observations. Precedence: explicit config.url →
// VITE_API_STATS_URL → EMPTY (same-origin relative `/api/...`). Empty is the
// canonical default (mirrors the config client lib/api.ts `?? ''`): the browser
// hits its OWN origin's `/api`, which nginx/vite proxies to THAT tier's api
// (`statdash-api` per-network alias) — tier-isolated, no hardcoded host, no CORS.
// A hardcoded `http://localhost:3001` default was an anti-pattern: from any
// non-localhost origin (a deployed tier) it points the browser at the wrong host.
function resolveStatsBase(url: string | undefined): string {
  return url ?? (import.meta.env.VITE_API_STATS_URL ?? '')
}

export function  registerStoreBuilders(): void {
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
    const base        = resolveStatsBase(config.url)
    const datasetCode = (config.params?.datasetCode as string) ?? config.id
    const nonTimeDims = (config.params?.nonTimeDims as string[]) ?? []

    // classifierDims = the AUTHORITATIVE set of classifiers to LOAD for the store's
    // $cl (structural join) and $d (display lookup) refs. This is a SUPERSET of
    // nonTimeDims: a chart may join an AUXILIARY classifier that is NOT a wire-filter
    // dimension. The accounts SNA charts join { $cl:'aggregates' } / { $d:'aggregates' }
    // — a classifier keyed by MEASURE code carrying isClosing + label/color — yet
    // `aggregates` is not an observations-query dimension (the wire dims are measure /
    // account / side). Loading classifiers from nonTimeDims ONLY left classifiers
    // .aggregates absent, so the join injected no isClosing/label/color → the hero
    // diverging chart rendered bars with no labels and the per-account panels lost
    // their closing-balance markers. Load from classifierDims when present; fall back
    // to nonTimeDims (byte-identical to the pre-fix behaviour) when it is absent.
    // INVARIANT: classifierDims ⊇ nonTimeDims — we union them so a wire dim is never
    // dropped from the classifier set even if a config omits it from classifierDims.
    const declaredClassifierDims = (config.params?.classifierDims as string[] | undefined)
    const classifierDims = Array.from(
      new Set([...(declaredClassifierDims ?? nonTimeDims), ...nonTimeDims]),
    )

    const [{ fetchDimClassifiers, fromStatsObsRow, fetchDatasetMeta, fetchCubeProfile }, { buildDisplayOverlay }, { ApiStore, CachedStore, TIME_DIM, withMetricProvenance, listMetrics, constrainClassifier }] =
      await Promise.all([
        import('./stats-api'),
        import('./stats-display'),
        import('@statdash/engine'),
      ])

    // Build-time classifier load — small, needed immediately (dim resolution +
    // filter dropdown options). NOT moved to the lazy path.
    //
    // Graceful degradation (mirrors the fetchCubeProfile/fetchDatasetMeta `.catch`
    // below): a per-dim `.catch(() => [])` so ONE missing/failed classifier endpoint
    // (e.g. an auxiliary `aggregates` not yet seeded in some environment) degrades to
    // an empty classifier — the $cl/$d join then injects nothing for that ref — rather
    // than rejecting the whole Promise.all and breaking EVERY chart on the page. The
    // wire-filter dims (nonTimeDims) are normally present; an empty fallback there
    // simply disables rollup/label for that dim, never a crash.
    const classifierArrays = await Promise.all(
      classifierDims.map((dim) =>
        fetchDimClassifiers(base, dim).catch(() => [] as import('@statdash/engine').Classifier),
      ),
    )
    const classifiers: Record<string, import('@statdash/engine').Classifier> = Object.fromEntries(
      classifierDims.map((dim, i) => [dim, classifierArrays[i]]),
    )

    // ── GAP 5 — DISPLAY overlay (SSOT: the SAME classifier rows) ───────────────
    //  resolveDisplayRef joins each `{ $d:'<dim>' }` ref against this overlay
    //  (id → label/color/order). Build it from the classifier arrays we already
    //  fetched — no second endpoint, no duplication. Keyed by `code` to match the
    //  array-form classifier join. label is carried as a LocaleString {en,ka}
    //  (exceed-the-old i18n); resolved to a concrete string at the React boundary.
    //  $cl (structural) vs $d (display) separation is preserved: resolveDisplayRef
    //  reads label/color ONLY from this overlay, never off the structural entry.
    const display: Record<string, import('@statdash/engine').DisplayMap> = Object.fromEntries(
      classifierDims.map((dim, i) => [dim, buildDisplayOverlay(classifierArrays[i])]),
    )

    // ── Time-range readiness seam (ADR adr_time_range_readiness_seam) ──────────
    //  Fold the dataset's available TIME RANGE into classifiers[<timeDim>] so a
    //  year-select `{from:'options',pick:'last'}` resolves to the REAL latest
    //  period synchronously (the inline {$cl:'time'} ref reads this classifier).
    //
    //  Readiness = THIS awaited fetch (the store-construction promise the manifest
    //  already awaits before any filter renders) — so it can never hang. Graceful
    //  degradation: `.catch(() => undefined)` mirrors the meta read above — a
    //  missing/failed coverage read leaves the time classifier absent, so the year
    //  default falls to the core guards (unbounded "all years"), never a 400.
    //
    //  Law 1: the time-dim KEY is read from the profile's own DSD
    //  (dimensions[].isTime), NOT a hardcoded 'time' — TIME_DIM is only the
    //  documented fallback when the profile is absent/degraded.
    const profile = await fetchCubeProfile(base, datasetCode).catch(() => undefined)
    const timeDimKey = profile?.dimensions?.find((d) => d.isTime)?.code ?? TIME_DIM
    const periods = profile?.timeCoverage?.periods ?? []
    if (periods.length > 0) {
      // PREFER the explicit period list (ascending) so quarterly/gapped series are
      // exact — code IS the value the inline {$cl:'time'} ref + year-select read.
      classifiers[timeDimKey] = periods.map((code) => ({ code }))
    }

    // ── Cube-region scoping of the WIRE-dim classifiers (ADR-0027 / SDMX) ──────
    //  The classifier endpoint is dim-GLOBAL: a dim code is a shared vocabulary
    //  axis, so its codelist may carry members belonging to OTHER datasets'
    //  vocabularies (the live defect: REGIONAL_GVA's sector filter listed 18
    //  members — its own 9+_T PLUS a second, foreign sector vocabulary — so the
    //  multi-select showed every category twice). A store REPRESENTS ONE dataset;
    //  its `$cl`/`$d` views must expose only the members of ITS cube. We scope
    //  each wire dim to the realised member set of the dataset's ACTUAL region
    //  (the same V26 SSOT the timeCoverage fold above already applies to the time
    //  dim — one principle, every axis), keeping hierarchy ancestors so roll-up
    //  edges never dangle.
    //
    //  Guards (fail-open, mirrors every profile read above):
    //    • region unavailable / degraded profile → unscoped classifier;
    //    • a wire dim with NO realised codes (e.g. an empty fresh cube) →
    //      unscoped classifier (never nuke the filter options to []);
    //    • ONLY nonTimeDims are scoped — auxiliary classifiers (classifierDims
    //      beyond the wire dims, e.g. the accounts `aggregates` join) are not
    //      cube axes and carry no region coordinates.
    const combos = profile?.actualRegion?.available ? profile.actualRegion.combinations ?? [] : []
    if (combos.length > 0) {
      const realizedByDim = new Map<string, Set<string>>()
      for (const combo of combos) {
        for (const [dim, code] of Object.entries(combo.dimKey ?? {})) {
          let set = realizedByDim.get(dim)
          if (!set) { set = new Set<string>(); realizedByDim.set(dim, set) }
          set.add(String(code))
        }
      }
      for (const dim of nonTimeDims) {
        const realized = realizedByDim.get(dim)
        if (realized && realized.size > 0 && classifiers[dim]) {
          classifiers[dim] = constrainClassifier(classifiers[dim], realized)
        }
      }
    }

    // P2-3 — dataset-level provenance, read once at build time alongside the
    // classifiers and folded into a MetadataPort (the existing engine seam, not
    // a new one). Resilient/graceful-degradation: a failed meta read must never
    // block store construction — the store still serves data, just without the
    // provenance badge. `provenance()` ignores the per-code arg here because the
    // `preliminary` flag is dataset-wide (any obs_status='P'); a future per-code
    // refinement keeps the same MetadataPort signature.
    const meta = await fetchDatasetMeta(base, datasetCode).catch(() => undefined)
    const datasetPort: import('@statdash/engine').MetadataPort | undefined = meta
      ? {
          provenance: () =>
            meta.preliminary
              ? { status: 'p' as const, vintage: meta.version ?? undefined }
              : undefined,
        }
      : undefined

    // ── Metric provenance decorator (N26 / R1 — Law-9 badge wiring) ────────────
    //  Compose the engine's registry-driven `withMetricProvenance` onto the
    //  dataset MetadataPort so a metric-id-addressed cell surfaces its DELIVERED
    //  unit + methodology to the live badge layer (resolvePreliminary / the
    //  panel-title provenance affordance, which read store.metadata?.provenance).
    //  This is the live consumer the just-delivered semantic layer was missing —
    //  registered MetricDefs (primed at app boot via registerManifestMetrics) had
    //  NO runtime install point; the decorator existed but was called nowhere.
    //
    //  Registry-SOURCED + GENERIC (Law 1): the decorator fills provenance by the
    //  UNDERLYING measure code from the registered MetricDefs — there is NO
    //  hardcoded measure or dimension here; whatever the tenant catalog delivers
    //  is what flows. Composed onto the ApiStore's port BEFORE CachedStore wraps
    //  it (below), so memoized cells carry the same provenance (CachedStore
    //  forwards the MetadataPort transparently — P2-3).
    //
    //  Precedence: `withMetricProvenance` spreads `{ ...metricFill, ...runtime }`,
    //  so a dataset/cube-level signal (e.g. preliminary status) WINS over the
    //  metric-level default — the metric only FILLS unit/methodology the cube
    //  does not already carry.
    //
    //  Postel / no-op: with an EMPTY registry the decorator is a transparent
    //  pass-through (returns the base port's result, undefined when no dataset
    //  port). So we install it only when there is something to surface — a dataset
    //  port OR ≥1 registered metric — leaving the truly-empty case byte-identical
    //  (metadata stays `undefined`, the raw-code status quo).
    const metadata =
      datasetPort || listMetrics().length > 0
        ? withMetricProvenance(datasetPort ?? { provenance: () => undefined })
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
      display,
    )

    return new CachedStore(apiStore)
  })
}
