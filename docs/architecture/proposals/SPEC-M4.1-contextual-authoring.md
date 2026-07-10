# SPEC — AR-49 M4.1: Contextual Authoring in Every Surface (Idea 6)

> **Companion to** `SPEC-authoring-reconception-M4-ia-canonical.md`. **Scope:** `platform/apps/panel` only for everything that ships in this doc; the nested-*item* edit case references the main spec's owner-gated engine seam (§2.10 / D7) and is NOT re-designed here.
> **Author:** platform-architect (sole author, as with the M4 canonical spec).
> **Status:** DESIGNED — two build threads, each independently routable.
> **Predecessor idea:** the owner selected a `filter-bar` (2026-07-10) and observed two gaps: (1) the LEFT Insert dock still shows ALL blocks, not only the ones that can go *into* the selected container — "we know its schema, we know what child content it accepts; the left dock should show only compatible elements"; (2) he cannot "go all the way in" — clicking the filter-bar gives no way to select/edit its inner elements at depth. He wants maximal canonicity and a panel that nudges ("tell you what to do").
> **Why a companion, not in-place:** the main M4 spec is at the 450-line hard ceiling. Idea 6 is a coherent standalone theme that *extends by reference* (§1.5 doctrine, §2.3 palette, §2.9 Navigator, §2.10 Inspector, §2.11 right dock) rather than duplicating them — so it earns its own focused doc and one cross-reference line in the main spec.

---

## 1. The unifying law — Contextual Relevance in Every Surface

**This is the successor generalization of §1.5's "the tool leads; only what's needed, everywhere, always" — extended, by reference, into a surface law. Do not restate §1.5; this specializes it to the three authoring surfaces:**

| Surface | Contextual question it answers | Driven by the current selection via… |
|---------|-------------------------------|--------------------------------------|
| **Left dock (Insert palette)** | *What can I ADD here?* | the selected slice's declared slots / `accepts` + `canHaveChildren` (Thread A) |
| **Right dock (Inspector)** | *What can I EDIT here?* | the selected node's PropSchema (main §2.10 / §2.11, Wave 7 — in flight) |
| **Canvas + Navigator + breadcrumb** | *How do I GO to any depth?* | the selection's ancestor chain + drill scope (Thread B) |

All three are **projections of the same selection state** — the left dock is the twin of Wave 7's right dock. The owner's recurring "only what's needed" becomes an architectural law: **every surface narrows to the current selection's contextual relevance, and none of them ever blocks a legal action** (the §1.5 boundary holds — the only refusal is structural impossibility, never workflow order).

**"In no case worse than now" (the §8 guarantee, extended):** Thread A *adds* a positive filter where today the palette offers incompatible tiles that silently mis-route (worse than nothing — see §2.1); with nothing selected the palette shows today's full frame-level set unchanged. Thread B *adds* a drill gesture + breadcrumb where today nested elements on the canvas are unreachable; the Outline's existing any-depth selection is untouched. Both are strict supersets.

---

## 2. Thread A — Context-aware Insert palette (schema-driven insert constraints)

### 2.1 The exact seam (verified in code) — the accept-set is ALREADY declared

The compatibility rule Idea 6 asks for **already exists and is already modeled** — it is simply *unsurfaced* as a palette filter:

- **`SlotDef.accepts?: string[]`** on `NodeSliceMeta.slots` / `PageSliceMeta.slots` (`packages/react/src/engine/slice-meta.ts`). Its own doc-comment reads: *"Constructor reads: which types can be dragged into this slot? Engine reads: validation when loading config."* This is the Builder.io slots pattern. `accepts` absent/empty ⇒ any type. Containers declare it (e.g. `SectionSlots`, `GridSlots`, `CardSlots`, `ColumnsSlots`).
- **`NodeSliceMeta.canHaveChildren?: boolean`** — the leaf/container discriminant. `PanelSliceMeta` pins it to the literal `false` (chart/table/kpi are always leaves — "a leaf has no insertion targets, so the Constructor's drag-and-drop accept logic never offers a panel as a drop zone").
- **`nestAccepts(parentType, childType)`** in `apps/panel/src/canvas/insertNode.ts` — the apps-side **SSOT compatibility predicate**, already shared by the Outline drag, the palette drop, the Cmd-K insert, and `resolveInsertParent`. It reads `nodeRegistry.getSlots(parentType)` and returns "does any slot accept this child."

