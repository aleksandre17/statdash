# SPEC — The Authoring Experience Architecture (the ONE interaction model)

> **Status:** decision-grade study (READ-ONLY; no code). Author: platform-architect, 2026-07-13.
> **Commission (owner, verbatim intent):** *stop fixing elements one-by-one; architect the ENTIRE Constructor/authoring experience as ONE coherent, future-proof body — like Webflow/Framer are one interaction model, not a pile of features.* Symptoms (all REAL, code-verified): nesting jams (can't drop into a container), no drag-to-move/reorder, tables unreachable, chrome not on canvas, thin inspectors, "management is hard."
> **This is the ONE unifying doc.** It does NOT fork a parallel SSOT. It NAMES the single missing architectural root and folds the three in-flight fixes (chrome-in-canvas · tables/facet-universality · drag-drop) into one path. The subordinate SPECs are re-pointed here (§8), never duplicated.
> **Extends (never forks):** ADR-038 (Bounded Element Law) · **ADR-041 (Part grammar + Part port — THE substrate)** · ADR-039 (Composite selection) · SPEC-studio-ia-canonical (surface arrangement) · SPEC-deep-authorability-completion (the Facet/Inspect projection) · NORTH-STAR-unified-declarative-instrument.
> **Governing laws:** CLAUDE.md Law 1 (no privileged types), Law 2 (declarative), Law 6 (root-cause), Law 7 (Strangler), Law 8 (OCP — new capability = declaration), ADR-041 (one Part grammar, adapters keyed by residence never type).

---

## 0. TL;DR — the one finding that dissolves all six symptoms

**Authoring an element is THREE projections of ONE model — Select · Inspect · Manipulate — and the platform built only TWO of them as projections.** The model is the **Part address space** (ADR-041): `(PartAddress, declared contract, accept-set)`. Every authoring surface should be `f(that model)`, naming no concrete type:

| Projection | Question | Onto | State today |
|---|---|---|---|
| **SELECT** (reach) | *which part is under my cursor / focus?* | canvas frames · navigator rows | ✅ **is a projection** — `CanvasOverlay` recurses `enumerateParts`; ONE `PartAddress` (ADR-041 Ph.3) |
| **INSPECT** (author contract) | *what can I edit about the selected part?* | right dock | ⏳ **projection, half-built** — `projectParts` done; `projectFacets` (style/data/events/chrome) designed (SPEC-deep-authorability-completion) |
| **MANIPULATE** (restructure) | *place / move / nest / reorder / remove this part* | canvas · navigator · palette | ❌ **NOT a projection** — forked, node-tree-only, present on ONE surface, over TWO drag transports |

Select and Inspect were lifted onto the Part port. **Manipulate never was.** It survives as the *pre-ADR-041 world*: ad-hoc, residence-blind, surface-specific machinery — which is the exact shape ADR-041 diagnosed for containment ("four grammars asking the same question once each") and SPEC-deep-authorability-completion diagnosed for the Facet axis ("TS structure, not a projectable contract"). **This is the same root a third time, on the manipulation axis.**

**The missing root primitive:** `writePart`'s **structural sibling** — a **Placement port** (`placePart`/`movePart`/`removePart`) on the SAME `PartSource` interface, residence-routed, emitting the SAME residence-tagged `PartMutation` union (the `node-children` arm is *already reserved* in the code, `partPort.ts:165`, waiting for exactly this). Add it, drive it by **ONE gesture transport**, resolve it through **ONE `PlacementPlan`** (generalizing `InsertPlan` to `insert | move | reparent | reorder | remove`), gate it by the **ONE `slotAdmits`** already shared — and reach·drag·drop·nest·move·reorder·remove·insert become one grammar over every surface. The six symptoms stop being bugs to patch and become **states the architecture cannot represent.**

The homoiconic ideal (one declaration → every surface) is two-thirds built. It completes when **Select ⊥ Inspect ⊥ Manipulate** are all three projections of the one Part model.

---

## 1. Fragmentation diagnosis — the ROOT, code-cited (not the leaves)

### 1.1 What is already ONE (keep — this is the proof the substrate holds)

- **The accept-set is unified.** `slotAdmits(slot, {type, caps})` (`slice-meta.ts:210`) is the ONE placement predicate — identity `accepts` ∪ capability `acceptsCaps`, HTML5 content-model grammar. Every consumer reads it: the canvas drop gate, the palette filter, the outline nest check, `renderNode` slot-placement, composite-integrity. **This is the one axis that was unified — which is exactly why insert-accept and outline-nest AGREE on legality even though everything AROUND them is forked.**
- **SELECT is a projection.** `CanvasOverlay.frameNode` (`CanvasOverlay.tsx:142–184`) recurses `enumerateParts` and frames slot children through the port, value/sourced parts by their `(field,index)` anchor — no per-type branch (`FF-NO-EXTERNAL-SPECIAL-CASE`, `FF-ONE-PART-GRAMMAR`). Chrome regions frame through the SAME `enumerateParts(SITE_FRAME_META)` (`CanvasOverlay.tsx:212`). Selection is ONE `PartAddress` (`useCanvasController.selectedBand`, ADR-041 Ph.3). **Reach *architecture* is correct; its gaps (§1.3) are completeness holes, not model holes.**

### 1.2 The ROOT — Manipulate is not a projection, it is forked machinery

**Finding A — TWO drag transports for ONE gesture class.**
- Canvas **insert** + metric-bind: **native HTML5 DnD** — `NodePalette` sets `draggable` + `dataTransfer('nodeType')` (`NodePalette.tsx:86–90`); `CanvasOverlay` reads it in `onDrop`/`onDragOver` (`CanvasOverlay.tsx:239–255`).
- Navigator **move/reorder/nest**: **dnd-kit** — `DndContext` + `SortableContext` + pointer/keyboard sensors (`OutlineTree.tsx:24–27, 162–169`).
- Two libraries, two event models, two a11y stories, two hit-test strategies — for what is one gesture ("pick a thing up, put it somewhere legal"). No shared transport, so nothing composes across surfaces.

**Finding B — MOVE exists on ONE surface only, and only for ONE residence.**
- `moveNode` (store, `constructor.pages.ts:188`) operates strictly on `page.nodeIds` + `node.childIds` — **slot residence / node-tree ONLY.** No value-item reorder, no sourced reorder, no chrome-region reorder.
- It is invoked from **`OutlineTree.handleDragEnd` alone** (`OutlineTree.tsx:85–125`). **The canvas has no move at all** — its node frames are selection-only `<button>`s whose only drag hooks are metric-bind (`CanvasOverlay.tsx:301–304`). *This is "no drag-to-move/reorder" precisely: move was hand-wired into the outline via dnd-kit and never projected onto the canvas.*

**Finding C — the nest-vs-reorder decision is an inline heuristic, not a resolved plan.**
- Insert has a principled resolver: `resolveInsertPlan` → `InsertPlan = direct | wrap | blocked` (`insertNode.ts:141–194`), the "insert-never-cliff" grammar.
- Move has **no plan type.** `OutlineTree.handleDragEnd` re-derives "Candidate A nest INTO / Candidate B sibling reorder" by hand each time (`OutlineTree.tsx:96–117`), with `isContainer` guessed from `childIds.length > 0 || hasChildren` and an index-shift fudge. *This fragile guess is "nesting jams": a drop that should nest resolves to a reorder (or vice-versa) because the decision is a local heuristic, not the shared, tested `Plan` the insert path already has.*

**Finding D — no structural method on the Part port.**
- `PartSource` (`partPort.ts:177–193`) exposes `enumerateParts` (read) + `writePart` (scalar subfield write) — and **nothing structural.** `PartMutation` already carries a `node-children` arm ("slot residence — lands with slotParts", `partPort.ts:165`) — **the substrate reserved the structural-write channel but no port method produces it.** So structural edits bypass the port entirely and hit `moveNode`/`insertNodes` directly, node-tree-only, un-generalized to value/sourced/chrome.

**The root, one sentence:** *the Part port was completed for READ (`enumerateParts`) and SCALAR-WRITE (`writePart`) but never for STRUCTURAL-WRITE, so the Manipulate projection had no port to be a projection of — and degenerated into two transports × one surface × one residence × an inline heuristic.*

### 1.3 Reach completeness holes (the SELECT projection's leaves) — same family

- **Anchor-stamping is a manual per-shell duty, not a derived guarantee.** The overlay measures `data-part-*` anchors that each shell stamps by hand. `PartAnchor` is stamped by `filter-bar` and `kpi-strip` shells (grep) — **not by the `table` shell** (`packages/plugins/panels/table/*` stamps none). So a table's columns (a `value` band by contract) emit no anchors → `enumerateParts` may enumerate them but the overlay finds no box → **"tables unreachable."** The whole-table node still frames via the `walkNodes` fallback (`CanvasOverlay.tsx:193`), but its PARTS do not. *Reach depends on every shell remembering to stamp — a duty the renderer should discharge, not each shell.*
- **Chrome is reachable but not manipulable.** S6 landed chrome-as-`sourced`-part selection (`canvasChromeSelectable.fitness`), so "chrome not on canvas" is largely closed for SELECT — but chrome *composition* (enable/reorder/move regions) has no manipulation home, because Manipulate isn't a projection (Finding B/D).

### 1.4 Why "management is hard" and "thin inspectors" fall out of the same root

- **Management** = Select + Manipulate + Navigator, coherently. Two of the three are forked, so "manage the page" means learning two drag models and one surface where move works — the incoherence the owner feels.
- **Thin inspectors** = the INSPECT projection's second axis (Facets) is unbuilt — already diagnosed and specced (SPEC-deep-authorability-completion): `inspect = projectParts ⊕ projectFacets`, facets are TS structure not a projectable contract. That SPEC owns the fix; this doc names it as one of the three projections so the *whole* is coherent.

**All six symptoms, one family:** an authoring capability that was NOT expressed as a generic projection of the Part model. ADR-041 fixed it for containment-read; deep-authorability-completion designs it for facets; **this SPEC fixes it for manipulation** — the last, loudest third.

---

## 2. The ONE authoring architecture — the Triprojection over the Part model

### 2.1 The model and its three projections (the canonical statement)

> **ONE model** = the **Part address space**: for every element, its parts are `PartField`s (slot/value/sourced), each part has a stable `PartAddress`, a declared `contract`, and an `accept-set` (`slotAdmits`). **Three orthogonal projections**, each onto **every surface**, each naming **no concrete type**:
>
> - **SELECT** `= project(enumerateParts) → { frames | rows }` — the same enumeration onto the canvas overlay AND the navigator tree AND (render side) the anchor a part carries. A gesture yields ONE `PartAddress`.
> - **INSPECT** `= projectParts(sel) ⊕ projectFacets(sel)` — the right dock; parts via `element.schema`, facets via `facetRegistry` (SPEC-deep-authorability-completion).
> - **MANIPULATE** `= resolvePlacement(source?, target, index) → PlacementPlan → placePart → PartMutation` — the **new** projection; one grammar for insert/move/reparent/reorder/remove, over every surface, residence-routed.
>
> A **new element** costs zero authoring code on any projection. A **new capability** costs ONE declaration (a `PartField`, a `FacetDescriptor`, or a residence adapter), the machinery unchanged (OCP). This is the homoiconic ideal, whole.

### 2.2 The missing primitive — the Placement port (ADR-041's structural-write completion)

Add a third method to the ONE `PartSource` interface — the exact peer of `writePart`, emitting the SAME residence-tagged `PartMutation` union:

```ts
// engine (packages/react/src/engine/partPort.ts) — the structural sibling of writePart.
interface PartSource {
  enumerateParts(...): EnumeratedPart[]                       // READ            (exists)
  writePart(..., subfield, value, ...): PartMutation | null   // SCALAR-WRITE     (exists)
  placePart(                                                  // STRUCTURAL-WRITE (NEW)
    element: Record<string, unknown>,
    op:  PlacementOp,          // { kind:'insert'|'move'|'reparent'|'reorder'|'remove', … }
    ctx: PartSourceContext,
  ): PartMutation | null       // → node-children (slot) · node-props (value) · filter-schema/site-chrome (sourced)
}
```

- **Residence-routed, exactly like `writePart`.** `slot` → the `node-children` mutation arm (already reserved, `partPort.ts:165`), committed via the existing `moveNode`/`insertNodes`/`removeNode` reducers. `value` → `node-props` with the reordered/spliced array (kpi cards, table columns). `sourced` → `filter-schema` (reorder filter controls) / `site-chrome` (reorder/enable chrome regions). **Adapters keyed by residence, never by type** (ADR-041 law) — so a new residence's structural edit is one adapter, the port signature unchanged.
- **This is not a new grammar** — it is the completion of the one that exists. `enumerateParts` proved read-projection; `writePart` proved scalar-write-projection; `placePart` is structural-write-projection. `FF-ONE-PART-GRAMMAR` extends to it: no structural edit outside the port.

### 2.3 ONE `PlacementPlan` — generalize `InsertPlan`, retire the inline heuristic

`InsertPlan` (`insertNode.ts:141`) already models "how does this land": `direct | wrap | blocked`. Generalize it to cover **all** structural gestures, so insert (from palette) and move (of an existing part) share ONE resolver and ONE legality path:

```ts
type PlacementPlan =
  | { kind: 'direct';   target: PartAddress; index?: number }   // legal drop into a site
  | { kind: 'wrap';     wrapperType: string; target: PartAddress }  // page → section → t (insert-never-cliff, KEPT)
  | { kind: 'reorder';  target: PartAddress; index: number }    // same-site reorder (value array / childIds / sourced keys)
  | { kind: 'reparent'; from: PartAddress; target: PartAddress; index?: number }
  | { kind: 'blocked';  reason: string }                        // guided hint, never an invalid tree
```

`resolvePlacementPlan(model, source?, target, index)` is `resolveInsertPlan` widened: `source === undefined` ⇒ insert (palette); `source` present ⇒ move/reparent/reorder. Legality is the ONE `slotAdmits`. **`OutlineTree.handleDragEnd`'s Candidate-A/B guess (`OutlineTree.tsx:96–117`) is deleted** — it becomes `resolvePlacementPlan` + `placePart`, byte-identical logic shared with the canvas. Nest-vs-reorder is a *resolved plan*, not a per-surface heuristic → "nesting jams" cannot recur.

### 2.4 ONE gesture transport — retire the native-HTML5 / dnd-kit fork

Unify on **dnd-kit** (the outline already uses it; it ships pointer + keyboard + touch sensors, WCAG-grade — native HTML5 DnD has no keyboard story, a Law 9 accessibility gap). The canvas overlay's palette drop, node move, item reorder, and chrome reorder all become dnd-kit draggables/droppables whose `onDragEnd` emits `resolvePlacementPlan` → `placePart`. **One `DndProvider` spans canvas + navigator + palette** (`shared/dnd/DndProvider.tsx` already exists) — so a part can be dragged *from the navigator onto the canvas* and *from the palette into a canvas container* through ONE transport, ONE plan, ONE port. The `dragging` reveal, drop-zones, and the metric-bind drag all fold into it as droppable kinds.

### 2.5 ONE reach guarantee — the anchor is a render-side projection, not a shell duty

Move anchor-stamping from each shell to the **generic renderer**: `renderNode` (which already walks parts) wraps every enumerated part in a `<PartAnchor field index>` automatically — the render-side twin of `CanvasOverlay`'s enumerate-projection. A shell **cannot forget** to stamp; a newly-registered element with a `value` band (a table's columns) is reachable **by construction**. `FF-EVERY-PART-ANCHORED`: for every element in the corpus, each part `enumerateParts` yields resolves to a measurable anchor. *Tables reachable becomes a corpus invariant, not a per-shell fix.*

