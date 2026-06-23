# 06 — SSR / snapshot fast-lane

`renderPageToHTML` (html.tsx:138), `renderPageToJSON` (api.ts:119), `warmPageStore` (warm.ts:65) **stay fully synchronous** and keep their exact signatures. They are the synchronous fast-lane and the reason Approach A (`02-datastore.md`) was chosen over Approach C.

## Contract — "this store is sync-capable"
```ts
store.caps?.sync !== false   // absent ⇒ sync (Phase-1 convention — every current store is sync)
```

- **SSR/JSON call `querySync` exclusively** (via `interpretSpec`, which after N34a calls `querySync`). They never touch `queryAsync`. Output is byte-identical to today.
- **For an async-only store** (`caps.sync === false`, e.g. a future live `ApiStore` with no pre-warm), SSR must **warm first, then read sync.** The pattern already exists: `warmPageStore` → `store.warm(reqs)` (warm.ts:79) is the synchronous read of an async-pre-filled cache, and `ApiStore.prefetch()` (store-impl.ts:78) is the async fill. N34 generalizes the warm step:
  ```ts
  // New async sibling of warmPageStore (N34b):
  await warmPageStoreAsync(page, staticCtx)        // awaits queryAsync/prefetch for every requirement
  const html = renderPageToHTML(page, staticCtx)    // querySync now hits a warm cache → sync
  ```
  This keeps `renderPageToHTML` itself synchronous: **async is pulled out into an awaitable warm step before the synchronous render.** (Cache-Aside + the existing `extractRequirements` static-analysis prefetch — warm.ts:23.)

## Fitness functions (N34a/b)
- For any store with `caps.sync === true`, `renderPageToHTML` produces identical output **with and without** a preceding `warmPageStoreAsync` (sync stores need no warm).
- `renderPageToHTML` / `renderPageToJSON` **never call `queryAsync`** (spy the store; assert only `querySync` is hit).