**So the compatibility RULE is live but expressed only NEGATIVELY** — `resolveInsertParent` consults `nestAccepts` and, when the selection can't hold the type, **silently redirects the insert to page top-level**. The author selects the filter-bar, drags a block, and it lands somewhere else with no explanation. That silent redirect is *worse than not offering the tile*. Idea 6's fix: surface the same rule as a **positive palette filter** — offer only what will actually nest where shown.

### 2.2 The ONE refinement (still apps-only) — separate "leaf" from "open container"

Today `nestAccepts` returns `true` for **any** slot-less parent (`if (!slots) return true` — leaf/undeclared → permissive). This **conflates two distinct questions** the palette must keep separate:

1. *Is this node a drop target at all?* → `canHaveChildren === true` (leaves accept nothing).
2. *Which types may it hold?* → `slots.accepts` (empty ⇒ any).

The canonical predicate consults **both** (both already-declared meta — no new field, no packages change):

```
isDropTarget(parentType)          = getMeta(parentType)?.canHaveChildren === true
paletteAccepts(parentType, child) = isDropTarget(parentType)
                                    && (slotsEmptyOrOpen(parentType)
                                        || unionOfSlotAccepts(parentType).includes(child))
```

- **Palette filter:** with a container selected → `insertables.filter(t => paletteAccepts(selectedType, t))`, still capability-gated to the active dataset + led by the fit-for-data "Recommended" section (§2.3 unchanged). With **nothing** selected → page/frame-level insertables (today's full set, root accepts any top-level node).
- **Kill the silent-fail:** `resolveInsertParent` adopts the same `isDropTarget` gate so a leaf is never a nest target — the redirect stops being silent because the palette never offered an incompatible tile in that context in the first place. Palette-offered ⇒ actually-nests-where-shown becomes an invariant (FF-PALETTE-CONTEXTUAL).

**Behavior change to flag (D-M4.1-A, below):** refining `nestAccepts` to require `canHaveChildren` changes insert *routing* for slot-less selections (a chart/filter-bar selected no longer silently swallows an insert). This is the *correct* behavior and matches the owner's intent, but it is a routing change — hence a recorded decision, not a silent edit.

### 2.3 The filter-bar honesty (the owner's exact example)

The filter-bar has **no `slots`** and does not set `canHaveChildren` — it is a **leaf in the node tree**. Its inner content (the filter bars/controls) are `sliceType:'control'` (`FilterControlMeta`, e.g. `year-select` / `cascade` / `select`) declared in the page **`filterSchema`**, a *separate taxonomy tier*, not node children. Therefore:

- The context-aware palette, with a filter-bar selected, correctly offers **no node-insert tiles** — and the doctrine's guided empty-state pivots the author to the right surface: *"A filter-bar renders your page's filter controls — edit its bars in the Inspector"* (its `barIds` schema, main §2.10) or the filterSchema editor.
- **We do NOT invent a cross-tier slot.** Modeling "filter-bar accepts filter controls" via `SlotDef.accepts` would be a category error — `accepts` holds node **type** strings; controls are not nodes. The honest canonical answer is: the filter-bar's "go inside" is a *filterSchema/control-tier* edit reached through the Inspector, not a node-tree descent. (Flagged to the lead: the owner's mental model of "inner elements" spans two tiers; the palette telling the truth about which is which is itself the guidance.)

### 2.4 Is Thread A apps-only? (yes) — and the only scenario that would cross the arrow

**Thread A is apps-only and NOT a one-way door.** The accept-set (`slots.accepts`) and the leaf discriminant (`canHaveChildren`) are already declared in `packages/plugins` and already read by apps' `nodeRegistry`; the palette filter and the `nestAccepts` refinement are pure apps-side reads/logic.

The **only** scenario that would need additive packages metadata: if a container ever needs to accept children **by capability** rather than by explicit type-string (e.g. "this slot accepts *any data panel*"). That would need an additive `SlotDef.acceptsCaps?: NodeCap[]` in `packages/react` — OCP-clean but arrow-crossing. **Recommendation: do NOT add it now (YAGNI).** Every current container enumerates types; `accepts: string[]` + `canHaveChildren` fully covers today's needs. Flagged only so the future field, if ever needed, is a conscious owner-gated change and not an accident.

### 2.5 Placement, benchmark, our-better

