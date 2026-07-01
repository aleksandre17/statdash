---
name: calc-metric-seam
description: MetricDef.calc = declarative measure-algebra (DC-01); resolveMetricValue/calcMetricRequirements (data/metric-calc.ts) evaluate it via expr; consumed by KpiValueSpec 'metric' variant
metadata:
  type: reference
---

DC-01 calculated/derived metrics — measure-algebra in the semantic layer, the X-2
congregation that gives `MetricDef` a reason to be registered.

**Model (`data/metric.ts`):** `MetricDef.code` is now OPTIONAL; a calc metric carries
`calc?: MetricCalc` instead. `MetricCalc = { inputs: Record<name, MetricInput>, expr: Expr }`.
`MetricInput = { measure: string; at?: Partial<Record<dim,DimVal>> }` — a component
measure read at a GENERIC coordinate (Law 1, never time-special). Law 2: `expr` is an
`@statdash/expr` tree (REUSED, no second dialect — `mul(div($num,$denom),100)` for a ratio).
`resolveMeasureRef(calcId).codes` expands to the COMPONENTS' codes (recursive) so warming /
store-routing a calc metric warms its inputs, and FF-NO-CAPABILITY-WITHOUT-CONSUMER part C
(≥1 code) stays green. `withMetricProvenance` guards `def.code === undefined` (calc has none —
its components carry provenance).

**Evaluation (`data/metric-calc.ts`, NEW file — not bound by metric.ts purity invariant):**
- `resolveMetricValue(ref, ctx, store): number | undefined` — point-reads each input via
  `storeValAt(store, code, input.at, ctx)` (the valAt seam), binds into `ExprScope.derived[name]`,
  evals `calc.expr`. Non-calc ref → `undefined` (caller falls back to raw read). Div-by-zero → 0
  (expr `div`→null, wrapping `mul` coerces null*100→0 — byte-identical to `denom ? n/d : 0`).
- `calcMetricRequirements(ref, ctx): Requirement[]` — the warm SSOT sibling; the exact
  component (code, dims@coord) reads resolveMetricValue issues.
- `isCalculatedMetric(ref)` predicate.
- Coordinate is `input.at` (DimVal scalar), NOT the metric's `dims` (those are FilterValue
  query semantics — a category error to merge into a point coordinate).

**Consumer (`data/kpi.ts`):** new `KpiValueSpec` variant `{ type:'metric', metric, time?, format? }`.
`resolveValue` → `resolveMetricValue` at the pinned period, formats with `fmtKpiPct` when
`format` ABSENT (= `share` parity, NOT a FormatKey — fmtNum strips zeros/adds separators, so a
share→metric migration is byte-identical only with the fmtKpiPct default). `extractKpiRequirements`
→ `calcMetricRequirements`. `primaryMeasure('metric')` → `resolveMeasureRef(metric).codes[0]`.

**Real consumer:** the geostat regional "Labour share in value added" KPI (D1@(gen-income,U) /
B1G@(prod,U) ×100) — today a bespoke `share` KpiValueSpec (provisioning.json ~line 280). Proven
byte-identical via `data/metric-calc.fitness.test.ts` (FF-CALCULATED-METRIC + FF-CALC-METRIC-EQUALS-SHARE
twin: identical KpiDef render AND identical warm set). suite 526.

**ESCALATED (cross-workstream, like Act-1 metric DELIVERY):** PROD wiring of the calc metric
needs `ManifestMetric.calc` (packages/contracts) + apps/geostat `registerManifestMetrics`
refinement + the provisioning.json calc entry + the KPI `share`→`metric` swap — all OUTSIDE the
engine fence (contracts + api provisioning + geostat boot). Capability + consumer are fitness-proven;
only the delivery plumbing is deferred. See [[measure-ref-seam]], [[grain-store-port]] (valAt).

**Constraint (documented, not guarded):** calc metrics are SCALAR — a `query`/`row-list` DataSpec
referencing one would expand to component codes via metric-store `measureRefs` and fetch raw
component rows (wrong). Consume via the point/KPI path only.
