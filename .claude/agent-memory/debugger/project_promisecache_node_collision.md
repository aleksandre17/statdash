---
name: promisecache-node-collision
description: Regional cross-filter State-B root — module-level async _promiseCache keyed on non-node-unique depKey; sibling nodes with same fetch collide
metadata:
  type: project
---

Regional cross-filter State B ("select region → composition must re-purpose to sector pivot") root cause, pinned 2026-07-03 via instrumented repro on the REAL async render pipeline.

**Root (file:line):** `platform/packages/react/src/engine/useNodeRows.ts` — the module-level `_promiseCache` (async path, `caps.sync===false` / live ApiStore) was keyed ONLY on `depKey = specDimKey(node.data) ⊕ varsKey`. That is a DATA-DEPENDENCY fingerprint (covering fetch code×dims + derived vars), NOT a node-unique identity. `extractRequirements` collapses two sibling nodes that issue the SAME covering fetch (the `geo-map` and the `sectors` pivot both fetch `measure=GVA, geo=…`) to the SAME depKey. Because the cache is module-level and shared across all node instances, they COLLIDE: the first to render (geo-map, always by-region) populates the entry with ITS rows; the pivot reads the same key and is served geo-map's 11 by-region rows → State B shows "GDP by region" instead of the sector breakdown.

**Why it hid so long:** State A is masked (both nodes are by-region, collision returns similar data). Only manifests async — the SYNC fast-lane calls `resolveNodeRows` directly per node (per-instance memo, no shared cache), so the sync parity harness renders State B correctly (9 sector rows) and never reproduced it. This is why prior sync-store green tests passed while live (ApiStore async) failed.

**Refuted prior hypotheses:** NOT a re-render trigger gap (useNodeRows IS called 3× for sectors in State B) and NOT a vars-threading gap (depKey correctly carries State-B `_byDims=sector,geo,time`, `geo=R2`). The vars are perfect; the CACHE KEY is the bug.

**Fix (canonical, Law 1/6):** fold a stable structural fingerprint of the node's ROW RECIPE (`node.data` = pipe+encoding+type, plus `node.transforms`; JSON-serialisable declarative config, memoised on stable refs) into the cache key: `cacheKey = recipeKey ⊕ depKey`. depKey = per-STATE axis; recipeKey = per-NODE axis. Preserves in-flight dedup for genuinely identical recipes.

**Locks:** `packages/react/.../useNodeRows.cacheKey.fitness.test.tsx` (FF-NODEROWS-CACHE-NODE-UNIQUE, at the fix layer) + `apps/geostat/.../regional-crossfilter-stateB.fitness.test.tsx` (end-to-end display: async State B composition renders sector row labels). Both verified to FAIL pre-fix, PASS post-fix.

**Note:** `useKpiRows.ts` has the same module-level cache but keys on `kpiDepKey(reqs, specs, dims)` which INCLUDES `specs` (the recipe) → not the same collision class. Verify any future shared-cache addition keys on recipe, not just fetch fingerprint. See platform memory [[project_cachedstore_async_gap]], [[project_apistore_wire_inexpressible_filters]].