### 2.6 Benchmark — how the leaders make this ONE model (validation)

| Platform | The one manipulation model | What we adopt |
|---|---|---|
| **Webflow** | Navigator + canvas are two views of ONE node tree; drag on EITHER reparents/reorders through the same op; drop legality = HTML content model | canvas ⊕ navigator over ONE `placePart`; `slotAdmits` = the content model |
| **Figma / Framer** | one drag engine; layers panel and canvas emit the same move; auto-layout = declared slots; nothing is a "chrome surface" | one dnd transport; chrome as a `sourced` part, manipulated identically |
| **Notion / Gutenberg** | "insert anything; the tool builds the structure" (auto-wrap); drag handle reorders blocks | KEPT — the `wrap` arm (insert-never-cliff) folds into `PlacementPlan` |
| **Builder.io / Puck / Plasmic** | one JSON tree; palette-insert and canvas-move are the same reducer; drop targets derived from component `accepts` | our `PlacementPlan` + registry `accepts`, already the shape |

**The convergence every leader shares and we do not (yet):** *one drag engine, one legality predicate, one structural op, projected identically onto canvas AND tree.* We already have the legality predicate (`slotAdmits`) and the op's home (the Part port). We are missing the op method (`placePart`), the shared plan, and the single transport — precisely §2.2–2.4.

