---
name: extractdeps-seam
description: extractDeps (ADR-024 V1) is the config→dependency SSOT the reactive query graph compiles from; NodeDeps bucket contract + the classification rules
metadata:
  type: reference
---

`extractDeps(node, ctx?): NodeDeps` — pure, framework-free static analyzer in `platform/packages/core/src/graph/extractDeps.ts` (exported from core barrel). Computes ONE renderable's TOTAL dependency (edge) set; the SSOT the reactive query graph (V2 `compilePage`) will compile from, and V3's render switch consumes. Generalises specDimKey + varsKey + effectiveStoreKey + the AR-36 ref scanner + locale fold + collectRequirements into one mechanism.

**NodeDeps buckets** (all `ReadonlySet<string>` of KEYS — Law 1, never hardcoded dim names): `dims` · `params` · `vars` · `perspective` · `classifiers` · `stores` · `measures` · `locale`(boolean) · `requirements`(concrete code×dims, only when `ctx.section` given).

**Classification rules that are load-bearing (don't relearn):**
- **Literal filter pins are NOT edges** — `{approach:'PROD'}` adds no dim dep; only a `$ctx`-valued filter does. Exact, not just safe.
- **Encoding/pipe `$ctx` is DUAL-recorded (dims+vars)** — `resolveEncodingRefs`/`resolvePipeRefs` resolve dims-first, vars-fallback; the AR-36 binding is almost always a derived var (`_byDims`/`_xDim`), so recording dims-only would UNDER-fire. Inert edge (no such dim) never fires. Helper: `dualCtx`.
- **The `$ctx` scope split** — in a `vars` expression `$ctx`→**params** (evalVarMap binds scope.dims=filterParams), `$derived`→vars; in the DATA layer `$ctx`→**dims**. Typed scanners (`sweepExprRefs` vs `sweepRefs`) resolve the collision. The generic data-layer sweep is `sweepRefs` (R4 refScope: ctx→dims, param→params, var→vars, dim($cl/$d)→classifiers).
- **Time is STRUCTURAL, not a `$`-ref** — timeseries/growth/row-list/query read TIME_DIM by resolver convention; captured by the typed spec scan (declared by spec `type`, so Law-2 totality holds). This was the reported finding: extraction IS total.
- **Val-specs depend on the WHOLE ambient coordinate (V2.5, Finding A)** — timeseries/growth/row-list/ratio-list resolve each cell as an OLAP point-read (`matchedValues(code, ctx.dims)` iterates every dim), so `deps.dims` = ambient read-set, not just TIME_DIM. Fed by `DepScanCtx.ambientDims` (compilePage threads it from `CompileOptions.ambientDims` ?? `initialState.dims` keys); absent ⇒ TIME_DIM-only V1 fallback. `obs` `query` is EXCLUDED (rows scoped only by `query.filter`). Precise = dims-only, exactly the coordinate the loop reads, never everything.
- **`$d` join is locale-dependent (V2.5, Finding B)** — in `sweepRefs` the dim case sets `acc.locale=true` for a `$d` (display) ref (resolveDisplayRef tags LocaleStrings → boundary-resolved); a `$cl` (structural) ref does NOT (raw entries, never tagged). Keyed on the ref token.
- **Interaction slots (`on`/`actions`/`dataLinks`) are OUT of render-dep scope** — `$row`/`$param` drill-down resolves on click, not render.
- Soft edges (coarse-but-safe in V1, refine in V2): `locale` over-marks any localized display; perspective-carrier detection needs `DepScanCtx.perspectiveIds` for precision.

**FF-EXTRACTDEPS-TOTAL** proves it: inline corpus (`extractDeps.fitness.test.ts`) + real provisioning corpus (`apps/api/src/provisioning/extractDeps-corpus.fitness.test.ts`) — every `$`-ref covered, a planted hidden dep caught. Ground-truth scanner MUST descend into `data`/`transforms` (their `type`/`op` is a discriminant, NOT a child renderable) — else the totality proof passes vacuously. Related: [[reference_time_dim_ssot]], [[reference_measure_ref_seam]].
