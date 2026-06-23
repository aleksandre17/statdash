# 03 — Expand-contract migration path

A **parallel-change / expand-contract** migration. No existing consumer breaks at any commit.

## The adapter: `asyncFromSync()` (new, in `store.ts`)

```ts
/** Derive the async path from a sync store. Micro-task wrap → resolves 'done' immediately.
 *  This is the bridge that lets a store author write ONLY querySync. */
export function asyncFromSync(
  store: Pick<DataStore, 'querySync' | 'caps'>,
  q: StoreQuery,
  ctx: SectionContext,
): Promise<QueryResult> {
  const t0 = now()
  try {
    const data = store.querySync(q, ctx)
    return Promise.resolve({ state: 'done', data, meta: { durationMs: now() - t0, cacheHit: false } })
  } catch (error) {
    return Promise.resolve({ state: 'error', data: [], error: error as Error })
  }
}
```

## Resolution helper (the single entry point async consumers call)

`storeVal`, `storeObs`, `runBatch` (store.ts:90-110) are **renamed to read `querySync`** and stay synchronous — they feed the SSR fast-lane and static paths. Shape unchanged. New async sibling added:

```ts
/** Async row fetch — routes to queryAsync if present, else wraps querySync. */
export function storeQueryAsync(store: DataStore, q: StoreQuery, ctx: SectionContext): Promise<QueryResult> {
  return store.queryAsync ? store.queryAsync(q, ctx) : asyncFromSync(store, q, ctx)
}
```

## Per-store migration (mechanical)

| Store | Change | Effort |
|---|---|---|
| **ExternalStore** (store-impl.ts:178) | `query(`→`querySync(`. `caps.sync = true`. No `queryAsync` (engine wraps via `asyncFromSync`). | rename only |
| **CachedStore** (store-impl.ts:111) | `query(`→`querySync(`. `caps.sync = true`. Optionally add `queryAsync` delegating to source's for async cache-aside (N34b stretch). | rename only |
| **ApiStore** (store-impl.ts:23) | `query(`→`querySync(` (reads cache). Add real `queryAsync` doing `await fetch` → `{state:'done', data, meta:{cacheHit, source}}`. See §6 note on `caps.sync` for fresh-vs-warm. Its existing `prefetch()` already proves the pattern. | rename + new method |
| **staticStore** (store.ts:127) | `query()`→`querySync()`. `caps.sync = true`. | rename only |

## The central architectural decision

**`interpretSpec` is NOT made async.** It remains the pure synchronous interpreter over `querySync`. Making it async would force every SSR target and every resolver to thread promises — a Big-Ball-of-Mud change. Instead, async lives in a thin React resolution layer (`useNodeRows`, see `04-rendercontext.md`) that (a) on first paint calls the sync path when `caps.sync`, and (b) drives `queryAsync` for refresh/network/polling.

Because `resolveNodeRows` and the SSR walkers call `interpretSpec`, and `interpretSpec` calls `store.querySync` internally (after rename), the contract step that actually unblocks async is in the **React layer**, not the core sync path. **interpretSpec is the synchronous core; async is a React-layer concern.**
