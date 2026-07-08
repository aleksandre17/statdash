---
name: ar36-pivot-p0
description: AR-36 runtime-pivot P0 — state-bound encoding channels (CtxRef + resolveEncodingRefs); seam location + what P1 is
metadata:
  type: project
---

# AR-36 runtime-pivot — P0 landed (state-bound encoding channels)

Design SSOT: `docs/architecture/proposals/DESIGN-grammar-of-interaction.md` (architect, AR-36). Goal: chart encoding `x=sector,series=geo` ⇄ `x=geo,series=sector` runtime-swappable via state/events (OLAP pivot as a declarative capability), NOT two `visibleWhen` A/B panels.

**P0 (committed, branch `feat/ar36-p0-encoding-refs`, NOT pushed/merged):**
- `EncodingChannel` widened `string | ChannelDef` → `+ CtxScopeRef` (reused the R4 ref-taxonomy `{$ctx}` type from `ref/ref.ts` — did NOT declare a parallel `CtxRef` despite the design naming it, to keep one `{$ctx}` SSOT).
- `resolveEncodingRefs(enc, services)` in `core/data/encoding.ts` — pre-pass lowering `{$ctx:key}` channels → concrete field NAME via the ONE dispatcher `resolveRef` ($ctx→dims, then $ref→vars fallback = design's `dims[k] ?? vars[k]`). Dimension-blind (Law 1). Bare-string enc returns by reference (zero-alloc) → byte-identical.
- Called in react `resolveNodeRows.ts` BEFORE `applyEncoding` at primary + blend sites, threading `{ dims: sectionCtx.dims, vars: ctx.vars }`. NOTE: `applyEncoding` lives in REACT (resolveNodeRows), NOT interpretSpec — the design's "pre-pass in interpretSpec" is conceptual; the real call-site is the react binding layer (the only layer holding dims+vars, Law 3). SectionContext has NO `vars`; `RenderContext.vars` does.
- `channelField/Type/Key` now guard an un-lowered CtxRef → undefined (degrade, never read `.field` off a ref).
- Gate FF-ENCODING-POSTEL: `encoding.postel.fitness.test.ts`.

**What P1 is next (per design §6):** author `_xDim/_seriesDim` vars from the selection via the existing `filter-derive`/expr `op:if` (same mechanism as `_regionSel`), unit-assert the directional truth table (region-sel→x=sector; sector-sel→x=geo; none→x=geo,no-series). Gate FF-PIVOT-AGNOSTIC. P2/P3 fold the two geostat composition panels (`sectors`/`sectors-multi`, ~L3440–3908 in geostat.provisioning.json) — SEQUENCING RISK: a concurrent agent fixes State-A KPI double-count in the same file; land KPI first, P2 on fresh base. P0/P1/P4/P5 are `packages/*` only → no collision.

See [[worktree-vitest-hoisted]] for the test-harness gotcha hit while gating this.
