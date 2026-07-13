# ADR-042 — The Authoring Triprojection + the Placement Port (the ONE authoring law)

**Status:** ACCEPTED (lead-authorized, 2026-07-13). **Decision authority:** lead (the owner delegated the authoring re-architecture in full; the sole one-way step — Slice 1's transport flip — is owner-GO-gated below).
**Extends (never forks):** ADR-041 (Part grammar + Part port — THE substrate; this is its unbuilt structural-write sibling) · ADR-038 (Bounded Element Law — governing) · ADR-039 (Bounded-Element Selection Projection) · ADR-023 (One Type System · One Tree · N Residences).
**Source of truth (design, extended not forked):** `docs/architecture/proposals/SPEC-authoring-experience-architecture.md` (the Triprojection study) · `SPEC-canvas-manipulation.md` (the drag/nest/move diagnosis, ABSORBED) · `SPEC-deep-authorability-completion.md` (the Inspect/Facet axis) · `SPEC-studio-ia-canonical.md` (surface arrangement) · NORTH-STAR-unified-declarative-instrument.
**Executable plan:** `SPEC-authoring-experience-architecture.md` §9 (this ADR's definitive, live-state-reconciled build plan).
**Governing laws:** CLAUDE.md Law 1 (no privileged types/dimensions), Law 2 (declarative — structure is data), Law 6 (root-cause), Law 7 (Strangler-Fig), Law 8 (OCP — new capability = one declaration), Law 9 (a11y + data integrity).

---

## Context — why this ADR exists (the owner's directive, verbatim intent)

The owner is exhausted by one-element-at-a-time fixes and wants a **reference-grade, loosely-coupled, SOLID, canonical authoring platform** — architecture *and* UI — benchmarked to Webflow / Framer / Figma / Builder.io, not more mechanisms. The lead has taken full ownership. This ADR **finalizes the ONE authoring architecture** and designs OUT five named rot-items as first-class requirements, each held by a machine fitness function.

**The single architectural root (ADR-041's third instance).** Authoring an element is **THREE orthogonal projections of ONE model** — the Part address space (`PartAddress`, declared `contract`, `slotAdmits` accept-set): **SELECT** (reach), **INSPECT** (author the contract), **MANIPULATE** (restructure). ADR-041 lifted **Select** onto the port (`CanvasOverlay` recurses `enumerateParts`, one `PartAddress`); `SPEC-deep-authorability-completion` lifted **Inspect** onto it (`projectParts ⊕ projectFacets`, now built — `facetRegistry` + `registerFacetSections`). **Manipulate was never lifted.** Structural editing survives as the *pre-ADR-041 world*: two drag transports (native HTML5 for canvas-insert `NodePalette.tsx`/`CanvasOverlay.tsx`; dnd-kit for navigator-move `OutlineTree.tsx`), `moveNode` present on ONE surface and ONE residence only (`constructor.pages.ts:188`, invoked solely from `OutlineTree.handleDragEnd`), a nest-vs-reorder *heuristic* (`OutlineTree.tsx:96–117`) instead of a resolved plan, and **no structural method on the port** — though the code reserved the `node-children` mutation arm for exactly it (`partPort.ts:165`). The five felt rot-items are all consequences of this one missing projection *plus* two named erosions on top of it (a privileged container literal; a data pipeline inlined per element).

**Verdict up front: the substrate HOLDS.** No change to ADR-041. The Placement port is its designed-but-unbuilt structural sibling (the reserved `node-children` arm is the proof). The erosion is in the *app authoring layer*, not the engine — and this ADR returns it to one grammar.

---

## Decision

### D1 — Authoring IS the Triprojection over the ONE Part model *(the governing law)*

> Every authoring surface is `f(the Part model)`, naming **no concrete type**. The model is `(PartAddress, contract, accept-set)`. The three projections, each onto **every surface** (canvas · navigator · dock · palette):
>
> - **SELECT** `= project(enumerateParts) → { frames | rows | anchors }` — a gesture yields ONE `PartAddress`.
> - **INSPECT** `= projectParts(sel) ⊕ projectFacets(sel)` — the dock; parts via `element.schema`, facets via `facetRegistry`.
> - **MANIPULATE** `= resolvePlacement(source?, target, index) → PlacementPlan → placePart → PartMutation` — the new projection.
>
> A **new element** costs zero authoring code on any projection. A **new capability** costs ONE declaration (a `PartField`, a `FacetDescriptor`, or a residence adapter); the machinery is unchanged (OCP). This is the homoiconic ideal, whole.

This law binds all five rot-items: none is patched in isolation; each becomes a state the unified model either represents generically or cannot represent at all.

### D2 — The Placement port: `writePart`'s structural sibling *(the missing primitive)*

Add a third method to the ONE `PartSource` interface (`packages/react/src/engine/partPort.ts`) — the exact peer of `writePart`, residence-routed, emitting the SAME residence-tagged `PartMutation` union:

```ts
placePart(element, op: PlacementOp, ctx: PartSourceContext): PartMutation | null
//   slot    → node-children  (existing moveNode / insertNodes / removeNode reducers)
//   value   → node-props     (splice/reorder the props array; committed via updateNode)
//   sourced → filter-schema / site-chrome (reorder/enable via existing page/site SSOT actions)
```

- **Residence-routed, adapters keyed by residence — never by type** (ADR-041 law). A new residence's structural edit is one adapter; the port signature is unchanged.
- **ONE `PlacementPlan`** — generalize `InsertPlan` (`insertNode.ts:141`) to `insert | reorder | reparent | remove` (the `wrap` arm is retired by D3, not kept). `resolvePlacementPlan(model, source?, target, index)` = `resolveInsertPlan` widened: `source` absent ⇒ insert; `source` present ⇒ move/reparent/reorder. Legality is the ONE `slotAdmits`. **`OutlineTree`'s Candidate-A/B heuristic is deleted** — it becomes `resolvePlacementPlan + placePart`, byte-identical logic shared with the canvas. Nest-vs-reorder is a resolved, tested plan.
- **ONE gesture transport — dnd-kit** (the navigator already runs it; native HTML5 DnD has no keyboard model → a Law 9 WCAG regression). One `DndContext` spans canvas + navigator + palette. A part drags from the navigator onto the canvas and from the palette into a canvas container through ONE plan, ONE port.
- **ONE reach guarantee — anchors are a render-side projection, not a shell duty.** Move `PartAnchor` stamping from each shell into the generic renderer's part walk. A shell cannot forget to stamp; a table's columns become reachable *by construction* (kills "tables unreachable" as a corpus invariant, not a per-shell fix).

**Zero config migration, zero new persistence surface.** Structure was always in `childIds` / props arrays / external SSOTs; `placePart` emits the `PartMutation` the host already commits. The `value` adapter owns the array algebra exactly as `writePart`'s value adapter owns the merge algebra today.

### D3 — No privileged container: the composition grammar is capability-gated end-to-end *(rot-item 1)*

**The rot, code-cited.** `inner-page`'s content slot declares `accepts: ['section', 'repeat', 'page-header']` — a **hardcoded identity list** (`InnerPageNode.ts:21`) — and `AUTOWRAP_CONTAINER = 'section'` is a **hardcoded privileged literal** (`insertNode.ts:29`). Together they force page → **section** → block: you cannot start a page with a grid/columns/stack — a dropped layout is wrapped into a section it did not ask for. This is a direct Law 1 violation (a privileged type baked into the composition grammar).

**The fix (Law 1 · the capability-accepts grammar already proven for `section`'s content slot):**
1. **Introduce a `layout` placement capability** (`CAPS.LAYOUT`, peer of `CAPS.FLOW`) declared by every layout container — `section`, `grid`, `columns`, `stack`, `repeat`. A layout container is *page-root-admissible content* the way `flow` is *section-admissible content*.
2. **The page-root content slot gates by capability, not identity:** `acceptsCaps: ['layout']` replaces `accepts: ['section', 'repeat', 'page-header']` (page-header stays a distinct declared region). A grid/columns/stack now lands **directly** at the page root — section is one `layout` container among peers, never a wrapper the page forces.
3. **Retire the `AUTOWRAP_CONTAINER` literal.** The auto-wrap survives ONLY for a genuinely page-illegal *leaf* (a bare chart dropped at root), and even then the wrapper is **derived from the declared `layout` capability set** (`resolveWrapper(pageMeta, childType)` picks the page's declared default container by capability), never the literal `'section'`. The Notion/Gutenberg "insert anything, the tool builds structure" ergonomic is KEPT — but the structure it builds is *declared*, not hardcoded.

Held by `FF-NO-PRIVILEGED-CONTAINER`. **This is a genuine change, not a projection** (a META edit to `inner-page` + the layout containers, plus a resolver edit) — honestly named.

### D4 — The inspector is a canonical facet PROJECTION with a reference-grade dock IA *(rot-item 2)*

**Honest live state:** the *model* the owner needs already exists and is canonical — `facetRegistry` declares STYLE · DATA · EVENTS · VISIBILITY · CHROME (`builtinFacets.ts`); `registerFacetSections` derives one generic dock section per facet with no type read (`builtins.tsx:204`); `Inspector.tsx` already does bounded-first progressive disclosure (first group open; accordion→tabs at 4 groups). **Do NOT rebuild the model — that would re-mechanize a solved axis.** The remaining rot is **presentation coherence**: the dock currently *stacks* every applicable facet section vertically (content + style + data + events + visibility), which reads as "a wall / overwhelming / incoherent" — the owner's exact complaint.

**The reconception (Webflow/Figma benchmark — a fixed set of facet TABS, one facet visible at a time):**
- The dock projects the facet sections as a **facet tab-bar** (Content · Style · Data · Interactions · Visibility), **derived from `facetRegistry` order + `appliesWhen`** — not a per-type layout, not a hand-authored tab list. One facet's contract shows at a time; within it, `Inspector.tsx`'s existing progressive disclosure governs. This is a *presentation projection* of the already-declared facet set — the dock IA becomes `f(facetRegistry, selection)`, staying generic.
- Held by `FF-DOCK-IS-FACET-PROJECTION` (the dock's tab set is derived from the facet registry, names no concrete type) — the presentation-layer peer of `FF-FACET-SECTION-IS-PROJECTION`.

Mostly a projection (dock presentation), honestly: no new facet model, one new derived IA layer + the existing `dockSectionRegistry`.

### D5 — Data authoring is a BOUNDED CONTEXT; the element references governed data *(rot-item 3)*

**The coupling, named.** The element's `data: DataSpec` **inlines the full query + pipe + encoding on every element** (`readPath:'data'`, written to `node.props.data`). The owner: "the data layer isn't isolated … even I can't understand it." The rot is a Bounded-Context violation — data modeling (sources, metrics, pipelines: a semantic layer) is smeared into each visual element's config, split across the per-element DATA facet (author lens) and `DataModelingPanel` (steward lens) with no single legible home.

**The isolation (Looker/Power BI/Tableau benchmark — the data model is a bounded semantic layer; visuals reference measures by name):**
- **The element references data by a GOVERNED HANDLE** (a metric/dataset id resolved through the semantic layer + the `DataStore` port), not by inlining a raw pipeline. The metric registry (AR-40) + `DataStore` port (ADR-001/010) are that bounded context; this ADR names it the SSOT for *what data means*, and forbids the element from being the home of raw-source definition.
- **The per-element DATA facet authors the LAST MILE only** — bind a governed handle ⊕ an author-safe transform/derive/encoding *over* the governed source (`DataFacetField` already does the bind; the pipe editor stays scoped to author-safe last-mile). **Raw-source / raw-query definition stays in the bounded data context** (steward), reached by a clear "define a source" affordance, not inlined on the visual.
- **The governance boundary is a LENS, not a wall** (D-DA1, from `SPEC-deep-authorability-completion`): the author binds governed metrics + authors last-mile pipes; the steward defines sources. Preserving this is what keeps published numbers trustworthy (Law 9). The facet is *metric-optional* (a raw last-mile pipe over a governed source needs no metric) — which delivers the owner's "data pipeline on any element" WITHOUT dissolving governance.
- Held by `FF-DATA-BOUNDED` (no element config is the home of a raw-source definition; the element references a governed handle) + `FF-GOVERNANCE-LENS-PRESERVED` (raw-source define stays role-gated).

Partly built (the DATA facet exists), partly a real boundary decision (the reference-by-handle isolation + the "define a source" home) — honestly split.

### D6 — Chrome folds into the Triprojection *(rot-item 4)*

Chrome is a `sourced` part of the synthetic `site-frame` (S6). **No chrome-special authoring path exists or is added.** Select (S6 done) + Inspect (the CHROME facet + the site-frame composition inspector are built — `builtinFacets.ts` chrome facet, `ChromeCompositionPanel`) + Manipulate (the `site-chrome` structural adapter of D2, reorder/enable regions through the SAME `placePart`). "Chrome hard to reach / incomplete" becomes the same three projections as any element — held by the Triprojection gate, not a chrome-specific fix.

### D7 — The SOLID / loose-coupling standard is MACHINE-HELD *(rot-item 5)*

"Loosely-coupled, SOLID, no anti-pattern, no hardcode" is not a review aspiration — it is a **fitness suite that RED-lights the build**. The suite (below) makes cross-layer hard deps, per-type special-casing in authoring, hardcoded type literals, and branch-instead-of-dispatch *failing CI conditions*. This is the standard, held by machines, not by vigilance.

---

## The five rot-items → design-out map

| Owner's named rot | Root (code-cited) | Designed out by | Held by (fitness) | Change or projection? |
|---|---|---|---|---|
| **1. `section` is privileged** (can't start with a layout) | `inner-page` slot `accepts:['section','repeat','page-header']` identity list (`InnerPageNode.ts:21`) + `AUTOWRAP_CONTAINER='section'` literal (`insertNode.ts:29`) | **D3** — page-root gates by `CAPS.LAYOUT`; wrapper derived from declared capability; literal retired | `FF-NO-PRIVILEGED-CONTAINER` | **Real change** (META + resolver) |
| **2. Inspector overwhelming / incoherent** | dock STACKS every facet section vertically (facet *model* already generic — `facetRegistry`) | **D4** — dock projects facets as a derived tab-bar (Webflow IA) + existing progressive disclosure | `FF-DOCK-IS-FACET-PROJECTION` | **Mostly projection** (dock IA) |
| **3. Data layer not isolated / illegible** | `data:DataSpec` inlined per element (`node.props.data`); modeling smeared author↔steward | **D5** — element references governed handle; facet authors last-mile; raw-source in bounded data context; governance = lens | `FF-DATA-BOUNDED`, `FF-GOVERNANCE-LENS-PRESERVED` | **Split** (facet built; boundary is real) |
| **4. Chrome unreachable / incomplete** | (Select S6-done) chrome *manipulation* had no home; composition facet built but no structural reorder | **D6** — chrome = `sourced` part; Manipulate via `site-chrome` adapter; no chrome-special path | `FF-AUTHORING-TRIPROJECTION` (chrome ∈ corpus) | **Projection** (one adapter) |
| **5. Tightly coupled / anti-pattern / hardcode (arch + UI)** | two drag transports; move on one surface; heuristic not plan; hardcoded literals | **D2 + D7** — one port, one plan, one transport; the fitness suite makes coupling/hardcode RED | the whole suite below | **Real change + machine standard** |

Plus the two reach/manipulation completeness holes folded in: **no drag-to-move/nesting jams** (D2 — `placePart` + one `PlacementPlan` + one transport) and **tables unreachable** (D2 — renderer-emitted anchors).

---

## Alternatives rejected (≥2, per ADR practice)

1. **Patch each rot-item where it hurts** (add move to the canvas ad-hoc via native HTML5 DnD; add a page-root special-case for grids; add a data tab; restyle the dock). *Gains:* smallest diffs, fastest visible relief. *Rejected:* this is the one-off treadmill the owner asked to END. Native HTML5 move keeps two drag dialects and has no keyboard model (Law 9 regression the navigator deliberately avoids); a page-root grid special-case re-privileges by adding a second hardcoded branch; a bolted-on data tab deepens the per-element inlining. Each patches a leaf and leaves the root (no shared port/plan/transport, a privileged literal, an unbounded data concern). It fails the reference-grade bar by construction.

2. **A dedicated manipulation subsystem / `MoveController` beside the Part port** (+ a separate "data authoring app," + a bespoke inspector framework). *Gains:* fast to build in isolation; no engine interface change. *Rejected:* forks the write path — a second structural-mutation authority competing with `writePart`'s residence-tagged union, violating `FF-ONE-PART-GRAMMAR` and re-creating the "two languages" ADR-041 killed; a separate data app re-splits the bounded context this ADR is unifying; a bespoke inspector abandons the already-canonical `facetRegistry`. Uniformity of *mechanism* (the port) does not require a new subsystem per axis — the residence adapters are the correct seam.

3. **Node-maximalism for manipulation** (promote value/sourced/chrome parts to real tree nodes so `moveNode` covers everything). *Gains:* one reducer trivially. *Rejected:* the counter-canon ADR-041/ADR-023/ROM rejected three times — 12 table columns become 12 outline nodes; filter/chrome items fork their external SSOTs; config migration everywhere. Uniformity of *mechanism* does not require uniformity of *residence*.

4. **Leave the SOLID/coupling standard to code review + docs** (a written contract, not fitness functions). *Gains:* no test to build. *Rejected:* a contract enforced by documentation is not enforced — the `table` shell already broke the anchor contract; the page-root already hardcoded `accepts`. The reference class (evolutionary architecture, Ford/Parsons) holds invariants as executable fitness functions or not at all. D7 makes the standard machine-held.

---

## Fitness functions — the SOLID / loose-coupling standard, executable (D7)

**New (this ADR):**

*Manipulation axis (D2):*
- `FF-ONE-PLACEMENT-GRAMMAR` — every structural edit flows through `placePart`; no structural mutation bypasses the port (grep + property gate). *Home: `packages/react/src/engine/object-model.fitness.test.ts` + app counterpart.*
- `FF-PLACEMENT-RESIDENCE-ROUTED` — placement adapters are keyed by residence; no adapter reads a concrete `type`.
- `FF-PLACEMENT-PLAN-TOTAL` — every drop resolves to a valid `PlacementPlan` or an explicit guided hint; no silent redirect / invalid tree.
- `FF-MANIPULATE-EVERY-SURFACE` — canvas AND navigator both drive `placePart`; a surface without move is a caught absence.
- `FF-ONE-DRAG-TRANSPORT` — no native `dataTransfer('nodeType')` survives; one dnd-kit `DndContext`.
- `FF-EVERY-PART-ANCHORED` — for every element in the corpus, each part `enumerateParts` yields resolves to a measurable render anchor (corpus `[]` gate — kills "X unreachable").
- `FF-CANVAS-KEYBOARD-MOVE` — a node is movable keyboard-only, end to end (Law 9 / WCAG 2.1 AA).

*Composition grammar (D3):*
- `FF-NO-PRIVILEGED-CONTAINER` — no authoring code names a concrete container type as a wrapper or accept-target; the page-root slot gates by `CAPS.LAYOUT`, the wrapper is derived from declared capability. (Grep gate: no `'section'` literal in `insertNode.ts`/placement; no identity `accepts` list where a capability model belongs.)

*Inspect axis (D4):*
- `FF-DOCK-IS-FACET-PROJECTION` — the dock's facet tab set is derived from `facetRegistry` (order + `appliesWhen`); no hand-authored per-type tab, no concrete `node.type` read.

*Data boundary (D5):*
- `FF-DATA-BOUNDED` — no element config is the home of a raw-source definition; a data-bound element references a governed handle (metric/dataset id) resolved through the semantic layer + `DataStore` port.
- `FF-GOVERNANCE-LENS-PRESERVED` — raw-source/raw-query definition stays role-gated (the D-DA1 lens); the author facet exposes bind + last-mile only.

*The coherence gate + the coupling/anti-pattern guards (the standard itself):*
- `FF-AUTHORING-TRIPROJECTION` — for every element in the corpus, Select (anchored + framed), Inspect (parts ⊕ facets), Manipulate (place/move/remove) all resolve generically, naming no concrete type. **The single executable statement of "one coherent body."**
- `FF-NO-CROSS-LAYER-DEP` — the dependency arrow (`contracts ← expr ← core ← charts ← react ← plugins ← apps`) holds; enforced by `eslint no-restricted-imports` (`platform/eslint.config.js`) — already live, named here as part of the suite.
- `FF-DISPATCH-NOT-BRANCH` — no authoring composer/renderer/inspector branches on a concrete element type (`if type === X` / type-keyed map reaching an element's internals); dispatch is via registry/port/capability. Extends the shipped `FF-NO-EXTERNAL-SPECIAL-CASE` (`noExternalSpecialCase.fitness.test.ts`) to all three projections.

**Kept green throughout (regression guards, inherited):**
- `FF-ONE-PART-GRAMMAR`, `FF-RESIDENCE-AT-FIELD`, `FF-DERIVED-CONTAINMENT` (ADR-041); `FF-COMPOSITE-INTEGRITY` (BE-5); `FF-NO-EXTERNAL-SPECIAL-CASE` (ADR-038/039); `FF-FILTER-ITEMS-DECLARED-BAND` (BE-4); `FF-CAPABILITY-ACCEPTS` (`capabilityAccepts.fitness.test.ts`); `FF-EVERY-DECLARED-FACET-PROJECTED` + `FF-FACET-SECTION-IS-PROJECTION` (deep-auth-completion); `FF-AUTHOR-NO-QUERY` (the governance lens); `FF-STYLE-ROUNDTRIP`, `FF-NO-RAW-JSON-DEFAULT`.

---

## Consequences

**Positive.** The Manipulate axis becomes the third projection of the one model — the six felt symptoms become states the architecture cannot represent. The data concern gets a bounded home; the inspector gets a reference-grade IA over the already-canonical facet set; the composition grammar loses its last privileged literal; the SOLID/coupling standard is machine-held. A new element/capability is a declaration, the UX unchanged — loosely-coupled + SOLID by construction. Concept count does not rise (the port absorbs manipulation; no new subsystem).

**Costs / trade-offs (ISO 25010 named).** A deliberate app-layer re-seam of manipulation (**maintainability +**, short-term **modifiability −** during the transport flip). The dnd-kit transport flip on the canvas is the churn window (Slice-scoped, reversible until the flip). D3's page-root capability model is a small behavioral change (grids now land at root) — an intended UX change, gated by a Playwright leg.

**One-way doors.** Almost every slice is additive/reversible (Strangler `expand`). The sole gated step: **Slice 1's native-HTML5 → dnd-kit transport flip on the canvas** (removing the native `dataTransfer` path is a one-way delete once the palette + canvas run on dnd-kit) — **owner GO before that delete**, exactly like ADR-041 Phase 6 / ADR-023 R2. The Placement port itself (Slice 0) is additive and reversible (both existing paths refactored onto it byte-identically).

---

## The first buildable slice

**Slice 0 — the Placement seam (no new UX; pure Strangler expand).** Add `placePart` to `PartSource` + the three residence adapters (slot → existing reducers; value/sourced structural); add `PlacementPlan` (generalize `InsertPlan`) + `resolvePlacementPlan`; refactor BOTH existing structural paths onto it byte-identically — palette-insert (`useCanvasController`) and outline-move (`OutlineTree.handleDragEnd`). Proven by the existing insert + outline-reorder Playwright/e2e legs staying green through the seam (regression proof). Fitness: `FF-ONE-PLACEMENT-GRAMMAR`, `FF-PLACEMENT-RESIDENCE-ROUTED`. This is the enabler every later slice rides; it is additive and fully reversible.

See `SPEC-authoring-experience-architecture.md` §9 for the full slice sequence.
