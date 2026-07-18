---
name: preview-path-store-routing-ssot
description: A workbench/preview read path that selects its own store must reuse the renderer's specDataSource→resolveStore SSOT, never grab the first store-map entry — else a metric-with-dataSource reads the page's foreign cube (0 rows live, green in every engine fixture)
metadata:
  type: project
---

The canvas NODE routes a node's store through ONE SSOT: `renderNode.ts` step 2 →
`effectiveStoreKey(node)` (explicit `storeKey` > metric `dataSource` via core
`specDataSource` > page `pageStoreKey` > `default`) → sets `ctx.pageStoreKey` →
`resolveStore(ctx)` (map lookup + CachedStore wrap + fallback `key → first →
staticStore`). Any metric that declares `dataSource:'gdp'` reads the gdp cube.

**The trap (card 0082, ADR-047 Wave A, fixed 336a6d6):** the workbench pipeline
preview hook `apps/panel/.../pipeline-preview/usePipelineSourceRows.ts` picked its
store as `stores[Object.keys(stores)[0]]` — the FIRST live-map entry (= the PAGE's
store) — a SECOND, silent store-selection rule that diverged from the renderer. A
governed head Get `gdp.growthYoy` (metric `dataSource:'gdp'`) browsed on a REGIONAL
page then read `REGIONAL_GVA` (a foreign cube) → 0/foreign rows **live**, while every
engine fixture stayed green because fixtures resolve `interpretSpec(spec, ctx, store)`
against the metric's OWN store directly — they never exercise the map-selection step.

**Fix = reuse the renderer's exact path, never re-route:** `resolveStore({ stores,
pageStoreKey: specDataSource(sourceSpec) })`, keyed on the emitted source-only
pipeline spec (`specDataSource` from `@statdash/engine`, `resolveStore` from
`@statdash/react/engine`). Compute the source spec BEFORE the store so the route
derives from the head's declared metric. warm ≡ read by sharing the one `store` var;
byte-identical for a no-`dataSource` head (`specDataSource` → undefined → first-store
fallback inside `resolveStore`).

**Durable lesson:** this is the COMPLEMENT of [[natural-axis-concrete-total]] (there,
routing was fine and the bug was a kept foreign pin). Whenever a NEW read surface
(preview grid, export, lineage view, a hook that isn't `renderNode`) selects a store,
grep for `Object.keys(stores)[0]` / `stores[<first>]` — it MUST go through
`specDataSource → resolveStore`, or it re-opens this class. Guard that lands the gap:
two stores answering the SAME code with DIFFERENT values → assert the read returns the
metric-store's value, never the first/page store's (a routing assertion, not presence).
See also [[async-store-live-render-patterns]] (warm ≡ read on the same resolved store).
