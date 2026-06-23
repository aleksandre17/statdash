# 08 — Implementation roadmap

## N34a — Define `QueryResult` + `DataStore` rename (no consumer breaks) — **M**
- **Scope:** Add `QueryResult`, `ResultMeta`, `Unsubscribe`, `asyncFromSync`, `storeQueryAsync`. Rename `DataStore.query`→`querySync`, `batchQuery`→`batchQuerySync`; add optional `queryAsync`/`batchQueryAsync`/`subscribe`. Add `StoreCaps.sync`. Rename the three concrete stores + `staticStore`. Update `storeVal`/`storeObs`/`runBatch` to call `querySync`. `interpretSpec` stays synchronous (now calls `querySync` transitively — no signature change).
- **Files:** `engine/core/src/data/store.ts`, `store-impl.ts`, `data/index.ts`. Direct `.query(` call sites: `resolveNodeRows.ts`/`targets/*` call `interpretSpec`/`storeVal`/`extractRequirements` (safe — no rename needed); any remaining direct `store.query(` callers renamed.
- **Tests:** `QueryResult` shape unit; `asyncFromSync` returns `done` for sync data + `error` on throw; every store's `querySync` returns rows identical to old `query`; fitness: grep finds no `DataStore.query(` remaining. SSR snapshot golden unchanged.
- **Rollback:** pure rename + additive — clean git revert; nothing consumed the new types yet.

## N34b — Async store adapter + async warm — **M**
- **Scope:** Real `ApiStore.queryAsync` (await fetch → `QueryResult`); `CachedStore.queryAsync` cache-aside over source async; `asyncFromSync` as default for sync-only stores. Add `warmPageStoreAsync` (async sibling of `warmPageStore`) awaiting `queryAsync`/`prefetch` for collected requirements; sync `renderPageToHTML` untouched.
- **Files:** `engine/core/src/data/store-impl.ts`, `engine/react/src/engine/targets/warm.ts` (add async sibling), targets `index` export.
- **Tests:** `ApiStore.queryAsync` returns `error` envelope on non-2xx (not a throw); `cacheHit` meta true on second call; `warmPageStoreAsync` then sync `renderPageToHTML` hits warm cache; sync store + `warmPageStoreAsync` is a no-op (fitness: identical HTML with/without warm).
- **Rollback:** additive; sync path untouched — reverting N34b leaves N34a intact.

## N34c — `useNodeRows` becomes the async boundary — **L**
- **Scope:** Evolve `useNodeRows` to return `NodeRowsResult`; sync-capable stores resolve synchronously (SSR-parity, no flicker); async stores drive `storeQueryAsync` via a small `useAsyncResource` (React `use()` + per-`specDimKey` promise cache) that suspends into the existing `<Suspense>` and throws hard errors into the existing `NodeErrorBoundary`. Migrate ChartShell + TableShell to consume `useNodeRows` (opt-in) while `ctx.rows` keeps working for unmigrated shells.
- **Files:** `engine/react/src/engine/useNodeRows.ts` (core change), new `useAsyncResource.ts` (promise cache + `use()`), `ChartShell.tsx` + `TableShell.tsx` (opt-in), `useNodeRows.test.ts`. `renderNode.ts` **unchanged** (Suspense/ErrorBoundary already there).
- **Tests:** sync store → `done` on first render, no `loading` flash, identical output; async store → `loading` then `done`; error store → `NodeErrorBoundary` for hard-fail, inline `EmptyState` for soft `{state:'error'}`; `specDimKey` change refetches, unrelated dim change returns cached (preserve N28). Fitness: SSR golden snapshot unchanged after shell migration.
- **Rollback:** `useNodeRows` change isolated; shells revert individually to `ctx.rows`. The promise cache (riskiest) runs **only** when `caps.sync === false`, so Phase-1 (all-sync) is provably unchanged.

## N34d — Polling / streaming subscription — **M**
- **Scope:** Add `DataStore.subscribe` + `pollingSubscribe` helper; `useNodeSubscription` hook; declarative `refresh` config field; wire `caps.streaming` to enable. Last-write-wins drop of superseded results.
- **Files:** `engine/core/src/data/store.ts` (`pollingSubscribe`, `Unsubscribe`), `store-impl.ts` (opt-in `subscribe`), `engine/react/src/engine/useNodeSubscription.ts`, config type for `refresh` (`engine/core/src/config/section.ts` or `view`).
- **Tests:** `pollingSubscribe` emits on interval, `Unsubscribe` clears the timer (fake timers, no leak); transient error keeps subscription alive; superseded `specDimKey` result dropped; `useEffect` cleanup unsubscribes on unmount.
- **Rollback:** fully additive + opt-in (`caps.streaming === false` everywhere today) → zero impact on existing nodes.

## Sequencing
N34a → N34b → N34c are ordered (each depends on the prior). N34d depends only on N34a (async envelope) + N34c (hook pattern). N34a alone is shippable and breaks nothing; the value lands at N34c.
