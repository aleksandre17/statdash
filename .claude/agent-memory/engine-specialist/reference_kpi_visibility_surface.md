---
name: kpi-visibility-surface
description: kpiVisible evaluates `when` against filterParams (NOT ctx.dims) — the SAME fr surface renderNode uses; threaded via interpretKpis/extractKpiRequirements
metadata:
  type: reference
---

`kpiVisible(spec, ctx, filterParams)` (core/data/kpi.ts) — the ONE shared KPI-card visibility predicate called at BOTH the render site (`interpretKpis`) and warm site (`extractKpiRequirements`) — evaluates `spec.when` (a VisibilityExpr) with `evalVisibility(when, filterParams, ctx.perspectiveState)`. The `fr` arg is **filterParams**, the SAME raw-URL-param Record `renderNode` passes for a node's `view.visibleWhen` (`evalVisibility(expr, ctx.filterParams, ctx.sectionCtx.perspectiveState)`) — NOT `ctx.dims`. This keeps the visibility SSOT uniform: an `eq`/`isset`/`in` `when` resolves identically on a card and a node. (Before: kpi read `ctx.dims`, a latent divergence — today's `when` are all param-less `perspective-is`, which ignore `fr`, so it was moot.)

**Threading:** `interpretKpis(specs, ctx, store, filterParams = {})` and `extractKpiRequirements(specs, ctx, filterParams = {})` take filterParams as an optional trailing param (additive; default `{}` keeps existing perspective-only callers/tests green). `useKpiRows` (react) passes `ctx.filterParams` to BOTH sites — same value ⇒ warm===render preserved.

**Stability dependency:** SiteRenderer now MEMOIZES `ctx.filterParams` (`useMemo(() => ({...mergedFilterParams, ...vars}), [mergedFilterParams, vars])`) — previously a fresh object built inline in baseCtx each render. Required so useKpiRows' memos (which now key on filterParams) don't thrash. Any future consumer keying on `ctx.filterParams` benefits.

Agreement is pinned in `perspective-p52.fitness.test.ts` (describe "kpi `when` agrees with renderNode visibility") — an eq-card with conflicting dims vs filterParams proves it reads filterParams, and asserts `interpretKpis` visibility === the literal `evalVisibility(expr, fp, ps)` renderNode call.
