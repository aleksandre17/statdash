---
name: cachedstore-async-gap
description: Root cause of "live stats charts render empty" — CachedStore masks ApiStore caps.sync=false; renderNode is sync-only and never uses useNodeRows.
metadata:
  type: project
---

The live `stats` store (geostat AND panel live-preview) renders every chart/table with NO data even when the API serves real rows.

**Root cause (two compounding faults):**
1. `CachedStore` is NOT capability-transparent — it hardcodes `caps.sync=true` / `caps.streaming=false` regardless of source, and implements NO `queryAsync` (only proxies `querySync`/`queryFrame`). `platform/packages/core/src/data/store-impl.ts:71-76,90-106`.
2. The render engine `renderNode` resolves rows SYNCHRONOUSLY and unconditionally via `resolveNodeRows` (`platform/packages/react/src/engine/renderNode.ts:269`) — it never calls the async-aware `useNodeRows` hook, so the `React.use()` suspend path is dead code for the real render.

**Mechanism:** `stats-registrations.ts:138-147` wraps `new ApiStore` (caps.sync=false; querySync THROWS cold, cache only filled by queryAsync — `store-api.ts:182-191,140`) in a `CachedStore`. The wrapper reports sync=true, so `resolveStore`'s async bypass (`resolveNodeRows.ts:62`) never fires. Sync `interpretSpec`→`storeObs/storeVal`→`querySync` hits the cold ApiStore → throws → caught per-node by NodeErrorBoundary → empty charts.

**Why tests didn't catch it:** the async contract is tested where it ISN'T used (`apiStore.async.test.ts` hits queryAsync directly; `useNodeRows.async.test.tsx` tests the hook in isolation) and used where it ISN'T wired (renderNode). Neither test goes through `renderNode`.

**Why:** ADR-STORE-001 moved obs loading to per-query async Cache-Aside, but the engine render path was never converted from sync to async, and CachedStore was never made capability-transparent.

**How to apply:** When debugging "endpoints have data but UI is empty" for any async/streaming store, check (a) is the store wrapped in CachedStore (which masks caps), and (b) does renderNode route through useNodeRows for caps.sync===false. The correct fix is CachedStore.queryAsync + inherit source caps, AND renderNode routing to the async hook — NOT eager whole-cube prefetch or catching the throw. See [[bootstrap-runner-store-flow]].
