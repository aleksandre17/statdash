---
name: stateb-fix-review
description: 2026-07-03 merge gate on fix/crossfilter-state-b-rerender — useNodeRows async cache key; APPROVE-WITH-CONDITIONS, store-axis gap found
metadata:
  type: project
---

Merge gate on `fix/crossfilter-state-b-rerender` (useNodeRows.ts async `_promiseCache` key). The last regional cross-filter State-B bug.

Verdict: APPROVE-WITH-CONDITIONS.

Root cause (verified real): module-level shared `_promiseCache` keyed on `depKey` (specDimKey ⊕ varsKey) — not node-unique. Sibling map + pivot issue same covering fetch → identical depKey → collide → pivot served map's rows. Fix folds `recipeKey = stableStringify(node.data + node.transforms)` into the key.

Gates all green: 2 new tests PASS w/fix + proven FAIL w/o (stash-revert), react engine 422, geostat 94, tsc geostat+panel 0, lint 0, check-laws all clean. Sync fast-lane byte-identical (diff only touches async branch).

**Key finding (the axis the fix left uncovered): the async cacheKey is still NOT truly node-unique — it drops the STORE axis.** `resolveStore` resolves via `ctx.pageStoreKey`, which renderNode overrides per-subtree via `effectiveStoreKey` (renderNode.ts:193-196). Two same-recipe/same-fetch nodes routed to DIFFERENT stores → identical cacheKey → collide (State-B round 2 on a multi-store async page — M1 metric→dataSource routing is a shipped capability). Sync memo (useNodeRows:125) already keys on `node.storeKey, ctx.pageStoreKey`; async key must too. **Why:** fix's own comment claims "NODE-UNIQUE" but it's recipe⊕dep-unique only. Not live today (single-store regional page). **How to apply:** required one-line completion — fold `ctx.pageStoreKey` into cacheKey with a real separator.

**Secondary finding — debugger's useKpiRows rationale is FACTUALLY WRONG.** kpiDepKey (useKpiRows.ts:45-62) includes specs ONLY on the static (reqs.length===0) branch; the hot reqs-based path is purely reqs (code×dims), NO recipe. Same collision class as State-B, latent not live. Track as follow-up FF-KPIROWS-CACHE-NODE-UNIQUE; do NOT block this PR (scope).

Live-display: e2e test drives REAL async pipeline to real DOM table cells (pivot = DataTable, renders in jsdom) → sufficient to MERGE. But jsdom does NOT paint ApexCharts/Leaflet (getContext unimplemented) → live-browser DISPLAY verify is a hard gate BEFORE DEPLOY, per owner's "verify by DISPLAY not proxy." Sequence: MERGE → live verify → DEPLOY.