- **Wave placement:** extension of **Wave 1** (Insert palette elevation) — apps-only; no additive slice metadata required.
- **Files/areas:** `canvas/NodePalette.tsx` (contextual filter over the registry-derived tiles), `canvas/insertNode.ts` (`nestAccepts` reads `canHaveChildren`; `resolveInsertParent` shares the `isDropTarget` gate), the palette empty/guided-state for "selection accepts nothing" (`studio/StudioEmptyState.tsx`, the §2.1 doctrine component).
- **Benchmark:** Gutenberg `allowedBlocks`/`parent`; Webflow valid-drop highlighting; Puck `DropZone allow`; Sanity `array of`; Builder.io `canHaveChildren`. **Our-better:** compatibility is **derived from the slot schema** (OCP — no hardcoded parent×child matrix; a new container declares `accepts` once and both the palette filter and the insert router honor it), still dataset-capability-gated, and it surfaces the **same rule the insert path already applied silently** — turning a worse-than-nothing silent redirect into positive, honest guidance.

**FF-PALETTE-CONTEXTUAL** — with a container selected, the palette offers exactly the schema-compatible child set: (a) no tile is offered for which `paletteAccepts(selected, tile)` is false; (b) every offered tile actually nests into the selection (no `resolveInsertParent` redirect for a palette-offered type); (c) with nothing selected, the palette equals the frame-level set. Testable against fixtures per container type.

---

## 3. Thread B — Drill to any depth (navigate + edit the full nesting)

### 3.1 What already works (do not rebuild)

Selection is **already addressable to any depth**: the store's `selectNode(nodeId)` sets a single `selectedId` that may be *any* node in the tree, and the **Outline/Navigator** (`outline/OutlineTree.tsx`) already renders the full tree with WAI-ARIA roving keyboard nav (↑/↓ move, ←/→ collapse-or-ascend / expand-or-descend) and `onSelect={selectNode}` on every row at every depth. The **Inspector already opens for the selected node regardless of depth** (it reads `schemaSource.getSchema(node)`, main §2.10 Seam-2). So "select and edit a node at depth N" is *already possible via the Navigator*.

The gaps the owner hit are on the **canvas** and in **orientation**: clicking a nested element does not drill into it, and nothing shows *where* the current selection sits in the hierarchy.

### 3.2 The three moves (canvas drill + breadcrumb apps-only; Navigator depth Wave 10)

1. **Canvas drill gesture (apps-only).** Figma's model: single-click selects the outermost node under the cursor; **double-click enters** that container (sets a UI-local "drill scope") and selects the child under the cursor; **Esc exits** to the parent scope. Because the store already accepts any `nodeId`, this is purely a canvas-interaction layer that resolves "which nested node is under the cursor at the current drill depth" → `selectNode(childId)`. The drill scope is apps-local UI state (never config). Lands adjacent to **Wave 7** (right dock, in flight).

2. **Selection breadcrumb (apps-only) — the lead's Idea-5 breadcrumb, made the drill-out control.** Compute the ancestor chain of `selectedId` by a pure walk of the page node tree (the store already holds `childIds`; an ancestor map is a read, never a write) and render `Section › Filter-bar › Control` at the top of the dock. Clicking an ancestor selects it (drill-out); it doubles as orientation ("you are here"). Lands adjacent to **Wave 7** (sits above the Inspector in the dock).

3. **Navigator depth (Wave 10).** The Outline already descends to any depth; main §2.9 / Wave 10 completes it by rendering the **chrome tier** above sections/nodes as one legible tree (`FF-NAVIGATOR-FULL-HIERARCHY`). Thread B names the Navigator as the **tree-twin** of the canvas drill + breadcrumb — three views of one selection, all reaching any depth.

### 3.3 The honest split — "navigate all the way in" (now) vs "edit all the way in" (D7)

This is the crux the lead asked to make explicit:

- **Select / navigate to any *node* at any depth = apps-only, ships now** (drill gesture + breadcrumb + Navigator). Every node in the tree is reachable and its Inspector opens.
- **Edit to any *nested non-node item* = gated on D7.** Some "inner elements" are **not separately-selectable nodes** — they are array/object items inside one node's props (e.g. a `HeroNode.cards[]` entry's `title`/`color`, main §2.10 layer 2). Those items have no `nodeId`; they cannot be selected on the canvas — they are edited *inside their owner node's Inspector*. Rendering their sub-fields needs the additive nested `itemSchema` PropField discriminant in `packages/react/engine` — **the owner-gated engine seam (main §2.10 tier c / D7)**. Until D7 lands they stay in the visible, shrinking `SCHEMA_TODO` allowlist.

