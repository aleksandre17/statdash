---
name: project-panel-layout-assembly-r1
description: 0102 R1 — empty-container authoring affordance + move-guard nest + page-frame containment + page-tab URL sync
metadata:
  type: project
---

# Layout site-assembly R1 (card 0102 / root-cause 0101)

Fixed the owner's PRIMARY blocker: "I can't even start assembling a site with layout elements." Four coherent parts, decision-independent (does not touch the skeleton-species axis).

**Why:** an empty layout container rendered 0px (invisible + undroppable) and the move-resolver refused empty nest-targets, so dropped elements landed as siblings not children; oversized content bled past the page. The containment GRAMMAR (ADR-041) was sound — the hole was the empty-container AUTHORING affordance (the referenced-but-undelivered "Slice-1 placeholder").

**How to apply / the seams:**
- **Empty-container placeholder** = registry-DERIVED marker, not a per-type list. `isEmptyContainer(node)` in `apps/panel/src/canvas/setupCanvasRegistry.ts` (the anchor middleware) stamps `data-node-empty` when `isNodeContainer(meta)` AND no slot field carries a child. `canvas.css` `.canvas-layer--renderer [data-node-empty] > *` gives the box a min-height + dashed drop-affordance. The `> *` targets the display:contents anchor's single real box GENERICALLY (never a `.layout-grid` class). Authoring-ONLY (marker stamped solely by the panel canvas middleware; published render untouched). Because the box is now non-zero, the overlay measures a usable rect → the container's own dropzone works with zero overlay change.
- **Move-guard** (`insertNode.ts` `resolvePlacementPlan` Candidate A): deleted the `overNode.childIds.length > 0` guard. Disambiguation is now purely target-based + deterministic — drop ON a container (empty or populated) = nest as child; drop ON a leaf = sibling reorder. No design fork (the "what is the target" question already disambiguated; empty just joins the container arm).
- **Page-frame containment** = `overflow-x: clip` (NOT hidden — no scroll box, vertical stays visible for sticky/tooltip/hero-overlap) + `min-width:0`. Production card: `.page-content` in `packages/plugins/pages/inner-page/default/page-layout.css`. Canvas frame (all page types): `.canvas-layer--renderer .app-shell{,__content}` in `canvas.css`. There is NO base `.app-shell{}` CSS rule anywhere — app-shell layout is only per-`[data-frame]`; landing already clips-x at `.app-shell[data-frame="landing"]`.
- **Page-tab → URL** (`studio/StudioShell.tsx`): `selectPage(id)` PUSHES `?page=<id>` + sets store. The pre-existing Effect B (store→URL) is a boot-initializer that deliberately stands DOWN when the URL already names a valid page (avoids the boot loop) — so a tab click that only called `setActivePage` left a stale `?page=` and diverged store↔URL. Effect A/B rest at a fixpoint after selectPage.

**R1 projection completion (0102 R1 · owner-confirmed "it jams, labels pile on top"):** the drop MECHANISM was sound; the bugs were all in the authoring PROJECTION in `apps/panel/src/canvas/CanvasOverlay.tsx`. Four fixes:
- **Per-slot geometry (the overlap):** the old measure pushed a DropFrame per declared slot using the PARENT node's ONE `rect` → N fully-overlapping zones + stacked labels. Now `slotDropsFor(frame, rectById)` gives each slot its OWN rect: populated slot = UNION of its children's measured anchor boxes (`slotChildIds` reads the slot's declared residence field → look up `rectById` built during framing); empty slot = an allocated placeholder BAND via `emptyBands()` (residual space above/below the populated union, else clamped strip). Generic over declared Part slots, zero per-type branch. Measure now builds `rectById` in the frame pass, computes drops AFTER all nodes framed.
- **At-rest affordance (the "can't add"):** DropFrame carries `empty:boolean`; empty-slot zones render AT REST (`drops.filter(d => dragging || d.empty)`) with `.canvas-dropzone--empty` (opacity 1, labelled), populated zones stay drag-only. At rest all zones keep `pointer-events:none` (base) so the affordance never blocks node selection; drag re-enables via `.canvas-root--dragging`.
- **Localized labels (Law 9):** `resolveLocaleString(d.slot.label, locale ?? 'ka', 'en')` (from `@statdash/engine`) replaces the hard-coded `.en`; `locale` threaded CanvasView→CanvasOverlay.
- **Banner/toolbar clearance:** replaced the `34px` magic offset with `--canvas-toolbar-h` — CanvasView measures `.canvas-toolbar` via ResizeObserver into root state (merged into the root inline style so a re-render never wipes it); `.canvas-veil__label` margin-top = `calc(space-2 + var(--canvas-toolbar-h,34px) + space-2)`.

**Design fork (accepted, flagged):** inner-page declares a `sticky` slot but NO shell renders named `slots` (all shells render the primary `children.rendered`) — sticky is effectively unrendered. Its empty-band affordance + label are correct, but a drop there is currently invisible until a shell consumes `children.slots['sticky']`. Out of R1 scope (no shell/object-model change); the sticky slot render is the deeper follow-up.

**New/updated gate:** `CanvasOverlay.test.tsx` updated (at-rest shows EMPTY zones, hides POPULATED); `dropTargetGeometry.e2e.ts` extended (ka-first SITE) with the per-slot distinct-box + ka-label proof. tsc/lint/197 canvas tests green.

**Invariants held:** insertNeverCliff (V6 byte-identical insert) untouched — it exercises only `resolveInsertPlan` (source=null); the guard change is in the move branch (source present). placeNode FF-PLACEMENT-PLAN-TOTAL still green.

**New FFs:** `apps/panel/src/canvas/emptyContainerNestTarget.fitness.test.ts` (nest-target logic); `packages/plugins/pages/inner-page/default/page-containment.fitness.test.ts` (CSS-contract scan via node:fs — line-start-anchored ruleBody to skip the `> .page-content` descendant rule).

Related: [[project_panel_insert_accept_graph_gap]] · [[project_panel_bounded_element_bands]] · [[project_placement_law_primitive]] · [[reference_render_path_browser_verify]]
