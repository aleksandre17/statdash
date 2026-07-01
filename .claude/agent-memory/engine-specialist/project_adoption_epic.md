---
name: adoption-epic
description: ENG adoption epic (X-2 cathedrals→congregations) — Acts 2/3/4 LANDED in core; Act 1 metric-DELIVERY escalated (cross-workstream)
metadata:
  type: project
---

The "engine ADOPTION epic" (X-2: built+wired capabilities with zero prod consumers = Law-4 violation). Four acts; three landed in `packages/core`, one escalated.

**Why:** owner doctrine — maximal adoption, nothing half-built, every capability has a runtime consumer OR a named shrinking deferred-list.

**How to apply:** when touching these seams, the consumers below already exist + are fitness-locked.

- **Act 4 (ENG-16) DONE** — `custom` DataSpec discriminant DELETED wholesale (union in data-spec.ts, DATASPEC_DISCRIMINANTS, spec.ts extractRequirements, metric-store.ts measureRefs, validation/pipeline.ts case + ValidationCode `DEPRECATED_CUSTOM_FN`, coverage deferred-list, 3 core tests). Single extension path = `registerSpec`. grep-clean.
- **Act 2 (ENG-10) DONE** — `scope.metric` now WIRED in `scopeCtxByPerspective` (perspective-axis-parser.ts): active perspective's metric ref → `resolveMeasureRef(...).codes[0]` → pinned on `MEASURE_DIM` (named SSOT, like timeBinding pins TIME_DIM). Closes the authored≠wired no-op. Fitness: `config/perspective-metric-swap.fitness.test.ts` (raw-code Postel pin + metric-id expansion + end-to-end interpretSpec swap via filter `{$ctx:'measure'}` + additive identity). A spec opts in by referencing `{$ctx:'measure'}`.
- **Act 3 DONE** — `core/src/no-capability-without-consumer.fitness.test.ts` (FF-NO-CAPABILITY-WITHOUT-CONSUMER). 3 families: DataSpec discriminants ⊆ registered resolvers; perspective scope-keys ⊆ read in scopeCtxByPerspective source; registered MetricDefs ⊆ resolvable via resolveMeasureRef. Each with a NAMED, empty (=0, shrinking) deferred-list.
- **Act 1 (ENG-05/06) PARTIAL — engine seams ALL already wired; tenant DELIVERY escalated.** Added agnostic `registerMetrics(catalog)` bulk seam to data/metric.ts (+ index export + metric-binding test). The consumers already exist+tested: `resolveMeasureRef` (binding), `withMetricProvenance` (provenance), `specDataSource` (store-routing, used in react resolveNodeRows), `describeApp().metrics=listMetricDefs()` (panel picker). MISSING = tenant metric DATA + boot registration. The CORRECT home is config-as-SSOT: a `metrics` catalog in the provisioning manifest → SiteManifestContract field → api bootstrap projection → DB persistence → generic runner boot loops registerMetric/registerMetrics over `manifest.metrics` (exactly like bootRegistrations registers store-builders from manifest.datasources) → config-cube validation that metric.code ∈ DSD. That pipeline crosses contracts + api bootstrap/DB + apps/geostat boot — OUTSIDE engine surfaces, fenced by "don't touch api route-layer", risks colliding with backend workstream. Did NOT author orphan metrics in provisioning.json (would be the very cathedral-without-congregation the epic fights). ESCALATED to architect/orchestrator.

**Verification (all 0):** build:engine, typecheck, tsc -b apps/panel, lint (warnings only), check-laws, engine vitest 478, panel coverage 6, react constructor+resolveNodeRows 27, api provisioning 15. NOT committed (orchestrator gates).
