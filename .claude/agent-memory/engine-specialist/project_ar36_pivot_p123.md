---
name: ar36-pivot-p123
description: AR-36 runtime-pivot P1/P2/P3 — the grain judgment call + state-bound aggregate.by/sort seam + chartType ref
metadata:
  type: project
---

# AR-36 runtime-pivot — P1/P2/P3 (regional pivot fold)

Follows [[ar36-pivot-p0]]. Branch `feat/ar36-pivot-regional` (main + P0 `ba52404`). Design SSOT: `platform/work/DESIGN-grammar-of-interaction.md`.

**The grain judgment call (task-flagged "data-fetch-both-dims shape"):** State A (no region sel) = by-region DONUT (one slice/region, GVA); State B (regions sel) = sector×geo STACKED BAR. The design claimed "aggregate by BOTH dims once, only encoding rotates" — but that is FALSE for State A: the chart interpreters (PieInterpreter/BarInterpreter, packages/charts) do NOT aggregate rows sharing a label, so feeding (sector,geo)-grain rows to a donut → N_sector slices per region (wrong). State A genuinely needs a different GRAIN (roll-up over sector). And it can't be driven by the sector filter (State A eq `_T` vs State B `$ne _T` = operator switch, not expressible in one clause) nor by an array var (`ExprVal` is scalar-only `DimVal` — no arrays; `$ne` can't switch by state).

**Decision (conviction):** the OLAP roll-up LEVEL binds to state, exactly like the encoding channels. Single query `sector:{$ne:_T}, geo:{$ctx:geo,$ne:_T}, measure:GVA, time:{$ctx:time}` (leaf sectors × selected-or-all regions, geo naturally adapts). State-bound aggregate `by` via `_byDims` COMMA-STRING var ("geo" A / "sector,geo,time" B — scalar, expr-compatible), lowered react-side. State A sums leaf sectors per region == stored `_T` total (GVA sectors partition GVA → exact; verify via fitness). Retire reading stored `_T`.

**Seams built (all mirror P0's resolveEncodingRefs pattern — Opus-blessed, no re-escalation):**
- `resolvePipeRefs(steps, services)` in `core/data/transform/` — lowers `{$ctx}`/`$ref` in aggregate.by (comma-split→array), sort.by, sort.dir BEFORE applyPipeline. Byte-identical fast path for ref-free steps. Called from react `resolveNodeRows` before resolveBlends. Types widened additively (aggregate.by/sort.by/sort.dir += CtxScopeRef); normalizeAggregate/applySort defensively narrow (Array.isArray / typeof).
- chartType ref (P3): `ChartNode.chartType` += CtxScopeRef; resolved in plugins `useChartOutput` before interpretChart via resolveRef({dims,vars}). `_mark` = "donut" A / "bar" B.
- Empty-series degrade: `_seriesDim=""` → resolveEncodingRefs → series="" → applyEncoding falsy → no series (P0 already handles).

**Vars (page-level, expr `op:if` from `_regionSel`-style cond on `{$ctx:region}`):** `_xDim` (geoLabel A / sectorLabel B), `_seriesDim` ("" A / geoLabel B), `_mark` (donut/bar), `_byDims` (geo / sector,geo,time), `_sortBy` (value / sectorOrder), `_sortDir` (desc / asc).

**Fold:** `sectors`+`sectors-multi` → ONE `sectors` pivot panel. encoding.id="geo" (region code both states; State B collisions harmless — chart keys on label/series, table pivots on label). Chart+table interaction = `filter region fromField id` (region-select A / region-toggle B). context.dims.geo="region", sector default "_T", region default "".

**Flagged residuals (owner live-verify vs img_5):** sector-directional DRILL (click sector→pivot to geo-on-x) NOT wired — that's P4/state-aware FilterAction; delivered directional flow is region-select. Table folded to value+pct (State B loses no-pct fidelity). If leaf-sum ≠ stored _T anywhere, State A donut would differ — asserted by fitness.
