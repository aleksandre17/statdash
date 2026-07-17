---
name: project-authoring-experience-architecture
description: SPEC-authoring-experience-architecture — the ONE unifying authoring-UX doc; names the missing root (Manipulate is the unbuilt 3rd projection of the Part model = the Placement port)
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-authoring-experience-architecture.md` (I authored, 2026-07-13). Owner directive: stop fixing elements one-by-one; architect the WHOLE Constructor as ONE coherent body (like Webflow/Framer are one interaction model). READ-ONLY, no code. THE unifying doc — absorbs the anticipated SPEC-canvas-manipulation; re-points the others (no SSOT fork).

**The single root:** authoring = THREE projections of ONE model (the Part address space: `PartAddress` + declared contract + `slotAdmits`) — **SELECT · INSPECT · MANIPULATE**. Two are built as projections (Select = `CanvasOverlay` recurses `enumerateParts`, ONE `PartAddress`; Inspect = `projectParts ⊕ projectFacets`, deep-auth-completion). **MANIPULATE was never lifted onto the port** → forked machinery. Same root ADR-041 found for containment-read + deep-auth-completion found for facets, now the 3rd time on the manipulation axis.

**Fragmentation ROOT (code-cited):**
- TWO drag transports: canvas-insert = native HTML5 DnD (`NodePalette.tsx:86-90` `dataTransfer('nodeType')`); navigator move = dnd-kit (`OutlineTree.tsx:24-27`).
- MOVE on ONE surface + ONE residence only: `moveNode` (`constructor.pages.ts:188`) is slot/node-tree only, invoked ONLY from `OutlineTree.handleDragEnd`; canvas frames are select-only `<button>`s (`CanvasOverlay.tsx:301`) → "no drag-to-move" literal.
- nest-vs-reorder = inline heuristic (`OutlineTree.tsx:96-117` Candidate-A/B guess), not a resolved plan → "nesting jams".
- NO structural method on the Part port: `PartSource` (`partPort.ts:177`) = `enumerateParts`+`writePart` only; BUT `PartMutation` already RESERVES a `node-children` arm (`partPort.ts:165` "slot residence — lands with slotParts") — substrate anticipated structural mutation, no method produces it.
- Reach depends on MANUAL per-shell anchor-stamping: filter-bar + kpi-strip stamp `PartAnchor`; **table shell stamps none** → "tables unreachable" (whole-table frames via `walkNodes` fallback; its column parts don't).

**The missing primitive = the Placement port** = `writePart`'s structural sibling: add `placePart(element, PlacementOp, ctx) → PartMutation` to the ONE `PartSource`, residence-routed (slot→`node-children`→moveNode/insertNodes; value→`node-props` array splice; sourced→`filter-schema`/`site-chrome` reorder). Adapters keyed by residence never type. Plus: ONE `PlacementPlan` (generalize `InsertPlan` to insert|move|reparent|reorder|remove; `resolvePlacementPlan`); ONE dnd-kit transport (retire native HTML5, no keyboard = WCAG gap); renderer-emitted anchors (reach = derived guarantee, not shell duty).

**Symptoms→impossible:** nesting jams→ONE PlacementPlan; no-move→placePart on every surface (`FF-MANIPULATE-EVERY-SURFACE`); tables→renderer anchors (`FF-EVERY-PART-ANCHORED` corpus []); chrome-manip→site-chrome structural adapter; thin inspectors→`FF-EVERY-DECLARED-FACET-PROJECTED`; mgmt-hard→`FF-AUTHORING-TRIPROJECTION`.

**Phases (Strangler, each Playwright-provable):** S0 Placement seam (add placePart+PlacementPlan, refactor insert+outline-move onto it byte-identical; spawns **ADR-042** extends ADR-041, owner GO) · **S1 REC FIRST FELT: canvas drag-move/reorder/re-nest slot parts on ONE transport** (closes no-move+nesting-jams+the in-flight drag-drop fix; Playwright: canvas move == navigator move byte-identical) · S2 renderer anchors (tables) · S3 value/sourced/chrome structural adapters (chrome-manip; OCP proof) · S4 Facet/Inspect completion (=deep-auth-completion S1) · S5 convergence + coherence gate.

**Ideology verdict: substrate HOLDS as-is** (the `node-children` reserved arm proves it was designed for this); only the app-layer two-transport fork + manual anchor-stamping are erosion, fixed in apps not engine. 3 in-flight fixes fold in as slices: chrome-in-canvas (S6-select done + S3-manip), tables/facet (S2+S4), drag-drop (S0-S1) — never separate patches.

**Reconciliation:** SPEC-studio-ia-canonical owns surface ARRANGEMENT (subordinate); deep-auth-completion owns INSPECT projection; AR-42 = runtime/view-time interaction (orthogonal to author-time manipulation); ADR-041 = substrate → ADR-042 extends. See [[project-studio-ia-canonical]], [[project-deep-authorability-completion]], [[project-grammar-of-interaction]], [[project-bounded-element-selection]], [[project-root-concept-foundation]].
