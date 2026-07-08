---
name: ar40-p0-spine
description: AR-40 P0 semantic-layer spine LANDED — KPI render+preliminary made metric-aware (U1), format added to metric schema, gdp-total KPI migrated to metric-id
metadata:
  type: project
---

AR-40 P0 (semantic/metrics layer spine) LANDED on branch `feat/ar40-p0-spine` (3 commits, all gates green; NOT merged).

**U1 — the latent bug it closed.** THREE paths read a measure ref; only the WARM path
(`extractKpiRequirements`, kpi.ts) resolved through `resolveMeasureRef`. The RENDER path
(`resolveValue`/`resolveTrend`, kpi.ts) AND the preliminary-badge path (`valueIsPreliminary`,
kpi-preliminary.ts — except its `metric` variant) read the raw ref straight via storeVal/storeObs.
So a KPI referencing a metric-id warmed one code but rendered another → cache-miss (0) + dead
preliminary badge. Fix = two new render seams routing through the SAME resolveMeasureRef:
`readMeasure(store,measure,ctx)` (kpi.ts — sums over resolved codes; raw code → itself → byte-identical)
and `refIsPreliminary(store,measure,c)` (kpi-preliminary.ts — `.some(code=>coordIsPreliminary)`).
Multi-code metric → render SUMS (OLAP additive), mirroring warm's per-code enumeration.

**GOTCHA (byte-identity keystone):** KPI store routing does NOT consult `metric.dataSource`.
`useKpiRows` (react) resolves its store from `pageStoreKey` via resolveStore, NOT effectiveStoreKey
(which only applies to DataSpec nodes with `node.data`). So migrating a KPI measure raw→metric-id
never re-routes the store — dataSource is inert for KPIs. Also: KPI reads resolve CODES only, never
merge the metric's governance `dims` (that's a query-DataSpec concept via resolveQueryMeasures); warm
already ignored metric dims, so render matching warm is consistent, not a regression.

**format schema (P0 item 2):** `format?: FormatKey` on MetricDef + ResolvedMeasure (populated in
resolveMeasureRef, first-metric-wins, mirrors unit/methodology/agg) + `ManifestMetric.format?: string`
(contracts — can't import FormatKey across arrow) + registerManifestMetrics delivery (site-manifest.ts,
refines string→FormatKey). NO render consumer wired (KPI point/expr have required explicit format that
wins; mean/metric fall to fmtKpiPct). Its display consumer = the featured slider, deferred to P1.
FormatKey imported into metric.ts from './kpi-spec' (type-only, acyclic, purity-invariant safe).

**Demonstrable slice:** `gdp-total` KPI (provisioning pages[1]/children[3]/items[0]) migrated
value+trend measure `gross-domestic-product-at-current-prices` → metric-id `gdp.current` (already in
siteConfig.metrics, maps to that exact code). Proven byte-identical by FF-RAW-CODE-IDENTICAL (KPI) in
`packages/core/src/data/kpi-raw-code-identical.fitness.test.ts`.

**Gates:** core 668, react+plugins+provisioning 1024, tsc geostat+panel clean, eslint clean, check-laws clean.

**P1-P3 sequencing note for the slider build:** the SSOT spec file the task cited
(`docs/architecture/proposals/SPEC-AR40-semantic-layer-and-featured-slider.md`) does NOT exist in-repo — AR-40 is
only "PROPOSED" in ARCHITECTURE-REGISTRY.md. P0 was implemented from the task brief directly. The
slider (P1) is the first real consumer of `ResolvedMeasure.format` — read it via resolveMeasureRef,
apply consumer-side-format-wins precedence. See [[measure-ref-seam]], [[calc-metric-seam]].
