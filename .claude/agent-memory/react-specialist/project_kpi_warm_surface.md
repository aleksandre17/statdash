---
name: kpi-warm-surface
description: The kpi-strip is a SECOND async-warm surface (interpretKpis, not useNodeRows/extractRequirements) — useKpiRows + extractKpiRequirements warm it, incl. the yoy year-1 period.
metadata:
  type: project
---

The kpi-strip is a SEPARATE store-read surface from the DataSpec pipeline, and it has its OWN warm path now. This extends [[async-render-warm-read]] (which only covered the DataSpec/useNodeRows surface).

**Why the kpi-strip crashed cold even after the useNodeRows async fix:** KpiStripShell does NOT consume `ctx.rows`/`useNodeRows`. It calls `interpretKpis(specs, ctx, store)` directly → `interpretKpi` → `resolveValue`/`resolveTrend` → synchronous `storeVal` reads. `extractRequirements` (DataSpec) has zero knowledge of `KpiSpec`, so the useNodeRows warm never warmed ANY KPI slice. Against an async (caps.sync=false) store every KPI `storeVal` cold-throws. The visible crash was a `yoy` KPI reading `atTime(year)` AND `atTime(year-1)` — the year-1 (prev-period) read.

**The fix (two layers, mirrors the DataSpec seam):**
1. core `extractKpiRequirements(specs, ctx)` in `data/kpi.ts` (exported from engine index) — the SSOT static-analysis sibling of `extractRequirements`. Yields every `{code,dims}` interpretKpis will read, mode-filtered identically, INCLUDING year-1 for yoy (value AND trend), from+to for cagr, num+denom for share, every code for expr. resolveMeasureRef + atTime + withFilter mirror the read exactly.
2. react `useKpiRows(specs, ctx)` in `engine/useKpiRows.ts` (exported from react/engine) — the KPI sibling of useNodeRows: sync store → memoized interpretKpis inline (byte-identical); async store → warm every req (val+obs, bound queryAsync) → suspend via React.use() on a module-level promise cache → interpretKpis reads warm. KpiStripShell now calls `useKpiRows(def.items, ctx)` instead of interpretKpis directly.

**In-flight dedup (CachedStore.queryAsync):** added a `_inflight` Map keyed by obsCacheKey (obs) / JSON(q,dims) (val/etc). Concurrent identical queryAsync (StrictMode double-invoke, two warm consumers naming the same slice) share ONE promise; cleared on settle (`.finally`) so a real re-fetch is never locked out and rejections still propagate. Makes the repeated-request / ERR_ABORTED StrictMode churn benign — and benefits useNodeRows' warm too.

**How to apply:** "Failed to load component" on a kpi-strip (or any NON-DataSpec panel that reads the store directly) against an async store ⇒ it needs its OWN warm surface; extractRequirements/useNodeRows will NOT cover it. The formatter quirk that bit the test: `fmtNum` strips ALL trailing zeros even with no decimal point — `mln_gel(110)` → "11", not "110". Use non-trailing-zero test values.
