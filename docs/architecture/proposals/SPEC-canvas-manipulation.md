# SPEC — Canvas Manipulation (drag-to-insert · drop-to-NEST · drag-to-MOVE/reorder)

> Status: PROPOSAL (decision-grade, no code). Author: platform-architect (Opus).
> Scope: the Constructor's WYSIWYG canvas node-manipulation system, at reference-platform
> grade (Webflow / Framer / Builder.io / Puck / Craft.js / Gutenberg).
> Ground truth read: `apps/panel/src/canvas/{CanvasView,CanvasOverlay,insertNode,NodePalette,walkNodes}.tsx|ts`,
> `apps/panel/src/store/constructor.pages.ts`, `apps/panel/src/studio/useCanvasController.ts`,
> `apps/panel/src/outline/OutlineTree.tsx`, `apps/panel/src/shared/dnd/useDndSensors.ts`,
> `packages/react/src/engine/slice-meta.ts` (`slotAdmits` / `isNodeContainer`).

---

## 0. TL;DR (the epilogue up front)

- **Jam root cause (1 line):** a freshly-dropped container renders with ~zero geometry and has **no min-height placeholder droppable**, so its measured drop-zone rect is an un-hittable sliver — and when a target slot's content-model rejects the child, `resolveInsertPlan` **silently redirects the insert to the page root** instead of nesting; both read as "it won't nest."
- **Canonical model (1 para):** every framed canvas node registers its declared slots as **droppables** and itself as a **draggable**; a drop's validity is `slotAdmits(slot, {type, caps})` — the composition grammar already built — so nesting into ANY container falls out of the declaration with zero per-type code. The overlay resolves the **nearest accepting slot + an insertion index** from the pointer against the child rects it already measures, paints the **blue insertion line**, and commits through the existing engine: `insertNodes` (index-aware) for a palette insert, `moveNode` (descendant-guarded) for a canvas move. Empty slots render an explicit "Drop here" placeholder droppable. One predicate, one write path, one drag model shared with the Outline tree.
- **Recommended primitive:** **dnd-kit — YES.** The Outline tree already runs on it (`OutlineTree.tsx` + shared `useDndSensors`); converging the canvas + palette onto the same `DndContext` unifies the two drag systems, and buys keyboard-accessible drag (WCAG 2.1 AA), `DragOverlay`, sortable reorder, and collision detection for free.
- **First buildable slice:** **drop-to-nest into a container + the insertion indicator + the empty-container placeholder** (Slice 1) — the owner's exact broken flow (drop a section, then drop a chart INTO it), proven by a Playwright drag-drop leg.

---

## 1. Diagnosis — why nesting jams, why there is no move (code-cited)

### 1.1 The two-layer canvas (context)
`CanvasView.tsx` stacks **Layer 1** = the real `NodePageRenderer` (pointer-events:none, visual only) and **Layer 2** = `CanvasOverlay` (transparent interaction layer). The overlay `measure()` walks the same `NodePageConfig`, reads each node's `data-part-*` anchor via `getBoundingClientRect()`, and produces `frames` (one per node) + `drops` (one per registered `SlotDef`). This two-layer model is correct and Builder.io-class — the manipulation system extends it, it is not the problem.

### 1.2 Why NESTING JAMS — four compounding causes

**Cause A (the primary felt jam) — empty containers are un-droppable.**
`CanvasOverlay.measure()` pushes a `DropFrame` whose `rect` is the **container node's own bounding box** (`CanvasOverlay.tsx` ~L160: `nextDrops.push({ parentId: id, slotKey, slot, rect })`, where `rect` is the node's measured box). A just-inserted empty `section`/`grid` renders with no children → near-zero height. `canvas.css` gives `.canvas-dropzone` **no `min-height`** (verified — only `position/opacity/border/background`). So the drop zone for an empty container is a 1–2px sliver you cannot reliably hit. This is the owner's exact report: "drop an element, then try to drop another INSIDE it → it won't nest." Reference platforms all solve this with an explicit empty-container placeholder: Webflow's empty-div hint, Puck's `<DropZone>` min-height, Craft.js's `is-empty` canvas node, Gutenberg's block-appender.

