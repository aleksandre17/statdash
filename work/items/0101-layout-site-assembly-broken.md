---
id: "0101"
title: "SITE ASSEMBLY BY LAYOUT IS BROKEN — layout elements don't compose ('don't understand each other'); a dropped GRID overflows the page and content BLEEDS onto another page (→ regional-accounts). Owner-reported live 2026-07-19."
status: ROOT-CAUSED (2026-07-19 — explorer+MCP live characterization decisive; QUEUED as next WIP after 0100-P2a, AHEAD of 0100-P2b; build not yet started, WIP=1). Good news: the containment GRAMMAR (ADR-041) is sound — the hole is the empty-container AUTHORING affordance (a referenced-but-undelivered "Slice-1 placeholder"), not the architecture.
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

**Boundaries.** Extends ADR-041 (no fifth grammar) · page = a containment boundary content must not escape · declarative · loose coupling. WIP=1: 0100-P2a keeps building (read-only characterization runs parallel-safe); this does not abandon P2a.
