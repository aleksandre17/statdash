---
name: adr042-placement-port
description: ADR-042 Slice 0 — the Placement port (placePart), writePart's structural sibling; slot/value/sourced structural mutation unified behind one port + one plan
metadata:
  type: project
---

# ADR-042 Slice 0 — the Placement seam (`placePart`)

The MANIPULATE axis of the authoring Triprojection (ADR-042 D1/D2), lifted onto the ONE Part port — the structural sibling `writePart` never got. **LANDED green (additive, reversible, byte-identical, NO UX change).**

**Why:** structural editing was forked machinery (two drag transports; `moveNode` on one surface/residence only; a nest-vs-reorder *heuristic* in `OutlineTree`, not a resolved plan; the reserved `node-children` `PartMutation` arm sat unused). Slice 0 unifies it behind ONE port + ONE plan.

**How to apply / the seam shape:**
- `placePart(element, op: PlacementOp, ctx)` is now a REQUIRED method on `PartSource` (`packages/react/src/engine/partPort.ts`) — the exact peer of `writePart`, residence-routed, emitting the SAME `PartMutation` union. New port types: `PlacementOp` (verbs `insert|move|remove|reorder`), `PartInsertOp`, `NodeChildrenOp = Extract<PlacementOp,{insert|move|remove}>`. The reserved `node-children` arm was reshaped `{children:unknown[]}` → `{op:NodeChildrenOp}` (verified zero prior runtime readers). All exported via the engine barrel.
- **4 residence adapters implement it:** `slotParts` (engine `partSources.ts`) → `node-children` (thin router; tree ALGEBRA stays in the store reducers); `valueParts` (engine) → `node-props` array splice (`reorderArray`); `sourcedParts` (app `bandSource.ts`, page-filters) → `filter-schema` via `setBarParams`; `chromeParts` (app, site-chrome) → `site-chrome` order write (MINIMAL — full multi-region reindex is Slice-4-wired). Value/sourced/chrome placePart are additive/unit-tested, NOT gesture-wired yet.
- `PlacementPlan` + `resolvePlacementPlan(page, source?, target, type)` + `planPlacement(plan, opts)` live in `apps/panel/src/canvas/insertNode.ts` — generalize `InsertPlan`/`resolveInsertPlan` (both KEPT intact so every insert fitness stays green). `source` absent ⇒ delegates to `resolveInsertPlan` (byte-identical); `source` present ⇒ reproduces `OutlineTree`'s Candidate-A/B move logic as a resolved plan (nest-into = `reparent@0` for a non-empty accepting container; else sibling `reorder`/`reparent` with the drop-below index shift).
- **ONE commit site:** `apps/panel/src/canvas/placeNode.ts` `placeSlotPart(pageId, op, actions)` — `getPartSource('slot').placePart` → dispatch `node-children` op to `insertNodes`/`moveNode`/`removeNode`. The 3 refactored callers (`useCanvasController.handleDrop`, `useCommandRunner` insert branch, `OutlineTree.handleDragEnd`) now resolve→compile→`placeSlotPart` — NO direct `moveNode`/`insertNodes` outside this file. (Duplicate's `insertNode` singular + all delete paths are OUT of Slice-0 scope — folded later.)
- **Fitness:** `apps/panel/src/canvas/placeNode.fitness.test.ts` — FF-ONE-PLACEMENT-GRAMMAR (glob grep: `moveNode(`/`insertNodes(` only in placeNode.ts, allowlist=1), FF-PLACEMENT-RESIDENCE-ROUTED (routing + no node-type branch in adapters), FF-PLACEMENT-PLAN-TOTAL (every residence implements placePart; every gesture → known plan kind). App-side uses `import.meta.glob(?raw)` NOT node:fs (Vitest-4 workspace hazard).

**Not yet built (later slices):** Slice 1 = canvas drag-to-move on dnd-kit + retire native `dataTransfer` (the ⚠️ one-way transport flip, owner-GO-gated). S2 section-de-privilege (CAPS.LAYOUT). S3 renderer-emitted anchors. S4 value/sourced/chrome structural manipulation gesture-wiring. S5 dock facet-tab IA. S6 data-layer isolation.