**Cause B — a rejected nest silently redirects to page root (no feedback).**
`resolveInsertPlan(page, selectedId, type)` (`insertNode.ts` L166) tries, in order: (1) nest into the selected container if `nestAccepts(selected.type, type)`; (2) else page top-level; (3) else auto-wrap; (4) else blocked. When the target slot's content-model does not admit the child (e.g. a `grid` slot whose `accepts`/`acceptsCaps` excludes `section`), candidate 1 fails and the node lands at **page root** (candidate 2/3). To the user the block "jumps to the top" — indistinguishable from a jam, with no rejection cue.

**Cause C — the overlay drop gate is a divergent, capability-blind second reading of the contract.**
`handleDrop` (`CanvasOverlay.tsx` L250-253) accepts a drop by reading **`d.slot.accepts` only** (the identity allow-list) plus an auto-wrap check — it never consults `slotAdmits`/`acceptsCaps`. It treats empty `accepts` as "open," which happens to defer the real decision to the host's `resolveInsertPlan`. But it is a **second, looser reading of the same content-model** the grammar owns (`slotAdmits` in `slice-meta.ts`). A slot that gates purely by capability (`acceptsCaps: ['flow']`, `accepts` empty) is read here as "accepts anything," diverging from the grammar. This is an ISP/DRY smell and the seam where future drift will live.

**Cause D — no per-index precision, no insertion indicator.**
Every slot's drop zone is one full-size rectangle; there are no inter-child gaps and no blue insertion line. A drop always appends (index defaults to end in `addNodePatch`/`insertNodePatch`). The author cannot place a block *between* two siblings on the canvas — only the Outline tree offers ordering. "Management is hard" = there is no positional drop and no visual insertion feedback on the canvas.

### 1.3 Why there is NO MOVE

The store **has** the move engine: `moveNodePatch` (`constructor.pages.ts` L188) detaches a node from its current container and re-inserts it at `(parentId, index)`, guarded against nesting into its own subtree (`isDescendant`) — exposed as `moveNode`. The **Outline tree already uses it** via dnd-kit (`OutlineTree.tsx` `handleDragEnd`). But on the **canvas**:

- Node frames are plain `<button>`s with `onClick` (select) + metric-drop handlers **only** — **no `draggable`, no `onDragStart`** (verified: grep for `draggable|onDragStart` in `CanvasOverlay.tsx` returns nothing).
- `CanvasViewProps.onMoveNode` is declared *"Reserved for node-to-node moves"* (`CanvasView.tsx` L98) and **never threaded to `CanvasOverlay`** nor implemented.

So: the move capability exists in the model and in the tree, and is **entirely absent on the canvas** — no drag source, no reorder wiring.

### 1.4 Two drag systems today (the reconciliation point)
- **Native HTML5 DnD** — palette → canvas. `NodePalette.tsx` tiles are `draggable` and write `dataTransfer('nodeType')`; the overlay drop zones read it back.
- **dnd-kit** — the Outline tree (`SortableContext` + shared `PointerSensor`/`KeyboardSensor`).

The manipulation system must **converge these into one**, not add a third.

---

## 2. The canonical model (grounded in THIS codebase)

### 2.1 One law: a drop's validity IS the composition grammar
The single predicate is already built and already shared by the palette, the render-time guard, and the composite-integrity invariant:

```
slotAdmits(slot: {accepts?, acceptsCaps?}, child: {type, caps}) : boolean
  // open (neither declared) ⇒ any; identity match (type ∈ accepts);
  // capability match (caps ∩ acceptsCaps); else reject.        [slice-meta.ts]
nestAccepts(parentType, childType)  // slotAdmits over the parent's slots  [insertNode.ts]
```

