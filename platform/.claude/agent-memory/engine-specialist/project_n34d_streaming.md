---
name: project-n34d-streaming
description: N34d: useNodeStream hook + polling/streaming support — what was already present and what was added
metadata:
  type: project
---

N34d implemented optional polling/streaming support via `DataStore.subscribe?()`.

**Already present before this session (added by N34c or earlier):**
- `Unsubscribe = () => void` in `engine/core/src/data/store.ts` line 83
- `StoreCaps.streaming: boolean` in `store.ts`
- `subscribe?(q, ctx, cb: (r: QueryResult) => void): Unsubscribe` on `DataStore` — note: cb receives `QueryResult`, not `EngineRow[]`
- Both barrels (`data/index.ts`, `core/src/index.ts`) already exported `Unsubscribe`

**Added in this session:**
- `engine/react/src/engine/useNodeStream.ts` — live subscription hook; falls back to resolveNodeRows sync path when store is not streaming; polling via `view.polling.interval` for non-streaming stores
- `ViewParams.polling?: { interval: number }` in `engine/react/src/engine/types/node.ts`
- Export of `useNodeStream` from `engine/react/src/engine/index.ts`
- `engine/react/src/engine/useNodeStream.test.ts` — 8 tests, all passing

**Side fix:**
- `resolveStore` in `resolveNodeRows.ts` now bypasses `CachedStore` wrapping for stores with `caps.streaming === true`. CachedStore hardcodes `streaming: false` and does not proxy `subscribe()`, which would have hidden streaming capability. Same pattern as the existing `caps.sync === false` bypass.

**Pre-existing test failures (unrelated):**
- `warm.test.ts` (5 fails): `_storeCache` WeakMap internal export not accessible in test module scope
- `constructor.test.ts` (20 fails): pre-existing before N34d
- `resolveNodeRows.test.ts` (4 fails): stubs spread `staticStore` + `_testId`, but `CachedStore` wrapping loses `_testId`
- `api.test.ts`, `api.node-meta.test.ts`: pre-existing

**Why:** streaming stores bypassing CachedStore was necessary because CachedStore hardcodes caps.streaming=false and omits subscribe() proxy — hiding the live-data contract from useNodeStream.
