---
id: "0101"
title: "SITE ASSEMBLY BY LAYOUT IS BROKEN — layout elements don't compose ('don't understand each other'); a dropped GRID overflows the page and content BLEEDS onto another page (→ regional-accounts). Owner-reported live 2026-07-19."
status: DONE (2026-07-19 — = canonical-remedy R1). Floor shipped `14dc8ec` (empty-container min-height + move-guard + page-frame containment + page-tab→URL) + drop-affordance projection `18dded3` (per-slot geometry kills overlap · at-rest visible labeled dropzones · localized labels · banner clears toolbar). Converged gate 4001/0. Deployed :3013. **OWNER-SCREEN LIVE-VERIFIED (his exact Example page): overlap GONE · at-rest affordance shows where to drop · settle-drop lands a grid child · banner clear · KA labels · 0 console errors.** Shots `work/authoring-truth/0102-r1-fixed/`. RESIDUALS (tracked, not blocking): partial i18n (the "Sticky" qualifier + canvas kind-badges `grid`/`inner-page` still EN — minor polish); chart-in-structural console crash `useNodeRows.ts:233` → card 0103 (canon canvas-never-lies); named-slot render (`sticky` unrendered) → 0102 R3/R4. Good news confirmed: the containment GRAMMAR (ADR-041) was always sound — the disease was the authoring PROJECTION, exactly per 0102.
class: M-L (authoring-affordance + CSS containment; NOT a grammar change)
priority: P0 (the PRIMARY gesture — 'assemble a site by layout' — is failing; owner: 'to this day I can't even start')
owner: lead → explorer (characterize) → debugger/architect (root-cause + fix)
relates:
  - docs/architecture/decisions/ADR-041-part-grammar-and-part-port.md   # containment grammar — suspected LIVE hole (layout composition + page containment)
  - work/items/0100-assembly-by-declaration.md                          # 0100 = the DATA-binding axis; THIS = the LAYOUT/containment axis (may need to fold into the program)
  - CLAUDE.md Law 10                                                    # one containment grammar
---
**Owner report (live, 2026-07-19, verbatim intent):** "to this day I can't even START assembling the site with LAYOUT elements. Yes, elements declare contracts, but they don't understand each other. How am I supposed to assemble a site like this? E.g. I dropped a GRID onto a page — it doesn't fit and it overflows/moves onto the regional-accounts page; content going from one page to another is a separate problem too."

**Two problems (to separate during characterization):**
1. **Composition gap** — layout elements (grid/containers) "don't understand each other": they don't nest/compose/accept children as declared. Elements declare contracts but composition between them fails.
2. **Cross-page bleed** — a dropped grid overflows its page AND content leaks onto another page (regional-accounts). Root unknown: shared-state leak (one canvas store across pages?) · routing/page-scoping · CSS overflow/containment · elements not scoped to their page in the data model.

**NOT P1-related** — P1 (DataSpec registry) doesn't touch layout/pages; this is pre-existing.

**ROOT-CAUSE (explorer+MCP, live-proven 2026-07-19):**

*Problem 2 — composition ("don't understand each other") — the PRIMARY pain. The grammar is FINE; the empty-container authoring affordance is the hole:*
- Grid DECLARES children correctly: `packages/plugins/nodes/layout/grid/default/meta.ts:13-15` (`slots:GridSlots`, `canHaveChildren:true`, open container) + `GridNode.ts:93-99`. The reducer nests correctly (`store/constructor.pages.ts:142-216`).
- **(A)** an empty container renders **0px** (`min-height:0`) → invisible strip (live: grid childCount 0, height 0).
- **(B)** the overlay drop-zone IS the container's own 0px box (`canvas/CanvasOverlay.tsx:158-163`) → can't drop *into* it.
- **(C)** the move resolver **refuses empty containers as nest-targets** (`canvas/insertNode.ts:289`, requires `childIds.length>0`) → a dragged element becomes a **sibling**, not a child. Code comment: *"empty container is not an outline nest-target today; that quirk is preserved and closed by the Slice-1 placeholder"* — the placeholder is UNDELIVERED.
- The only working nest path: select the container first (Layers outline, since 0px on canvas) → insert (`NodePalette.tsx:121-128` `nestAccepts` + `insertNode.ts:172-178`).

*Problem 1 — overflow/bleed:*
- **CSS-overflow / no page-frame containment** (state-leak DISPROVEN — state is per-page, `store/constructor.pages.ts`, live-proven). The page-frame chain (`landing-root`→`app-shell__content`→`app-shell__body`→`app-shell`→`canvas-layer--renderer`) is ALL `overflow:visible`+`contain:none`; nothing clamps content to the page card. Seams: page-frame CSS in `packages/plugins/pages/` + `app-shell`; canvas clamp `apps/panel/src/canvas/canvas.css` (`canvas-root`).
- Literal "content on another page" NOT reproducible in studio (one page renders) — likely visual overflow, or a published multi-page-site concern (UNVERIFIED there).
- **SURFACED (separate small fix):** page-tab switches the store's active page but NOT the URL (stays `?page=regional`) → Law 9 (URL=permalink) brush. `setActivePage` doesn't drive the route.

**FIX PLAN (Strangler; queued after 0100-P2a, ahead of 0100-P2b):**
1. **Empty-container authoring slice (the "Slice-1 placeholder"):** an empty layout container renders with a min-height + a visible drop-placeholder so it can receive its first child by drag; the move-guard (`insertNode.ts:289`) accepts an empty container as a nest-target (resolve the ambiguity the quirk was avoiding). This directly fixes "can't assemble a site / elements land as siblings."
2. **Page-frame containment:** clamp content to the page card (overflow/containment on the page-frame container).
3. **Routing (small):** page-tab drives the URL (`?page=`) — Law 9.
Screenshots: `work/authoring-truth/0101/`. Benchmark the empty-container affordance vs Builder/Framer/Webflow (visible empty-slot dropzones).

**R1 SHIPPED the floor (14dc8ec): empty-container min-height + move-guard + page-frame containment + page-tab→URL — deployed+committed.** But owner live-repro (2026-07-19, his Example page) proved the FLOOR isn't enough — the drop MECHANISM works (settle-step drop lands a child; ports measure real geometry — the "collapse" diagnosis was FALSE, `measure()` uses `firstElementChild` not the display:contents anchor), yet the **authoring PROJECTION is broken** (the real "engine works, projection missing"):
- **Overlapping slot dropzones** — `CanvasOverlay.tsx:158-163` gives EVERY declared slot the PARENT node's single rect (never measures each slot's own box) → inner-page `sticky`+`main` stack byte-identical (357,172,242×855) → the owner's "StickyBar/Content" label pile-up.
- **No at-rest affordance** — dropzones render only while `dragging===true` (`:355`) → the canvas shows nothing about where to drop → the "can't add / it jams" perception (a fast atomic drag also drops before ports mount).
- **EN-only labels** — `:369-370` uses `.label.en` on `/ka/` (Law 9 gap).
- **Banner overlaps toolbar** — `canvas.css:144` hard-coded 34px magic offset under-shoots the toolbar.
**R1-completion fix IN FLIGHT (senior-frontend):** per-slot geometry (kills overlap) · at-rest visible drop affordance (shows where to add) · localized labels · banner layout fix. Generic over declared Part-slots (ADR-041). dnd-probe harness `e2e/dropTargetGeometry.e2e.ts` (uncommitted, debugger-authored) extended to pin non-overlapping per-slot zones. R1 NOT closed until the owner's exact screen is clean + visibly droppable.

**Boundaries.** Extends ADR-041 (no fifth grammar) · page = a containment boundary content must not escape · declarative · loose coupling. WIP=1: 0100-P2a keeps building (read-only characterization runs parallel-safe); this does not abandon P2a.