**Every** drop decision — palette insert, canvas move, tree drop, insertion-index resolution — reads THIS predicate and no other. Nesting into a grid, a section, a columns block, or any future container **falls out of the declaration**: a container declares `slots[].accepts`/`acceptsCaps`; a content block declares `caps: ['flow']`. Zero per-type drop code. (This is the homoiconic ideal already realized for the palette — extend it to the drop surface.)

### 2.2 The droppable/draggable projection (dnd-kit)
For every framed node the overlay already computes (`nextFrames`), register:

| dnd role | id | data payload | source of truth |
|---|---|---|---|
| **droppable** (one per slot) | `${nodeId}::${slotKey}` | `{ parentId: nodeId, slotKey, accepts, acceptsCaps }` | `nodeRegistry.getSlots(type,variant)` |
| **empty-slot placeholder droppable** | `${nodeId}::${slotKey}::empty` | same + `empty:true` | slot with zero children |
| **draggable** (drag source) | `nodeId` | `{ nodeId, type, caps, parentId, slotKey }` | the node frame |
| **draggable** (palette tile) | `palette:${type}` | `{ kind:'insert', type, caps }` | `NodePalette` tile |

The **droppable ref is set on the existing overlay frame div** — dnd-kit measures the real, already-tracked geometry; no parallel geometry engine. Collision detection (`pointerWithin` composed with `closestCenter`, biased to the **innermost** accepting droppable) picks the target slot under the pointer. The accept filter on every droppable is `slotAdmits(slotOf(droppable), dragData)` — a rejecting droppable is skipped by collision, so an invalid nest is **structurally unreachable** (not silently redirected).

### 2.3 Insertion index + the blue line (projection, not new state)
Within the resolved target slot, the overlay already holds each child's `rect` (in `nextFrames`). The **insertion index** = count of children whose mid-axis precedes the pointer (vertical slot → Y; horizontal/grid → X, read from the slot's layout). Render the **insertion indicator** as a 2px accent line at the gap between `child[i-1]` and `child[i]` (or spanning the empty-slot placeholder). This is `f(target slot rect, insertion index, child rects)` — a pure projection, mirroring Webflow's blue line and dnd-kit's `SortableContext` gap.

`DragOverlay` renders the dragged tile/node ghost following the cursor (the field-standard drag affordance), decoupled from the source's DOM.

### 2.4 The write — reuse the existing engine verbatim
- **Palette insert** (drag source `palette:*`): `resolveInsertPlan(page, targetParentId, type)` → `planInserts(plan, type, makeId)` → `insertNodes(pageId, ops)`. **One extension:** thread the resolved **index** into `planInserts`/`InsertOp`/`insertNodePatch` (the reducer already accepts `index` — `insertNodePatch(s, pageId, node, parentId, index)`; only the plan→ops compiler drops it today). Byte-identical to ⌘K/slash otherwise (the V6 invariant holds).
- **Canvas move** (drag source = nodeId): `moveNode(pageId, nodeId, targetParentId, index)` — already exists, already descendant-guarded. No new reducer.
- **Validity** at both: `nestAccepts(targetParentType, draggedType)`. The overlay's divergent `accepts`-only gate (Cause C) is **deleted** and replaced by `slotAdmits`.

### 2.5 One drag model across canvas + palette + tree
Palette tiles become dnd-kit `useDraggable` (retiring native HTML5 `dataTransfer`); the canvas mounts a `DndContext` with the shared `useDndSensors`; the Outline tree already lives in one. A palette→canvas insert and a canvas→canvas move flow through the **same collision + insertion pipeline**, differing only in the terminal write (`insertNodes` vs `moveNode`). The tree and the canvas share the SAME `moveNode` write, so a reorder is byte-identical across surfaces (already true for the write; this makes the *gesture* uniform).

---

## 3. Phased build (Strangler — each slice shippable + LIVE-provable)

> Reversible increments. Each ends with a Playwright drag-drop leg that proves the capability against the live app. Ordered so the owner's felt jam is fixed FIRST.

