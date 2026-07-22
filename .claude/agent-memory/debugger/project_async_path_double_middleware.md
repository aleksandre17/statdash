---
name: async-path-double-middleware
description: renderNode's async store path applied the after-middleware chain TWICE → canvas node-anchor stamped twice ONLY in live/async mode → all whole-node selection frames collapsed to 0×0 at origin; structural/sync single-stamped so it "worked" there
metadata:
  type: project
---

The 0109 whole-node canvas-selection collapse (all 16 node frames → 4×4 dot at viewport (0,0), only leaf items selectable).

**Root cause (proven at file:line):** `packages/react/src/engine/renderNode.ts` — the ASYNC store path (`caps.sync === false`) applied the `middleware.after` chain TWICE: once inside `renderWithRows` (the shared continuation) AND once around the outer Suspense boundary (the async wrapper block). The panel's ONE `canvas:node-anchor` middleware (`apps/panel/src/canvas/setupCanvasRegistry.ts`, a `createElement('div',{data-part-node-id,...,display:contents})`) therefore stamped each node TWICE → two nested `display:contents` wrappers → the overlay's `firstElementChild` box resolution (`CanvasOverlay.tsx`) landed on the boxless second wrapper → rect 0×0.

**The mode-dependence is the tell.** Sync store (structural preview) → single stamp → selection works. Async store (live preview — the DEFAULT since W1/Canon-C2) → double stamp → selection broken. A defect that "works in structural, breaks in live" ⇒ suspect a sync-vs-async divergence in the ENGINE render structure, not the config/overlay. Reproduce by rendering ONE node through `renderNode` with a `caps.sync:false` store and counting `[data-part-node-id]` (sync=1, async=2) — no SiteProvider needed if you register a trivial hook-free shell.

**Why the dossier's guess was wrong.** The DOM fingerprint (two nested `data-part-node-id`) was correct but the origin hypothesis ("ADR-041 anchor-merge: middleware + slot-part render path both stamp") was FALSIFIED — grep proves NO `PartAnchor` with `nodeId` exists in any render path; both stamps come from the SAME one middleware, applied twice. Lesson: a plausible grammar-smell story ("anchored twice = ADR-041 duplication") can co-exist with the true mechanical cause being a copy-paste double-apply. Confirm the emitter, don't infer it.

**Fix (3 layers, commit d56c65a2):** (1) ROOT — `renderWithRows(rows, applyAfterMiddleware=true)`; the async continuation (`AsyncRows`) passes `false`, so the after-chain applies once around the outer boundary (structurally parallel to sync). (2) DEFENSE — `apps/panel/src/canvas/anchorBox.ts::resolveAnchorBox` descends through ALL leading `display:contents` levels (`while getComputedStyle(box).display==='contents' → firstElementChild`), wired at every overlay box site (node/item/chrome); robust to any future wrapper-count regression. (3) GUARD — `FF-NODE-FRAME-NONDEGENERATE` (`nodeFrameNonDegenerate.fitness.test.tsx`) asserts one anchor per node through BOTH paths + the descent logic. jsdom has NO layout, so geometry non-degeneracy itself is only pinnable by a Playwright e2e / owner walk — the single-anchor invariant is the jsdom-checkable proxy.

Sibling canvas-anchor finding: [[project_drop_port_geometry_falsified]]. Broader "renders in tests, broken live" family: [[project_async_store_live_render_patterns]].
