---
name: featured-slider-store-routing
description: The featured-slider (AR-40) reads live values through the KPI seam with PER-ITEM cross-dataset store routing — not a DataSpec node, and not one page store
metadata:
  type: project
---

The landing `featured-slider` spans 3 datasets (accounts/gdp/regional) in one node.
Two non-obvious constraints:

1. **KPI-seam path, NOT a DataSpec node.** Each `FeaturedItemSpec` lowers to a
   `{type:'point'}` KpiSpec and reuses `interpretKpi` (core `featured.ts`). A DataSpec
   node (`node.data`) would pick up `effectiveStoreKey`/dataSource *node* routing — a
   different rule — so `caps` is `['filterable','drill','methodology']`, deliberately
   NOT `'data'` (which means "DataSpec required"). Staying on the KpiSpec path is what
   gives live values + warm/render symmetry + preliminary badges + i18n for free.

2. **Per-item store routing** (the thing useKpiRows does NOT do — it reads one store).
   `core interpretFeatured(items, ctx, resolveStore)` takes a `FeaturedStoreResolver`
   callback; the react `useFeaturedRows` supplies it as
   `resolveStore({ stores: ctx.stores, pageStoreKey: metric.dataSource })` — reusing the
   vetted `resolveStore` (wraps each raw store in the SHARED CachedStore via `_storeCache`,
   incl. async) rather than `resolveStoreByKey` (which does NOT wrap async stores — an
   older/less-complete seam). `extractFeaturedRequirements` returns `{dataSource, req}[]`
   so the async warm hits the exact per-dataset store the sync read will use.
   `ctx.stores` is the GLOBAL map keyed by dataSource id (gdp/accounts/regional), available
   on every page incl. the storeKey-less landing page — so a metric.dataSource resolves fine.

Format-consumer precedence closed the P0 loop: `item.format ?? resolveMeasureRef(id).format
?? fallback` (mirrors `spec.format ?? fmtKpiPct`). metric.unit was display-UNUSED before the
slider (page KPIs set their own unit), so refining the 8 featured metrics' units to compact
bilingual display forms in provisioning had zero regression — the metric IS the SSOT display unit.

Related: [[feedback_merged_vs_defview_label]] (accentStyle/merged reads), [[new-node-registration-checklist]].
