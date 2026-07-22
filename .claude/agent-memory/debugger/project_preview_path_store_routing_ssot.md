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

**Residual reopened the SAME class (0112/0122 R1 recheck, gdp "expenditure" section,
live on :3013):** `specDataSource(sourceSpec)` is legitimately `undefined` for a
RAW/ungoverned wildcard section query (`measure:'*'`, no bound metric — an authored
section body, not a metric-id). The 336a6d6 fix only added the metric tier; it never
added the CANVAS's other cascade tier — the PAGE's OWN declared store
(`page.storeKey`, `SiteRenderer.tsx:89 stores[page.storeKey ?? firstKey]`,
`renderNode.ts` `effectiveStoreKey`: explicit node storeKey > metric dataSource >
**page storeKey** > default/first-key). `usePipelineSourceRows.ts` threaded NEITHER
tier for the SOURCE store nor for its Tier-3-default `pageStore` (`pageContext.ts`'s
`useActivePageContext`) — both fell straight to `resolveStore({stores})`'s blind
`stores['default'] ?? stores[Object.keys(stores)[0]]`. Live proof: the panel's
`GET /api/config/data-sources` happened to return `[regional, accounts, gdp]`
(session/DB-row-order dependent, NOT page identity), so the gdp page's `storeKey:'gdp'`
expenditure section's workbench preview queried `REGIONAL_GVA` (no `approach` dim →
guaranteed empty) while canvas queried `GDP_ANNUAL` (real data) — two DIFFERENT stores
for the identical spec, confirmed via a Playwright network probe (both requests
captured side by side). **Fix:** thread `page?.meta?.storeKey` as the middle fallback
tier in both `resolveStore` calls (`specDataSource(sourceSpec) ?? pageStoreKey` for the
source read; `pageStoreKey` for the Tier-3 ctx pageStore) — mirrors the engine's own
3-tier cascade exactly. Uncovered a SECOND, silent bug enabling the first: the panel's
`PageMeta` type (`apps/panel/src/types/constructor.ts`) was `Omit<PageConfigBase,
'id'|'path'>`, but `storeKey` lived ONLY on `NodeBase`, not `PageConfigBase` — so even
though `canvasPageAdapter` already round-trips `storeKey` onto `page.meta` at RUNTIME
(it's not in `PAGE_STRUCTURAL_KEYS`), the TYPE couldn't see it — `page.meta?.storeKey`
was a compile error, not just an unwired read. Root fix was adding `storeKey?: string`
to `PageConfigBase` itself (packages/react/src/engine/types/node.ts) — NOT widening
PageMeta to the full `NodePageConfig` union (tried first; broke a keys-exhaustiveness
fitness test by pulling in the whole per-node-type field surface — `data`/`view`/
`dataLinks`/`transforms`/`fieldConfig`/`on`/`visibleToRoles` — none of which belong at
page-meta level). **Any NEW page-level field that also happens to live on `NodeBase`
needs this SAME double-declaration**, or a panel-side "page store" hook silently can't
see it despite the runtime already carrying it.
