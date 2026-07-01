---
name: measure-ref-seam
description: resolveMeasureRef is the SSOT measure-resolution seam wiring MetricRegistry into the binding path (ADR R1); raw codes pass through byte-identical
metadata:
  type: reference
---

`resolveMeasureRef(ref: string | string[]): ResolvedMeasure` lives in `packages/core/src/data/metric.ts` (pure leaf — reads only the local `_registry` via the same map `getMetric` uses; imports nothing from `registry/`, so the `metric.fitness` purity test still passes).

It is the SINGLE seam (ADR `adr_data_reference_render_vision.md` R1, fault line F-C) that distinguishes a raw SDMX code from a registered metric-id:
- metric-id → expands to MetricDef.code(s) + governance `{ unit, methodology, agg, dims }`. First-metric-wins for scalar governance in arrays.
- unregistered string → passes through as `{ codes: [ref] }`, NO governance, NO dims ⇒ byte-identical (Postel / expand-contract).

**Wiring (binding path):**
- `registry/resolvers.ts` exports `resolveQueryMeasures(query: ObsQuery): ObsQuery` — substitutes codes + merges MetricDef.dims as DEFAULTS (explicit query.filter wins). Returns the SAME object reference when nothing changes (raw-code identity). QueryResolver calls it.
- `resolveCode(code)` (private in resolvers.ts) resolves single-code convenience specs (timeseries/growth/ratio-list/row-list). Multi-code metrics → first code only.
- `extractRequirements` (`data/spec.ts`) resolves through `resolveMeasureRef` so prefetch warms underlying codes.
- The binding path must NEVER call `getMetric` directly (that would be a parallel path) — FF-ONE-RESOLUTION-PATH greps for it.

**Governance to panel (engine is React-free):** flows via the MetadataPort. `withMetricProvenance` (metric.ts) now fills BOTH `methodology` AND `unit` (new optional `unit?: LocaleString` field added to `ProvenanceRecord` in `core/provenance.ts`) by reverse code→metric lookup. Spread order `{...metricFill, ...runtime}` = runtime/cube wins.

**Precedence (documented + tested):** explicit config > metric default > cube default. Dims half = query.filter overrides MetricDef.dims. Provenance half = cube runtime overrides metric fill.

**NOTE:** `ExternalStore._observe` matches on `query.filter` ONLY (not ctx.dims) — a metric dim default with no time filter returns ALL matching years, not just ctx time. `_val` (storeVal) matches ctx.dims instead.

Fitness nets: `packages/core/src/data/metric-binding.fitness.test.ts` (FF-METRIC-FLOWS, FF-ONE-RESOLUTION-PATH, FF-RAW-CODE-IDENTICAL + precedence). `registerMetric` mutates a process-global registry; tests use `metric:`-prefixed ids that can't collide with raw codes.

Deferred (doors named, NOT built): R3 desugar, R2 channel enrich, R4 $-ref unification, R5 timeDimension. Related: [[reference_time_dim_ssot]].
