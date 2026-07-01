---
name: semantic-layer-n26
description: Phase 10.1 MetricRegistry design — why metrics are a second registry axis, by→encoding.series not query, provenance via MetadataPort decorator
metadata:
  type: project
---

Phase 10.1 [N26] adds a Semantic Layer: a `{ type: 'metric' }` DataSpec backed by a `MetricRegistry` (`registerMetric`/`getMetric`/`listMetrics` in `platform/engine/core/src/data/metric.ts`).

**Why (load-bearing design decisions, non-obvious):**
- Metrics are a SECOND registry axis, NOT methods on `EngineRegistry`. `EngineRegistry` is scoped to `SpecResolver`s (ISP); metric registry is a module-singleton Map like FORMATTERS / transform-op registry. Putting `registerMetric` on `defaultRegistry` = ISP violation.
- `metric.ts` is a pure leaf: it must NOT import `defaultRegistry` or `interpretSpec`. The `MetricResolver` lives in `registry/resolvers.ts` (data file owns vocabulary; resolver file owns strategy). A fitness test should assert metric.ts has no registry import.
- `by` maps to `EncodingSpec.series`, NOT to a query `series` field — ObsQuery has no `series`. Grouping is an encoding concern in this codebase.
- `MetricResolver` delegates via `defaultRegistry.spec('query')!.resolve(...)` (same no-circular-import trick as `ByModeResolver`). It does NOT apply encoding — QueryResolver returns raw rows; encoding executes at the renderer boundary.
- Provenance: methodology flows through the EXISTING `MetadataPort` seam (keyed by measure code = metric.code), merged via a `withMetricProvenance` decorator the app layer installs. Store runtime fields (status/vintage) win; metric supplies methodology gap-fill. Rejected: row-field annotation (bypasses seam, shotgun surgery) and dynamic port patching (impure resolver).

**How to apply:** when extending the semantic layer, keep MetricDef thin (no filters/joins/sql — that's the LookML line we refuse). New metric = `registerMetric()` call, zero engine change (OCP). Real paths are `platform/engine/core/src/...` not `packages/engine/...`. New variant must also be added to extractRequirements, _specTag, SPEC_CATALOG, validateDataSpec (needs a new `UNKNOWN_METRIC_REF` code in validation/types.ts ValidationCode union), and BOTH the data/index.ts and root index.ts barrels.

**Module-singleton precedent:** the registry Map style to mirror is `data/transform/step-registry.ts` (`const _registry = new Map`, `registerTransformStep`/`getTransformStep`/`listTransformOps`), NOT a flat file — same shape for registerMetric/getMetric/listMetrics. The `withMetricProvenance(base: MetadataPort)` decorator lives IN metric.ts (leaf-safe: imports only MetadataPort + SectionContext types) and is INSTALLED by the app/store bootstrap, never wired by the engine. Spread order is `{ ...metricFill, ...runtime }` so runtime store fields win. ObsQuery dimension-filter field is `filter` (sdmx.ts) — MetricDef.dims is typed `ObsQuery['filter']`.
