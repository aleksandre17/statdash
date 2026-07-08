---
name: adoption-epic
description: ENG adoption epic (X-2 cathedrals→congregations) — all 4 Acts now DONE; Act 1's cross-workstream metric-delivery escalation was resolved by later AR-40 work
metadata:
  type: project
---

The "engine ADOPTION epic" (X-2: built+wired capabilities with zero prod consumers = Law-4
violation). Four acts, all now landed.

**Why:** owner doctrine — maximal adoption, nothing half-built, every capability has a runtime
consumer OR a named shrinking deferred-list.

**How to apply:** when touching these seams, the consumers below already exist + are
fitness-locked. `no-capability-without-consumer.fitness.test.ts` (Act 3) is the standing guard —
a new capability without a consumer trips it; add to its named deferred-list only if truly
staged, never silently.

- **Act 4 (ENG-16) DONE** — `custom` DataSpec discriminant DELETED wholesale. Single extension
  path = `registerSpec`.
- **Act 2 (ENG-10) DONE** — `scope.metric` WIRED in the perspective-axis parser: an active
  perspective's metric ref resolves through `resolveMeasureRef` and pins `MEASURE_DIM` (named
  SSOT, mirrors how `timeBinding`/`binding` pins `TIME_DIM`). A spec opts in via
  `{$ctx:'measure'}`.
- **Act 3 DONE** — `core/src/no-capability-without-consumer.fitness.test.ts`
  (FF-NO-CAPABILITY-WITHOUT-CONSUMER). 3 families: DataSpec discriminants ⊆ registered
  resolvers; perspective scope-keys ⊆ read in the scope-fold source; registered MetricDefs ⊆
  resolvable via `resolveMeasureRef`. Each family carries a NAMED, empty (=0, shrinking)
  deferred-list — grep the test file for the current allowlist state.
- **Act 1 (ENG-05/06) — RESOLVED, not just landed-in-engine.** At epic-close time the engine
  seams (`registerMetrics(catalog)`, `resolveMeasureRef`, `withMetricProvenance`,
  `specDataSource`) were wired but tenant metric DATA + boot registration were missing — the
  gap was cross-workstream (contracts + api bootstrap + apps/geostat boot) and escalated.
  **Later closed by AR-40 P0** ([[project_ar40_p0_spine]]): `registerManifestMetrics` now runs
  at `apps/geostat` boot from `manifest.metrics`, and a real production KPI
  (`gdp.current`) is registered and consumed. The originally-envisioned full pipeline
  (provisioning `metrics` catalog → `SiteManifestContract` → DB persistence → config-cube
  validation that `metric.code ∈ DSD`) may still be partial — verify current
  `apps/geostat/src/data/site-manifest.ts` `registerManifestMetrics` before assuming full
  parity with the original design.
