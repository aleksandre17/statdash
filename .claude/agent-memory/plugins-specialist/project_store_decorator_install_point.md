---
name: store-decorator-install-point
description: Registry-driven MetadataPort decorators (e.g. withMetricProvenance) install in the stats store builder, composed onto ApiStore BEFORE CachedStore wraps it
metadata:
  type: project
---

The live install point for engine MetadataPort decorators is the 'stats' store
builder in `packages/plugins/datasources/stats-registrations.ts` — NOT core, NOT
the app. `withMetricProvenance(basePort)` is composed onto the dataset
MetadataPort and passed to `new ApiStore(...)` BEFORE `new CachedStore(apiStore)`
wraps it, so memoized cells carry provenance (CachedStore forwards `.metadata`
transparently).

**Why:** the semantic-layer delivery (commit 0c86578) primed MetricDefs with
unit/methodology into the engine registry but installed the surfacing decorator
NOWHERE — a Law-4 cathedral-without-a-congregation. The store builder is the one
place every live store is constructed (both geostat runner + Constructor preview,
via `buildStoreManifest`), so it is the correct congregation.

**How to apply:** when a delivered engine capability exposes a `MetadataPort`/
store-seam decorator that is "called nowhere", wire it in the store builder,
registry-sourced + generic (Law 1 — fill by underlying code, no hardcoded
measure/dim). Gate install on `datasetPort || listMetrics().length > 0` so the
truly-empty case stays byte-identical (Postel). Precedence: `withMetricProvenance`
spreads `{ ...metricFill, ...runtime }` — cube/dataset signal WINS, metric only
FILLS. The badge consumer that reads it is `resolvePreliminary`
(`packages/react/src/engine`) via `store.metadata?.provenance(measure, ctx)`.
True end-to-end FF lives at `stats-metric-provenance.fitness.test.ts` (builds the
live store via buildStoreManifest). See [[green_gate_stale_buildinfo]] before
trusting any red from typecheck/build:engine.
