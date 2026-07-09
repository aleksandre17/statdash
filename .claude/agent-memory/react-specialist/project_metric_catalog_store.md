---
name: metric-catalog-store
description: AR-49 M0 panel semantic-catalog seam — metricCatalog.store + useMetricCatalog + semanticCatalogOptions, the governed peer of cubeProfile/cubeEnumOptions
metadata:
  type: project
---

AR-49 M0 (SPEC-authoring-reconception-M0.md) item 7: the panel's governed metric/dimension
catalog seam, in `platform/apps/panel/src/discovery/`, mirroring the raw-cube seam next to it.

- `semanticCatalogOptions.ts` — PURE leaf (no store/network/React). `metricOptions(Record<id,MetricDef>, locale)` → `CubeOption[]` (label = governed label + " · unit" hint); `dimensionOptions(Record<id,CatalogDimension>, locale)` → `CubeOption[]`; `readCatalogLabel` (LocaleString string|record branch, active→en→any→fallback); `isSemanticSource`/`SEMANTIC_SOURCES` = 'metrics'|'dimensions'. Option `value` = the REGISTRY ID (metric-id / dimension-id), sorted by id. Reuses `CubeOption` from cubeEnumOptions so the same `<select>` renders both.
- `metricCatalog.store.ts` — zustand store, `CatalogEntry = idle|ready|error` (mirrors ProfileEntry; no true 'loading' since describeApp() is a synchronous registry read). `load()` idempotent (no-op once ready), `invalidate()` → idle for re-read.
- `useMetricCatalog.ts` — hook, `useEffect(load)` once; returns CatalogEntry. Item 8's EnumRefField semantic branch gates `status !== 'ready'` then feeds catalog.metrics/.dimensions to the resolvers — same contract as useActiveProfile.

**Why:** the semantic-layer peer of cubeProfile.store/cubeEnumOptions/useActiveProfile. Cube seam surfaces raw SDMX codes; this surfaces governed nouns from `describeApp().metrics/.dimensions`.
**How to apply:** item 8 (EnumRefField) and item 9 (MetricPalette) consume `useMetricCatalog()` + these resolvers. Do NOT re-implement label/option logic there.

Merge-state caveats when this was built (2026-07-09): item 1 (contracts `ManifestMetric`/`ManifestDimension`, SiteManifestContract.metrics?/dimensions?) HAD landed. Item 2 (core `DimensionDef`), item 3 (PropFieldSource 'metrics'/'dimensions' tokens), item 5 (`describeApp().dimensions`) had NOT. So: `CatalogDimension` is a panel-local structural mirror of the spec DimensionDef (swap to the engine type once item 5 ships — structurally assignable, no consumer change); dimensions are read DEFENSIVELY via `(manifest as {dimensions?}).dimensions ?? {}`. Metrics ship on AppManifest.metrics today (type-safe). Verify these before assuming — grep `listDimensionDefs`, check AppManifest for `dimensions`.

Related: [[project_async_render_warm_read]] (CachedStore capability transparency), [[feedback_cachedstore_encapsulation]].