So: **"select/navigate all the way in" is apps-only and reachable now for every node; "edit all the way in" is fully reachable for every *node* now, and for every nested *item* once D7's `itemSchema` renders.** No node depth is ever unreachable; the only deferred case is *editing* a sub-item that was never a node — and that boundary is documented, not hidden.

### 3.4 Placement, benchmark, our-better

- **Wave placement:** breadcrumb + canvas drill gesture → **adjacent to Wave 7** (right dock); Navigator chrome-tier depth → **Wave 10** (§2.9); nested-item edit → **gated on D7** (§2.10 tier c).
- **Files/areas:** `canvas/CanvasView`/overlay (drill gesture + drill-scope UI state), a pure `selectionAncestry` read over the page tree, `studio/RightDock.tsx` (breadcrumb slot above the Inspector — pairs with Wave 7), `outline/OutlineTree.tsx` (chrome tier, already Wave 10).
- **Benchmark:** Figma click → enter → breadcrumb-up; Webflow / Framer Navigator depth. **Our-better:** the breadcrumb is a **pure ancestor-walk of the one config tree** (SSOT, no parallel structure to keep in sync), the drill gesture reuses the **existing any-depth `selectNode`** (no new selection model), and the reach is **honestly bounded** — node-depth apps-only now, nested-item gated on a single owner-blessed engine discriminant — so "no depth unreachable" is a checkable guarantee, not a claim.

**FF-DRILL-ANY-DEPTH** — for a page tree nested to arbitrary depth K: (a) every `nodeId` is selectable via both the Navigator and the canvas drill gesture; (b) selecting the deepest node yields a non-null Inspector context and a full-length breadcrumb terminating at the page root; (c) no code path renders a "not selectable / unreachable at this depth" branch. Testable against a K-deep fixture.

---

## 4. Fitness map (this companion's rows — fold into the main §5 when the ceiling allows)

| Invariant | Fitness function | Wave |
|-----------|------------------|------|
| Insert palette offers exactly the schema-compatible child set for the selection; no silent mis-route | **FF-PALETTE-CONTEXTUAL** | Wave 1 (extend) |
| Every node at any depth is selectable (canvas or Navigator) and its Inspector opens | **FF-DRILL-ANY-DEPTH** | adj. Wave 7 · Wave 10 |

Both preserve the main spec's invariants — in particular **FF-NO-WORKFLOW-GATE** (the contextual palette *narrows*, it never *blocks*: a legal insert is always reachable by selecting a compatible container or clearing the selection) and **FF-PALETTE-META-DRIVEN** (the filter is a derivation over registry meta, not a hardcoded matrix).

---

## 5. Decision (one-way-door / owner check)

- **D-M4.1-A — Refine `nestAccepts` to require `canHaveChildren` (Thread A).** *Architect-decided; flagged for visibility.* Today `nestAccepts` treats every slot-less parent as permissive, conflating "leaf" with "open container" and causing the silent insert-redirect the owner hit. The refined predicate gates on `canHaveChildren === true` before consulting `accepts`. **This is apps-only** (reads already-declared plugin meta) and is the correct behavior, but it changes insert *routing* for slot-less selections (a selected leaf no longer swallows an insert). **Reversible** (a predicate change, no stored-contract impact). Recommendation: adopt — it is the root-cause fix for the silent-fail, and it is the precondition for FF-PALETTE-CONTEXTUAL clause (b).
- **Not a new one-way door:** Thread A adds no packages metadata (the only arrow-crossing scenario — `SlotDef.acceptsCaps` for capability-level accept — is explicitly deferred, §2.4). Thread B's node-depth work is apps-only; its nested-*item* edit rides the **existing** D7 (main §2.10 / §6) — no new engine seam is introduced here.

---

## 6. Capability-parity guarantee

Both threads are strict supersets (main §8 doctrine): Thread A *adds* a positive filter and *removes* a silent mis-route (nothing-selected still shows the full frame-level palette); Thread B *adds* a canvas drill gesture + breadcrumb and *removes* the unreachable-nested-element dead-end (the Outline's existing any-depth selection is untouched, no node becomes less reachable). The dependency arrow, Config-is-SSOT, role-is-lens, and the §1.5 non-blocking boundary all stand. The single deferred capability (editing a nested non-node *item*) is gated on the already-flagged D7, not a new exception.
