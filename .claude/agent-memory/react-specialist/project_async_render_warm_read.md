---
name: async-render-warm-read
description: How async (caps.sync=false) stores bind rows through renderNode — capability-transparent CachedStore + useNodeRows warm-then-sync-read Cache-Aside.
metadata:
  type: project
---

The render path for ASYNC stores (ApiStore, caps.sync=false) is Cache-Aside, NOT a separate async read path. ADR-STORE-001.

**Three-part seam (all in place):**
1. `CachedStore` (core/data/store-impl.ts) is capability-transparent: constructor inherits `source.caps.sync`/`streaming` (no longer hardcodes sync:true), and implements `queryAsync` that delegates to `source.queryAsync` and memoizes OBS results into `_obsCache` under the SAME `obsCacheKey` querySync reads. val queries are NOT written to valCache (source defines the OLAP-sum; `_val` recomputes sync against the warmed source) — avoids caching a raw first-row value as the aggregate.
2. `resolveStore` (react/engine/resolveNodeRows.ts) now WRAPS async stores in CachedStore (the old `caps.sync===false` bypass was removed — transparency made wrapping safe). The `caps.streaming===true` bypass STAYS (CachedStore doesn't proxy subscribe()).
3. `useNodeRows` async path: WARM (await `store.queryAsync` for every `extractRequirements` req as BOTH val+obs, plus the spec's own obs query for 'query' specs) → then READ by calling `resolveNodeRows` SYNCHRONOUSLY (full engine: desugar→resolver→encoding→pipeline). NEVER hand-build a StoreQuery from the DataSpec — only interpretSpec applies encoding/pipeline/multi-measure.

**Gotcha that cost a debug cycle:** `const qa = store.queryAsync` drops `this`. CachedStore.queryAsync reads `this.source` → "Cannot read properties of undefined (reading 'source')". MUST `store.queryAsync.bind(store)`.

**Test gotcha:** a mocked `fetch` returning one `Response` via `mockResolvedValue` breaks — Response body reads once, and the warm fires several fetches. Use `mockImplementation(async () => freshResponse())`.

**The regression test that was missing:** `react/src/engine/renderNode.async.test.tsx` — renders a data node THROUGH renderNode backed by real CachedStore(ApiStore) + mocked fetch, asserts rows bind. Fails pre-fix with the exact `ApiStore.querySync called cold ... caps.sync=false` error. The prior async tests (apiStore.async, useNodeRows.async) tested the contract OFF the renderNode path — that's why the bug shipped.

**How to apply:** "endpoints have data but UI empty / Failed to load component" for an async store ⇒ check (a) CachedStore caps transparency, (b) resolveStore wraps it, (c) useNodeRows warms-then-reads with bound queryAsync. See debugger memory [[cachedstore-async-gap]] for the original diagnosis.
