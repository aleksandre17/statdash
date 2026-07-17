---
name: project-canvas-manipulation
description: The canvas drag/drop/move architecture decision — SPEC-canvas-manipulation.md, dnd-kit convergence, drop=slotAdmits projection, and the two-drag-system split to reconcile
metadata:
  type: project
---

Canvas node-manipulation (drop-to-nest, drag-to-move/reorder) architecture, decided in
`docs/architecture/proposals/SPEC-canvas-manipulation.md`.

**Why:** Owner-reported real gaps — nesting jams (drop a section, can't drop a chart into it)
and no move/reorder on the canvas. This is the fundamental visual-builder interaction.

**How to apply (durable decisions, not code-derivable):**
- **Drop validity = the composition grammar.** A drop/move is valid iff `slotAdmits(slot,{type,caps})`
  (`packages/react/src/engine/slice-meta.ts`) — the SAME predicate the palette (`nestAccepts`) already
  uses. NEVER write a per-container drop handler; a new nestable is a `slots.accepts/acceptsCaps`
  declaration + `caps:['flow']`. This is the Bounded-Element projection extended to the drop surface.
- **Two drag systems exist and must be UNIFIED, not tripled:** native HTML5 DnD (palette→canvas, via
  `dataTransfer('nodeType')`) vs **dnd-kit** (the Outline tree, `OutlineTree.tsx` + shared
  `useDndSensors`). Decision: converge canvas + palette onto dnd-kit in ONE DndContext with the tree.
  Reason: keyboard a11y (WCAG AA) + DragOverlay + sortable + collision for free, and cross-surface parity.
- **The write engine already exists — reuse, don't add reducers:** `insertNodePatch`/`insertNodesPatch`
  (index-aware) and `moveNodePatch` (descendant-guarded) in `apps/panel/src/store/constructor.pages.ts`,
  exposed as `insertNodes`/`moveNode`. `moveNode` is wired in the tree but NOT the canvas.
- **`CanvasViewProps.onMoveNode` is declared but dormant** — never threaded to `CanvasOverlay`. That is
  the no-move seam to activate.
- **Two orthogonal axes on the canvas overlay:** SLOT axis (node containers → drop/move; this SPEC) vs
  PART/selection axis (value/sourced parts + chrome regions → selection-only; `isNodeContainer` false).
  Concurrent agents on parts/chrome/tables do NOT collide with manipulation work.
- **Root improvement to make when touching this:** `CanvasOverlay.handleDrop` reads `slot.accepts` ONLY
  (capability-blind, a divergent second reading of the content-model) — replace with `slotAdmits`
  (SPEC Slice 0, `FF-DROP-GATE-IS-GRAMMAR`).
- First buildable slice = empty-container placeholder droppable + insertion line + index-aware insert.
