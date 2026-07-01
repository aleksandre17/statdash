---
name: perspective-axis-residuals
description: Two P0-blocking residuals for the perspective-axis refactor (scopeOverride.compare + scope.metric inventory) — closure findings + the scope.metric category-mismatch surprise
metadata:
  type: project
---

Perspective-axis refactor (`platform/work/VISION-mode-as-perspective-axis.v3*`) replaces privileged `timeMode` weave with generic `perspective = f(state)` axis. Two residuals were investigated read-only to unblock P0.

**Why:** one-way-door foundational refactor; the architect (Opus) needed both residuals definitively closed before P0 implements.

**How to apply:** when P0/P5 begins, these are the decided closures.

## RESIDUAL 1 — ScopeOverride.compare is DEAD (write-only), neutralize it
- `view.scope` is set by **zero** JSON configs — grep for `"scope":` across all `*.json` returns **no matches**. The N37 compare feature is unreachable from any page.
- `ctx.compareRows`/`ctx.compareLabel` are **written** at `renderNode.ts:341` but **never read** by any shell/component (grep-confirmed). The `scopeOverride.ts:34` comment "Shells read ctx.compareRows" is aspirational — no shell does.
- No test exercises `resolveCompareRows`/`compare`.
- The provisioning `"id":"compare"` at geostat.provisioning.json:4069 is a **TimeModeItem** (mode switcher entry), NOT ScopeOverride.compare — unrelated.
- DECISION: delete the whole compare surface in P6 (already listed in PLAN §P6: `ScopeOverride.timeMode` removal). ADD compare deletion to that list: `ScopeOverride.compare`, `resolveCompareRows` (resolveNodeRows.ts), the renderNode.ts:335-342 block, `RenderContext.compareRows/compareLabel` (context.ts:76-78). D-COMPARE door re-derives from a registered scope-key if ever needed — the "mechanism already ships" is a liability, not an asset.

## RESIDUAL 2 — zero MetricDefs registered in production + a category mismatch
- `registerMetric()` is called **only in test files** — never in any production/provisioning bootstrap. The R1 registry mechanism shipped; **zero MetricDefs exist at runtime**. (seed-units.ts:5 references `apps/geostat/src/data/metrics.ts` which **does not exist** — stale pre-de-tenanting comment.)
- **THE SURPRISE (category mismatch):** the year↔range measurement difference is the KPI `value.type` (`point`↔`cagr`/`share`), NOT the measure. The SAME measure code is read in both perspectives — e.g. `gross-domestic-product-at-current-prices` appears as year-`point` (gdp:1311) AND range-`cagr` (gdp:1384); `GVA` as range-`cagr` AND year-`point` (regional). A `MetricDef` is a **measure** (code+unit+dims), so `scope.metric` cannot carry the point↔cagr difference — that lives in `value.type` (kpi.ts:38 KpiValueSpec union).
- KPI `measure` field ALREADY flows through `resolveMeasureRef` (kpi.ts:256 / extractKpiRequirements) — Postel: raw code today, metric-id when registered. So registering MetricDefs is purely additive/optional, NOT a blocker.
- The 3 pages use raw SDMX measure codes everywhere: B1G/P1/D1/B5G/B6G/B8G/B9 (accounts), gross-domestic-product-at-current-prices/real-gdp-growth-rates/gdp-per-capita-usd (gdp), GVA (regional). All node-local `value.type` computations; none registered as MetricDef.

## Decision delivered to architect
- `scope.metric` is a measure-SWAP seam (when year and range read DIFFERENT measures), NOT the carrier of the point↔cagr computation difference. In the geostat pages year/range read the SAME measure with different `value.type`, so `scope.metric` is mostly a no-op there; the real perspective difference is `when`-gated node partition (year KPIs vs range KPIs) + their node-local `value.type`. This is the LOW-2 "node-local value.type is the single-node override" path — and it is the COMMON case here, not the exception.
- P5 needs NO MetricDef registration to proceed (raw codes pass through). Registration is an optional later cleanup, not a P0/P5 gate.