---

## 3. Every symptom → impossible by construction

| Felt symptom | Today's root (code) | Made impossible by | Why it cannot recur |
|---|---|---|---|
| **Nesting jams (can't drop into a container)** | inline nest-vs-reorder guess (`OutlineTree.tsx:96–117`); canvas has no nest-move at all | §2.3 ONE `PlacementPlan` resolver | nest/reorder is a *resolved, tested plan* gated by `slotAdmits`; there is no local heuristic left to mis-guess; `FF-PLACEMENT-PLAN-TOTAL` (every drop resolves to a valid plan or an explicit hint) |
| **No drag-to-move/reorder** | `moveNode` invoked only from the outline; canvas frames are select-only (`CanvasOverlay.tsx:301`) | §2.2 `placePart` + §2.4 one transport, projected onto canvas frames | move is a projection of the model onto EVERY surface; a surface without move is now the *absent* case, caught by `FF-MANIPULATE-EVERY-SURFACE` |
| **Tables unreachable** | table shell stamps no `PartAnchor`; reach depends on manual stamping | §2.5 renderer-emitted anchors | every enumerated part is anchored by the renderer; `FF-EVERY-PART-ANCHORED` is a corpus `[]` gate — a reachable-hole fails CI |
| **Chrome not on canvas** | (SELECT closed by S6) chrome *manipulation* had no home | §2.2 `sourced` structural adapter (site-chrome) | chrome regions reorder/enable through the SAME `placePart` as any part; no chrome-special manipulation path exists to be missing |
| **Thin inspectors** | Facet axis is TS structure, not a projectable contract | INSPECT = `projectParts ⊕ projectFacets` (SPEC-deep-authorability-completion) | every declared facet resolves to a dock section; `FF-EVERY-DECLARED-FACET-PROJECTED` — a thin inspector = an unprojected declaration = a gate failure |
| **Management is hard** | two drag models, move on one surface, two transports | §2.1 Triprojection: Select ⊕ Inspect ⊕ Manipulate, one transport, every surface | "manage" is now one coherent model with one gesture vocabulary; there is no second IA to learn (`FF-NO-EXTERNAL-SPECIAL-CASE` → `[]` across all three projections) |

Each row is a **consequence of the architecture**, not a patch: the symptom describes a state the unified model has no representation for.

---

## 4. Phased build (Strangler-Fig · each slice shippable + LIVE-provable) — folding the 3 in-flight fixes

Ordered felt-impact-first (owner's visible→deploy→react model). Each slice is `expand`-only, reversible until a flagged one-way step, and carries a **Playwright leg** proving it live on `:3013`. The three in-flight fixes are folded in as slices of ONE path, not separate patches.

### Slice 0 — the Placement seam (no new UX; pure Strangler expand) — **the enabler**
- Add `placePart` to `PartSource` + residence adapters (slot → existing reducers; value/sourced structural). Add `PlacementPlan` (generalize `InsertPlan`) + `resolvePlacementPlan`. **Refactor BOTH existing paths onto it:** palette-insert (`useCanvasController.handleDrop`) and outline-move (`OutlineTree.handleDragEnd`) now call `resolvePlacementPlan` → `placePart`. Byte-identical behaviour (Strangler expand).
- **Playwright:** existing insert + outline-reorder e2e stay green through the seam (regression proof).
- **Fitness:** `FF-ONE-PLACEMENT-GRAMMAR` (all structural edits flow through `placePart`), `FF-PLACEMENT-RESIDENCE-ROUTED` (adapters keyed by residence, no type read). **Tier-2 / ADR:** engine change → **ADR-042 (Placement port, extends ADR-041)**, owner GO.

### Slice 1 (RECOMMENDED FIRST felt slice) — **canvas drag-to-move/reorder/re-nest (slot parts)** + ONE transport
- Make canvas node frames dnd-kit draggables/droppables; `onDragEnd` → `resolvePlacementPlan` (move/reparent/reorder) → `placePart`. Unify palette-drop onto the SAME transport (retire native HTML5 DnD). **This is "no drag-to-move" + "nesting jams" closed at once** — and it *is* the in-flight drag-drop fix (the anticipated `SPEC-canvas-manipulation` is absorbed here, §8).
- **Playwright:** drag a section's panel to reorder on the canvas; drag a panel INTO another container; assert the resulting tree is byte-identical to the same move performed in the navigator (the two-surfaces-one-model proof).
- **Fitness:** `FF-MANIPULATE-EVERY-SURFACE` (canvas + navigator both drive `placePart`), `FF-ONE-DRAG-TRANSPORT` (no native `dataTransfer('nodeType')` survives). Reversible.

### Slice 2 — **the reach guarantee: renderer-emitted anchors** → tables (and every element) reachable by construction
- Move `PartAnchor` stamping into the generic renderer's part walk; delete per-shell stamping. *This is the "tables/facet-universality" in-flight fix's reach half.*
- **Playwright:** select a `table` on the canvas, then drill to select a column part — both resolve to a `PartAddress` and open the dock.
- **Fitness:** `FF-EVERY-PART-ANCHORED` (corpus `[]` gate). Reversible.

### Slice 3 — **value/sourced/chrome structural manipulation** = new residence adapters (declarations only)
- Reorder kpi cards (value), filter controls (sourced/page-filters), chrome regions (sourced/site-chrome) via the SAME `placePart`. *This completes the "chrome-in-canvas" in-flight fix (manipulation half) and proves OCP: a new residence = one adapter, no machinery change.*
- **Playwright:** drag a kpi card to reorder within its strip on the canvas; reorder two chrome regions.
- **Fitness:** `FF-PLACEMENT-OCP` (a new residence adapter needs no resolver/transport edit).

### Slice 4 — **the INSPECT completion (Facet axis)** — StyleField + facet-section seam
- Owned in detail by SPEC-deep-authorability-completion (its Slice 1). Named here as the third projection's completion so the whole is coherent. *This is the "facet-universality" in-flight fix's inspector half + "thin inspectors" closed.*
- **Playwright:** select any element → author its Style facet in the dock; round-trip the config.
- **Fitness:** `FF-EVERY-DECLARED-FACET-PROJECTED`.

### Slice 5 — **convergence sweep + the coherence gate**
- All three projections derive from the model with zero hand-wire; delete the outline's inline heuristic, the native-DnD remnants, the `walkNodes` overlay fallback (now that every part is anchored). Retire `nodeContextEditors` per-type bridge (SPEC-studio-ia-canonical S3) — its removal is now trivially safe.
- **The coherence gate:** `FF-AUTHORING-TRIPROJECTION` — for every element in the corpus, Select (anchored + framed), Inspect (parts ⊕ facets), Manipulate (place/move/remove) all resolve generically, naming no concrete type. This is the single fitness function that makes "one coherent body" executable.

**Sequencing vs the three in-flight fixes:** chrome-in-canvas SELECT (S6, done) stays; its manipulation half = Slice 3. Tables/facet-universality splits cleanly: reach = Slice 2, facets = Slice 4. Drag-drop = Slices 0–1 (the seam + the canvas gesture), NOT a standalone patch. Nothing is fixed twice; each in-flight thread becomes a slice of the one path.

---

## 5. Ideology verdict — the substrate HOLDS; only the authoring layer needs its third projection

**The substrate is sound. No change to ADR-041; the Placement port is its unbuilt structural sibling — the code already reserved the channel.**

- ADR-041's Part port is the right substrate: `enumerateParts` + `writePart` + the residence-tagged `PartMutation` union + adapters-keyed-by-residence. The `node-children` mutation arm sitting unused (`partPort.ts:165`, *"slot residence — lands with slotParts"*) is direct evidence the authors anticipated structural mutation through this exact seam. `placePart` completes a designed interface; it does not bend it.
- This is the **third instance of the same pattern**, which is itself the strongest evidence the substrate is right: ADR-041 found containment-read was smeared across four grammars and unified it onto the port; SPEC-deep-authorability-completion found the Facet/Inspect axis was TS-structure and specced its projection; **this SPEC finds the Manipulate axis was forked machinery and completes its projection.** Same root, same fix shape, same substrate — three times. A substrate that keeps absorbing the next axis as "one more projection, no new mechanism" is a correct substrate.
- **Honest caveat (a refinement, not a rejection):** the Placement port's `value`-residence structural adapter mutates a `node.props` array (splice/reorder) — a genuinely different mutation shape than `writePart`'s subfield merge. This is fine and canonical: it emits the SAME `node-props` `PartMutation` the host already commits via `updateNode`; the residence adapter owns the array algebra, exactly as `writePart`'s value adapter owns the merge algebra today. No new commit target, no new store action for value/sourced (they reuse `updateNode`/`updatePage`); slot reuses `moveNode`/`insertNodes`/`removeNode`. Zero new persistence surface, zero config migration (the stored tree is untouched — structure was always in `childIds`/props arrays/external SSOTs).
- **What does NOT hold and is honestly named:** the *authoring UI layer's* two-transport fork and manual anchor-stamping are real erosion — sub-standard against the benchmark class (Webflow/Figma have one drag engine). They are corrected in the app layer (Slices 1–2), not the substrate. The engine is right; the app grew two manipulation dialects and this SPEC returns them to one.

**Verdict: substrate GO as-is; author the third projection onto it.** Reject any alternative that (a) adds a second structural-mutation path beside the port, (b) keeps two drag transports, or (c) keeps anchor-stamping a shell duty — each re-forks the very axis this SPEC unifies (§7).

---

## 6. Reconciliation — the SSOT map (no fork; re-point the others here)

| Doc | Owns | Relationship to this SPEC |
|---|---|---|
| **ADR-041** (Part grammar + port) | THE substrate: read + scalar-write | This SPEC's Placement port = its structural-write completion → **ADR-042** extends it |
| **SPEC-studio-ia-canonical** | surface *arrangement* (canvas · navigator · dock · top-bar; where panels live) | Subordinate: it arranges the surfaces; THIS doc defines the interaction MODEL those surfaces project. Its "one selection → one projection" is *completed* here by adding the Manipulate projection. S3 (delete filter-bar bridge) becomes Slice 5. |
| **SPEC-deep-authorability-completion** | the INSPECT projection (Facet axis) | One of the three projections named here; keeps full ownership of facet detail. This doc's Slice 4 = its Slice 1. |
| **SPEC-grammar-of-interaction (AR-42)** | end-user *runtime* interaction (explore) | Orthogonal: AR-42 is behavior at *view* time (Select→Param→Reference); this doc is manipulation at *author* time. Both ride the Part address space; they do not overlap. |
| *(anticipated)* **SPEC-canvas-manipulation** | drag-drop-nest-move | **ABSORBED here** (Slices 0–3). Do NOT create a parallel doc — the platform refuses SSOT proliferation. If a draft exists uncommitted, fold it into §2–4. |
| **NORTH-STAR** | the four declared facets (Structure/Semantics/Behavior/Provenance) | This SPEC realizes the *authoring* face of Structure: the Triprojection is how a non-programmer edits the declared instrument. |

Invariants honored: Law 1 (no type in any projection), Law 2 (structure is data — `childIds`/arrays/SSOTs, never functions), Law 7 (Strangler; every slice expand-only until the flagged ADR-042 step), ADR-041 (one Part grammar; adapters by residence).

---

## 7. Rejected alternatives (≥2)

1. **Keep two transports + patch move onto the canvas ad-hoc (native HTML5 DnD everywhere).** *Gains:* no dnd-kit dependency on the canvas; smallest diff. *Rejected:* native HTML5 DnD has no keyboard model → a WCAG 2.1 AA regression (Law 9), which the outline deliberately uses dnd-kit to avoid; and it keeps two drag dialects (the fork this SPEC exists to end). It patches the leaf ("add move to canvas") while leaving the root (no shared transport/plan/port) — the one-off treadmill the owner asked to stop.
2. **A dedicated `MoveController` / manipulation subsystem beside the Part port.** *Gains:* fast to build; no engine interface change. *Rejected:* forks the write path — a second structural-mutation authority competing with `writePart`'s residence-tagged union, violating `FF-ONE-PART-GRAMMAR` and re-creating the "two languages" ADR-041 killed. Structure and props would mutate through different ports; every new residence would need wiring in two places. The canonical home for "edit a part" is the port that already owns "read a part" and "write a part's field."
3. **Node-maximalism for manipulation (promote value/sourced parts to real tree nodes so `moveNode` covers everything).** *Gains:* one reducer trivially. *Rejected:* the same counter-canon ADR-041 rejected three times — 12 table columns become 12 outline nodes; filter items fork the page `filterSchema` SSOT. Uniformity of *mechanism* (the Placement port) does not require uniformity of *residence*; the residence adapters are the correct seam.
4. **Leave anchor-stamping to shells; document it as a shell contract.** *Gains:* no renderer change. *Rejected:* a contract enforced by documentation is not enforced — the table shell already broke it. Reach must be a *derived* guarantee (`FF-EVERY-PART-ANCHORED`), the same way containment became a derived predicate in ADR-041 Ph.6; anything less lets the next shell re-open "X unreachable."

---

## 8. The three required closers

**The single architectural root (1 paragraph).** Authoring an element is THREE projections of ONE model — the Part address space (`PartAddress`, declared contract, `slotAdmits`) — namely **Select** (reach), **Inspect** (contract), and **Manipulate** (restructure). The platform lifted Select and Inspect onto the Part port but never lifted Manipulate: structural editing survives as forked machinery — two drag transports (native HTML5 for canvas-insert, dnd-kit for navigator-move), move present on one surface only and only for the slot residence, a nest-vs-reorder *heuristic* instead of a resolved plan, and no structural method on the port at all (though the code reserved the `node-children` mutation arm for exactly it). The missing root primitive is **the Placement port — `writePart`'s structural sibling** (`placePart`, residence-routed, emitting the same residence-tagged `PartMutation` union) — driven by ONE gesture transport, resolved through ONE `PlacementPlan` (generalizing `InsertPlan`), gated by the ONE `slotAdmits` already shared, and projected identically onto canvas · navigator · palette. Add it and Manipulate becomes the third projection of the one model; the six symptoms become states the architecture cannot represent.

**Symptoms → impossible-by-construction (the map):** nesting jams → ONE `PlacementPlan` (no local heuristic to mis-guess); no drag-to-move → `placePart` projected onto every surface (`FF-MANIPULATE-EVERY-SURFACE`); tables unreachable → renderer-emitted anchors (`FF-EVERY-PART-ANCHORED`, corpus `[]`); chrome not manipulable → the `site-chrome` structural adapter (same `placePart`); thin inspectors → `projectParts ⊕ projectFacets` (`FF-EVERY-DECLARED-FACET-PROJECTED`); management is hard → the coherent Triprojection over one transport (`FF-AUTHORING-TRIPROJECTION`).

**The phased path + first slice.** **Slice 0** (enabler, no UX): add `placePart` + `PlacementPlan`, refactor the existing insert AND outline-move onto it byte-identically (Strangler expand; spawns **ADR-042**, owner GO). **Slice 1 (the recommended first FELT slice):** canvas drag-to-move/reorder/re-nest for slot parts on ONE dnd-kit transport, retiring native DnD — closing "no drag-to-move" and "nesting jams" together, and absorbing the in-flight drag-drop fix; proven by a Playwright leg that drags a panel on the canvas and asserts the tree is byte-identical to the same move in the navigator. Then **S2** renderer-emitted anchors (tables reachable), **S3** value/sourced/chrome structural adapters (chrome manipulable; OCP proof), **S4** the Facet/Inspect completion (thin inspectors closed), **S5** the convergence sweep + the `FF-AUTHORING-TRIPROJECTION` coherence gate. The three in-flight fixes fold in as slices of this one path — chrome-in-canvas (S6 select done; S3 manipulate), tables/facet-universality (S2 reach + S4 facets), drag-drop (S0–S1) — never as separate patches.
