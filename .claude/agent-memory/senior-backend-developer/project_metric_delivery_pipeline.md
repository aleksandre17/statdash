---
name: metric-delivery-pipeline
description: how the semantic layer (MetricDefs) is delivered manifest→boot→registry; which measure refs are safely migratable; the withMetricProvenance install gap
metadata:
  type: project
---

The metric-delivery pipeline that lights up the engine's semantic layer (registerMetrics
seam) for gdp/accounts/regional pages. Non-obvious decisions future work MUST respect.

**Delivery channel = the existing site_config key/value pattern (NO new table/migration).**
Metrics ride as a `site_config 'metrics'` blob (ManifestMetric[]), authored in
`apps/api/provisioning/geostat.provisioning.json` siteConfig[], persisted by the GENERIC
`upsertSiteConfig` (no loader change). Bootstrap route (`routes/bootstrap/index.ts`)
projects `site_config.metrics → manifest.metrics` (read like `nav`: array, direct, not
via `pick`, omitted when absent). Contract shape `ManifestMetric` lives in
`packages/contracts/src/manifest.ts` (zero-dep wire mirror, refined by core into MetricDef).
Geostat boot: `site-manifest.ts registerManifestMetrics(manifest.metrics)` (converts
ManifestMetric[]→Record<id,MetricDef>, calls registerMetrics) inside `bootstrapSite()`
before render — the datasource-flow mirror.

**CRITICAL — only `query.measure` (DataSpec) is byte-identically migratable to metric-ids.**
The KPI render path (`kpi.ts resolveValue → storeVal(store, spec.measure)`) passes the
measure code STRAIGHT to `querySync` — it is NOT metric-aware; and `interpretKpi`'s
provenance lookup is keyed by the UNDERLYING code. Migrating a KPI value/trend `measure`
to a metric-id would cache-miss (warm uses resolved code, render uses the id) AND kill the
badge. Only `query`-type DataSpec render (`resolveQueryMeasures`), warm
(`extractRequirements` in spec.ts), and `specDataSource` routing resolve metric-ids. So the
migration touched ONLY `node.type==='query' && node.query.measure` (non-wildcard); KPI
value/trend measures, `query.filter.measure` dim-pins (resolved via `resolveFilterForReqs`,
also NOT metric-aware), `'*'` wildcards, and transform `pipe.measure:'value'` field-refs all
stay raw. See [[scd2-classifier-writers]] cube context.

**withMetricProvenance is installed NOWHERE in source** — `DataStore.metadata` is `readonly`
and stores are built in `packages/plugins/datasources` (the 'stats' builder, concurrent
workstream). So metric unit/methodology does NOT yet flow to live Law-9 badges. The catalog
is delivered flow-READY; the actual decorator install belongs in the stats store builder
(compose `withMetricProvenance` onto the ApiStore MetadataPort before CachedStore wraps it).
Reported as a follow-up. FF-METRIC-PROVENANCE-FLOWS (geostat metric-delivery.fitness) locks
the DELIVERY guarantee: delivered governance reaches the seam by underlying code.

**Faithful units (do NOT invent).** SSOT for bilingual unit labels = `V16__unit_measure.sql`
stats.unit_measure seed (GEL_MN={ka:მლნ ლარი,en:Million Georgian Lari}, USD, PERCENT). The
seed `ops/seed-data/geostat/codelists.bundle.json` carries `metadata.unit_measure` per
measure but under a DIFFERENT code scheme (GDP/GDP_PER_CAPITA/GDP_GROWTH) than the canonical
workbooks (`DATA/canonical/*.xlsx` CL_MEASURE: gross-domestic-product-at-current-prices etc.)
— map semantically. The canonical workbooks (the DSD SSOT for config-cube-contract) have NO
unit column. **methodology is NOT in the seed/DSD — omitted, not fabricated.**

**Provisioning JSON is byte-faithful under round-trip.** `JSON.stringify(JSON.parse(raw),null,2)+'\n'`
=== raw (insertion order preserved). Programmatic edits are safe; never re-serialize with
sorted keys (top-level is insertion-ordered). config-cube-contract.fitness CHECK 3 validates
every catalog metric.code ∈ its dataSource's dataset CL_MEASURE; CHECK 2 now resolves
metric-ids on the `measure` dim through the catalog before the existence check.

**CALCULATED-metric delivery (DC-01, congregation completed).** The calc-metric engine
(packages/core metric-calc.ts: resolveMetricValue) + its byte-identical KPI consumer were
proven in core but UNWIRED to prod; now delivered through the SAME manifest channel as plain
metrics. Non-obvious facts:
- `ManifestMetric.code` is now OPTIONAL; a calc metric carries `calc` instead — exactly one of
  code/calc (mirrors MetricDef). Wire shape `ManifestMetricCalc {inputs:{name:{measure,at?}}, expr}`
  in contracts; `expr` is OPAQUE `JsonValue` (contracts ← expr arrow forbids importing `Expr`).
  Refined at boot: `registerManifestMetrics` does `m.calc as unknown as MetricDef['calc']` (the
  expr-opaque→Expr refinement is the runner's job, like the renderer-owned page blobs).
- bootstrap route passes `metrics` verbatim (array, direct) — calc rides along, NO route change.
- config-cube CHECK 3 now resolves CALC metrics: `resolveMeasureCodes` recurses into
  `calc.inputs[].measure` (a calc metric has no own `code`), so its component codes get the same
  DSD existence check. CHECK 1/2's page walk SKIPS a `{type:'metric'}` KPI value (no top-level
  `measure`) — pinning is encoded in the calc inputs' `at`, validated via the metric def, not the
  page. (Calc-input PINNING completeness is NOT yet gated — a considered M-5 follow-up.)
- The real migrated indicator: "Labour share in value added" KPI lives on the **accounts** page
  (storeKey 'accounts', NOT 'regional' despite loose "regional" naming — it pins account/side
  dims that only exist in ACCOUNTS_SEQUENCE). Provisioning metric id `accounts.laborShare`
  (dataSource 'accounts', D1@gen-income/U ÷ B1G@prod/U ×100). KPI value swapped bespoke `share`
  → `{type:'metric', metric:'accounts.laborShare', time:{$ctx:'toYear'}}`.
- BYTE-IDENTICAL lock = core FF-CALC-METRIC-EQUALS-SHARE (freezes the legacy `share` reference,
  proves migrated form renders identical KpiDef + warms identical reqs). Provisioning instance is
  structurally identical to that frozen fixture. Delivery lock = geostat FF-CALC-METRIC-DELIVERED
  (manifest→boot→registry→render). FF-NO-CAPABILITY-WITHOUT-CONSUMER part C stays green (calc
  resolveMeasureRef → component codes).
