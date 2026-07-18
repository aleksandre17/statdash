---
name: relative-coord-seam
description: ADR-045 relative-coordinate navigation — { $prev: n } MDX Lag over ordered members; the honest first-period edge; obs-scan member enumeration on the live store
metadata:
  type: reference
---

# Relative-coordinate navigation (ADR-045) — `{ $prev: n }`

Time-relative metrics (YoY/QoQ/growth) are GOVERNED calc-metric declarations via a relative token in `MetricInput.at`. Extends the [[reference_calc_metric_seam]] (DC-01).

- **Grammar** (`packages/core/src/data/metric.ts`): `RelativeCoord = { $prev: number }` + `isRelativeCoord`; `MetricInput.at` widened to `Partial<Record<string, DimVal | RelativeCoord>>`. Wire mirror `ManifestMetricInput.at` widened (zero-dep). OCP: `$first`/window are future discriminants (YAGNI-deferred, named in ADR-045).
- **Resolver** (`packages/core/src/data/relative-coord.ts`): `orderedMembers(store, code, dim, ctx)` — ordered member set via an **obs scan** (frees the navigated dim, scopes other ctx dims), ordered by classifier codelist order else numeric/lexical. `navigateRelative(members, current, {$prev:n})` = MDX `Lag`; off-the-edge → `undefined` (never wrap/clamp). `resolveRelativeAt(at, code, ctx, store)` → concrete `at` or `undefined` (off-edge).
- **Honest edge (Law 11):** `resolveMetricValue` now returns `number | null | undefined` — `null` = a calc metric whose relative coord is off-the-edge (first period), distinct from `undefined` (not-a-calc-metric) and a genuine `0`. The KPI `metric` consumer already maps null→`state:'no-data'`. Grain-∅ path (`metric-grain.ts`) also treats null as no-row.
- **Live-viability (the crux):** the async ApiStore has NO `distinct` cap (`queryTypes: ['obs','val']`) — cannot enumerate members via distinct. SOLUTION: `calcMetricRequirements` DROPS a relative-token dim from the warm dims → `useKpiRows` warms it as a time-UNBOUNDED obs slice → `orderedMembers`' obs scan AND the prior-member point-read (`resolveCachedPointRead` superset match) both resolve from that ONE cached slice. Reuses the SAME warmed-obs mechanism `obsAtCoord`/[[cell-honest-state-seam]] relies on. No DataStore/ApiStore change needed.
- **Byte-identity:** token-free calc metrics unchanged — FF-BIND-PARITY 8/8 stays green. `metric-grain`'s `absolutePins` drops tokens (grain-SERIES relative nav is a deferred follow-up; the tuple-vs-token collision needs its own design).
- **Fitness:** `relative-coord.fitness.test.ts` (FF-RELATIVE-COORD/-EDGE-NO-DATA/-GENERIC/-WARM-COVERS).
- **Tenant:** `gdp.growthYoy` + `gdp.perCapitaGrowthYoy` in geostat provisioning (`apps/api/provisioning/geostat.provisioning.json` metrics array), both `non-additive`. Live palette-bind probe: `platform/e2e/probes/probe-0081-relative-metrics.mjs`.
- Standards anchored in ADR: MDX Lag/ParallelPeriod · SDMX TIME_PERIOD · why NOT a dbt/LookML SQL time-spine.