**Slice 0 — grammar unification (invisible, enabling).**
Replace `CanvasOverlay.handleDrop`'s `accepts`-only gate (Cause C) with `slotAdmits`/`nestAccepts`. No UX change. *Fitness:* `FF-DROP-GATE-IS-GRAMMAR` — the overlay's accept decision === `nestAccepts` for every (slot, type) pair (property test over the registry). Removes the divergent second reading before anything is built on it.

**Slice 1 — DROP-TO-NEST + insertion indicator + empty-container placeholder (THE FIX).**
- Render an empty-slot **placeholder droppable** with a real `min-height` hit area ("Drop here") for every slot with zero children — kills Cause A directly.
- Resolve nearest accepting slot + insertion index; paint the blue insertion line.
- Thread the index into `planInserts`→`insertNodes` (Cause D).
- Flip the palette to dnd-kit here so Slice 1 already runs on the target primitive; mount the canvas `DndContext`.
- *LIVE proof (Playwright):* drop a `section` on the page → drop a `chart` INTO the section → assert the chart is a **child of the section** in the persisted config (the owner's exact broken flow). *Fitness:* `FF-EMPTY-CONTAINER-DROPPABLE` — every container renders a hit area ≥ N px tall when empty.

**Slice 2 — DRAG-TO-MOVE / reorder on the canvas.**
- Each node frame becomes a dnd-kit `useDraggable` with a visible **drag handle** (on hover/focus).
- Drop = accepting slot + index; write = `moveNode` (descendant guard already enforced).
- Reuse Slice 1's insertion line + `DragOverlay` ghost. Thread the previously-dormant `onMoveNode` through `CanvasView → CanvasOverlay`.
- *LIVE proof:* drag a block below its sibling → order changes; drag it into a container → reparented; drag a container onto its own child → **no-op** (guard). *Fitness:* `FF-MOVE-NO-SELF-NEST` (already covered by `moveNodePatch`; assert at the overlay).

**Slice 3 — Navigator (Outline) ↔ canvas parity.**
Replace the tree's heuristic "candidate A/B" nest guess (`OutlineTree.handleDragEnd` L96-117) with the SAME explicit slot-droppable + insertion-line model (drag-to-reparent, positional). One collision model, one `moveNode` write across both surfaces. *Fitness:* `FF-CROSS-SURFACE-PARITY` — a tree reorder and the equivalent canvas reorder produce byte-identical `nodeIds`/`childIds`.

**Slice 4 — a11y + polish (WCAG 2.1 AA).**
Keyboard move on the canvas (the shared `KeyboardSensor` is already wired for the tree), `aria-live` grab/move/drop announcements, focus restoration to the moved node post-drop, drag handles keyboard-reachable. Bring the canvas to the tree's existing keyboard-drag parity. *Fitness:* `FF-CANVAS-KEYBOARD-MOVE` — a node is movable end-to-end with keyboard only.

### 3.1 Reconciliation with the two concurrent canvas agents
- **tables-reachability** and **chrome-in-canvas** both add more *framed* elements on the **PART/selection axis** (value/sourced parts, chrome regions) — these are NOT node-containers (`isNodeContainer` is false; they declare no `slot` part), so they are correctly **selection-only, never drop targets**. This SPEC operates on the **SLOT axis** (node containers). The two axes are orthogonal: their new frames need zero manipulation code, and this SPEC touches no part/chrome selection logic. No code collision (this SPEC writes none until built).

---

## 4. Ideology fit (Bounded-Element / config-as-SSOT)

- **The drop model is a pure projection of the composition grammar.** Droppable set = `nodeRegistry.getSlots(node)` for every framed node; accept predicate = `slotAdmits(slot, {type, caps})`. A new container is a `slots` declaration; a new nestable is `caps:['flow']`. **Zero per-type drop code, zero registration** — the anti-pattern (a hand-wired per-container drop handler) never appears. This satisfies OCP · DIP/ISP · Composite exactly as the palette already does.
- **One declaration → every surface.** The slot content-model already projects to: render placement (`renderNode` guard), palette narrowing (`nestAccepts`), and composite integrity. This SPEC makes it also project to **drop acceptance, insertion-index validity, and move validity** — collapsing four surfaces onto one contract. Slice 0's deletion of the overlay's `accepts`-only gate REMOVES the last divergent reading — a net improvement, not just parity.
- **Config = SSOT, deterministic write.** Both gestures commit through the existing pure reducers (`insertNodePatch`/`moveNodePatch`) — no new mutation path, lossless round-trip preserved, undo/redo already composed at the store.
- **Law 3 held.** All manipulation lives in `apps/panel` overlay; the engine renderer stays pointer-events:none and editor-unaware. No renderer fork.

---

## 5. ADR — Adopt dnd-kit for a unified canvas+palette+tree drag model

**Decision.** Converge the canvas and palette onto **dnd-kit**, in one `DndContext` with the shared sensors, matching the Outline tree; the drop/insertion/validity layer is a projection of `slotAdmits`.

**Trade-off (ISO 25010).** Gain: usability (insertion feedback, precise placement), accessibility (keyboard drag AA), maintainability (one drag model, one predicate). Cost: modifiability churn during the palette's native→dnd-kit flip (mitigated: Slice-scoped, reversible); a small learning surface for `DragOverlay`/collision composition.

**Rejected alternatives.**
1. **Keep native HTML5 DnD; only fix geometry (empty-container placeholder + per-index zones), no dnd-kit.** Rejected: leaves TWO drag systems (canvas HTML5 + tree dnd-kit) permanently forked; keyboard a11y, `DragOverlay`, and collision must be hand-built; no path to cross-surface parity (Slice 3). Fixes the jam but entrenches the split — sub-standard.
2. **Build a bespoke overlay collision/insertion engine** (custom hit-testing + insertion math). Rejected: reinvents dnd-kit's core, from-scratch keyboard a11y, high maintenance, off the field standard — violates "ship capabilities, not one-offs."
3. **Fork the engine renderer to make containers directly droppable** (drop handlers inside `NodePageRenderer`). Rejected: violates Law 3 (engine stays app-agnostic + editor-unaware) and collapses the two-layer model; the engine must not know the editor exists.

**Fitness functions (make each invariant executable).**
- `FF-DROP-GATE-IS-GRAMMAR` — overlay accept === `nestAccepts` for all (slot, type).
- `FF-EMPTY-CONTAINER-DROPPABLE` — every empty container exposes a ≥ N px drop hit area.
- `FF-MOVE-NO-SELF-NEST` — a move into own subtree is a no-op (surfaced at the overlay).
- `FF-CROSS-SURFACE-PARITY` — tree reorder == canvas reorder, byte-identical config.
- `FF-CANVAS-KEYBOARD-MOVE` — a node is movable keyboard-only, end to end.
- `FF-NO-PER-TYPE-DROP` — no drop/move code branches on a concrete container type (grep gate, mirrors `noExternalSpecialCase.fitness.test.ts`).

---

## 6. Epilogue (answers to the brief's four asks)

- **Jam root cause (1 line):** empty containers render with no min-height placeholder droppable → un-hittable drop rect, and a content-model-rejected nest silently redirects to page root — both read as "won't nest."
- **Canonical model (1 para):** see §0 / §2 — drop validity = `slotAdmits`; overlay registers slots as droppables + nodes as draggables; nearest accepting slot + insertion index → blue line; commit via existing `insertNodes`(index-aware) / `moveNode`(guarded); one dnd-kit model across canvas + palette + tree.
- **Recommended primitive:** dnd-kit — **YES** (the tree already uses it; unifies the two drag systems; keyboard a11y + sortable + `DragOverlay` for free).
- **First buildable slice:** Slice 1 — drop-to-nest + insertion indicator + empty-container placeholder, proven by a Playwright leg dropping a chart INTO a just-dropped section.
