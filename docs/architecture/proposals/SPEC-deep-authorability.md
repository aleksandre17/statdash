# SPEC — Deep Authorability (the maximal target: 100% nothing-un-buildable)

> Status: PROPOSED (converged design; owner-gated one-way doors flagged §9)
> Owner theme (2026-07-10): "100% deep authorability — dynamic, contextual, simple-yet-incredibly-powerful, canonical. Nothing un-buildable in the Constructor."
> Scope: the D7 engine seam (`itemSchema`), the generic nested editor, the reach/interaction model, the filter-control drill, the raw-data pipeline surface, and the 100%-authorable gate.
> Companion ADR (engine change, full ceremony): **ADR-022 — additive `PropField.itemSchema` nested-authoring seam** (§8, to be cut alongside Phase D7.0).

---

## 0. TL;DR — the one finding that reframes everything

The Constructor "doesn't go deep" for **two structurally different reasons**, and the fix is asymmetric:

| Symptom | True seam | Nature |
|---|---|---|
| "In a kpi-strip I can't reach an individual KPI item." (hero cards, chart axes/legend, table columns, links, slides, gauge steps…) | `PropField{type:'array'\|'object'}` has **no `itemSchema`** → the Inspector's only editor is a **raw-JSON textarea** (`JsonControl`). | **Engine capability gap** — the D7 seam. 13 fields, all enumerated in `SCHEMA_TODO`. |
| "In a filter-bar, how would I configure a specific select?" | The per-control editor **already exists and is first-class** (`FiltersDrawer → ParamDefEditor → Inspector`). It lives ONLY in the RightDock **Page** context. Selecting the filter-bar **node** shows a disjoint **Element** context (only `barIds`). **No bridge connects the selected node to its controls.** | **Reach / navigation gap** — not a capability gap. |

**`geostat.provisioning.json` is NOT the problem** (owner's suspicion confirmed false). The config is clean, declarative, and already *carries* all this depth (`kpi-strip.items[]`, `filterSchema.bars.bar.filters{}`). The Constructor simply cannot *reach into* it. It is an authoring-reach gap, exactly as the owner sensed — the open JSON file is the visible evidence of depth the tool can't touch, not a defect in the config.

The maximal target is therefore: **(1)** the additive `itemSchema` engine seam so any typed nested array/object becomes structurally editable, **(2)** a single generic recursive nested editor with a deliberate interaction taxonomy for *reaching* items, **(3)** a node→filterSchema bridge that re-homes the existing control editor under the selected node, **(4)** a legible raw-data pipeline surface, **(5)** the 100%-authorable invariant promoted from a shrinking backlog to `SCHEMA_TODO === {}`.

---

## 1. Ground-truth root cause (per element)

### 1.1 kpi-strip.items / hero.cards / chart.axes / table.columns … — the D7 class
- `packages/core/src/config/prop-schema.ts` — `PropField` has `type`, `options`, `source`, `showWhen`, `coverage`… but **no `itemSchema`**. An `array`/`object` field is a leaf as far as the authoring vocabulary is concerned.
- `apps/panel/src/inspector/FieldControlRegistry.ts` — `array` and `object` both resolve to `JsonControl` (`controls/primitives.tsx`): a `<textarea>` of `JSON.stringify(value)`. There is **no** list editor, no per-item reach, no add/remove/reorder, no sub-field control.
- The compile-time gate (`schema-contract.ts`, `AssertSchemaCovers`) proves **top-level** coverage only (`items` is "covered" as an opaque array). The **depth** frontier is explicitly parked in `SCHEMA_TODO` (13 entries) in `schema-completeness.fitness.test.ts §1c`, whose `isOpaqueNested()` predicate already keys off `'itemSchema' in field` — **the codebase has already reserved this exact seam name and shape.** `KpiStripNode.ts` documents it verbatim: *"a core PropField widen + a panel array-item resolver."*
- **Verdict:** genuine capability gap. Fix = D7 (§2–§3).

### 1.2 filter-bar controls — a different tier entirely
- A filter-bar node in config is a bare placeholder: `{ "type": "filter-bar" }`. Its **only** prop is `barIds` (which named bars to render). It does **not** own its controls.
- The controls (`ParamDef`s) live in a **separate page-scoped tier**: `page.meta.filterSchema.bars[barId].filters{}` — sliceType `'control'`, not `'node'`. Confirmed in provisioning (`filterSchema.bars.bar.filters.account` = a `select` control with cube-bound options).
- A **complete, schema-driven, per-control editor already exists**: `FiltersDrawer` lists each bar's controls, offers add (`makeParamNode`) / remove / reorder, and edits each via `ParamDefEditor → Inspector` (through `filterParamSchemaSource`) + a `VisibilitySection` for perspective-scoping. You *can* configure a specific select today.
- **The gap is reach.** `RightDock` shows exactly ONE context: select an element → **Element** context (the node's `barIds` schema); select nothing → **Page** context (where `FiltersDrawer` lives). Selecting the filter-bar node and reaching its controls are **disjoint** — nothing routes "I selected this bar" to "here are its controls." The author must *independently know* to deselect, open the Page tab, scroll to Filters, and locate the bar by id.
- **Verdict:** reach/navigation gap. Fix = the node→filterSchema drill bridge (§4). No engine change.

### 1.3 The two seams are NOT the same fix
D7 gives structured editing to items that live *in a node's own props*. Filter controls live in a *sibling page tier referenced by the node*. D7 does not reach them and must not try to (it would denormalize the control tier onto the node, breaking Law 2 and the single filterSchema SSOT). They share the *interaction spine* (drill-in + breadcrumb) but have distinct write targets.

---

## 2. The D7 engine seam (owner-blessed, additive, OCP)

**Change (additive, backward-compatible) in `packages/core/src/config/prop-schema.ts`:**

```ts
export interface PropField {
  // …existing…
  /**
   * The PropSchema of each ITEM (when type==='array') or of the object's fields
   * (when type==='object'). Present ⇒ the field is a STRUCTURED nested container,
   * authored via the recursive nested editor. Absent ⇒ opaque (raw-JSON fallback).
   * Recursive: an itemSchema field may itself carry an itemSchema (arbitrary depth).
   */
  itemSchema?: PropSchema
  /**
   * Dot-path into an item used as its DISPLAY TITLE in the list (e.g. 'label','id').
   * Absent ⇒ "Item N". Purely presentational; never a write target.
   */
  itemLabel?: string
  /** Item-level groups for the nested Inspector (mirrors PropertyGroup). */
  itemGroups?: PropertyGroup[]
}
```

**Why additive-property, not a new `PropFieldType` (`'array-of'`):**
- The fitness `isOpaqueNested()` already tests `'itemSchema' in field` and keys off the *existing* `array`/`object` types — the codebase pre-committed to the additive shape. A new type would fork every existing `array`/`object` meta and break that predicate.
- A field *without* `itemSchema` stays valid and gracefully falls back to JSON — zero migration, zero blast radius. New capability = a populated optional field; the `PropField` interface, `SliceMeta`, `NodeRegistry`, and `Inspector` interfaces are **unchanged** (Law 8 / OCP).
- It keeps **one** authoring vocabulary (PropSchema) at all depths, rather than importing JSON Schema `items` (see rejected alt §8-D).

**Wire round-trip (must stay lossless — `propSchemaToJsonSchema.ts`):** when a field has `itemSchema`, emit `items: propSchemaToSubSchema(field.itemSchema)` (array) or `properties: …` (object) instead of the current bare `{type:'array'}`. The existing fitness round-trip test (`schema-completeness §1, tier a`) then validates nested losslessness automatically.

**Path plumbing already exists:** `prop-path.ts` `getAtPath`/`setAtPath` handle numeric index segments (`items.0.value.measure`) for both read and write. D7 needs no new path machinery — the nested Inspector emits dot-paths like `items.2.color` and the store write "just works."

**Coverage recursion:** add a recursive `AssertSchemaCovers` variant (or assert each `itemSchema` against its item interface with the *same* forward-only oracle) so a nested field's sub-fields obey the same completeness rule — depth is gated, not just breadth.

---

## 3. The generic nested editor (one editor, recursive, OCP)

**Two new FieldControls in `apps/panel/src/inspector/controls/`, registered by precedence (no Inspector change):**

- `ArrayOfControl` — resolved when `field.type==='array' && field.itemSchema`. Renders the item **list**: each item a row titled by `itemLabel`, with add (seed from `itemSchema` defaults) / remove / reorder — the **exact proven pattern `FiltersDrawer` already uses**. Entering an item renders a nested `<Inspector>` over `itemSchema`, modeling the item as a `CanvasNode` `{type, props:item}` — **exactly as `ParamDefEditor` already does today.** Because the nested Inspector *is* the same generic renderer, recursion (item → its own array field → …) is free.
- `ObjectControl` — resolved when `field.type==='object' && field.itemSchema`: a single nested Inspector over the object.

**Registry precedence (add above the type→JsonControl fallback in `FieldControlRegistry.resolve`):**
```
localized → enum-ref → static-options select
→ (type==='array' && itemSchema) ArrayOfControl        ← NEW
→ (type==='object' && itemSchema) ObjectControl        ← NEW
→ controls.get(type) → JsonControl (fallback, opaque)
```
`JsonControl` stays as the honest fallback for genuinely free-form bags (§6 `OPAQUE_BY_DESIGN`).

This retires the `SCHEMA_TODO` backlog **by construction**: each field that gains an `itemSchema` auto-drops from `isOpaqueNested`, and the fitness's `stale` check *forces* its removal from the allowlist.

---

## 4. Interaction & overflow model (reaching + editing nested items)

Adopt the lead's taxonomy. The **decision rule is by sub-item weight**, computed from the `itemSchema`, never hardcoded per element:

```
weight(item) = fieldCount(itemSchema)
             + 2·(has nested array/object itemSchema)
             + 2·(has rich type: DataSpec | ChartDef | VisibilityExpr)
```

| Surface | When | Examples |
|---|---|---|
| **INLINE accordion** | flat item, `weight ≤ 4` | `links.items` (label/href/icon), `page-header.crumbs`, `gauge.thresholds`, the `barIds`/`filter-bar` picker |
| **DRILL-IN + breadcrumb** (the spine) | rich/nested, `weight > 4` | `kpi-strip.items` (KpiSpec: value/trend nested), `hero.cards`, `stats-carousel.slides` (→ nested StatItem[]), `chart` axes/legend/tooltip, `table.columns`, **filter-bar controls** |
| **POPOVER** | transient single-field micro-edit, anchored to the canvas element | recolor a KPI, rename a crumb |
| **INNER-PAGE / focus-view** (owner's overflow idea) | the sub-editor is itself a full workspace (`weight` dominated by a rich type) | a chart's full encoding, a metric calc — takes a focus view over the always-mounted canvas, like Model mode |

**The drill-in spine** (the load-bearing pattern):
- **Breadcrumb** at the dock top always reflects the drill stack: `Section › filter-bar › account (select)`. Clicking an ancestor ascends. This is the "selection breadcrumb" — a small `useDrillStack` in the canvas controller pushing/popping `{label, target}` frames.
- **Canvas gesture:** double-click a container node → enters drill (selects it + pushes a breadcrumb frame); **Esc** → ascends one frame. Single-click = select (unchanged).
- The dock **replaces** its content with the drilled item's sub-editor (never stacks a second panel beneath — preserves the `FF-RIGHTDOCK-CONTEXTUAL` "one context" guarantee already enforced in `RightDock`).

**Overflow discipline:** when a dock sub-editor would exceed the dock (a focus-view-weight item), it escalates to the inner-page/focus-view — the owner's explicit overflow target — rather than growing an unusable scroll. Popovers absorb the transient micro-edits so the dock is never opened for a one-field change.

---

## 5. Filter-bar control authoring (the node→filterSchema bridge)

The capability exists; build the **reach**. When a `filter-bar` node is selected, its Element context gains a **"Controls" section** below `barIds`:

- Resolve the bar(s) the node renders (`barIds`, or all bars if absent) from `page.meta.filterSchema` and list their controls — the **same list `FiltersDrawer` renders**, scoped to this node's bars.
- Each control **drills into the SAME `ParamDefEditor`** (breadcrumb: `Section › filter-bar › account (select)`). "Add control" appends via `makeParamNode`.
- **Write target: `page.meta.filterSchema`** (write-through, exactly as `FiltersDrawer.commitBar` does) — the node stays a clean `{type:'filter-bar', barIds}` placeholder. **No denormalization onto node.props** (Law 2; single filterSchema SSOT preserved).

**Design decision — BRIDGE, not MOVE (§9 owner-gate 1):** keep the page-level `FiltersDrawer` (bulk authoring of all bars in one place) **and** add the node-contextual drill (reach a *specific* control from the *specific* bar on the canvas). Same model, same editor, two entry points — the "dynamic contextual tool" principle: the right instrument appears for what the author is looking at.

---

## 6. The 100%-authorable gate (promise → build gate)

Grow the existing `schema-completeness.fitness.test.ts` invariant in three moves:

1. **Backlog drains to empty.** As each `SCHEMA_TODO` field gains its `itemSchema`, the `stale` check forces its removal. Terminal assertion once D7.2 completes:
   ```ts
   expect(Object.keys(SCHEMA_TODO).filter(k => !OPAQUE_BY_DESIGN.has(k))).toEqual([])
   ```
   "Nothing un-buildable" becomes red-on-regression, not a hope.
2. **Structured-by-default.** New assertion: *every* `array`/`object` PropField across all metas MUST have an `itemSchema` **OR** be in a small, justified `OPAQUE_BY_DESIGN` allowlist. Opacity must be *argued*, not defaulted. Proposed allowlist (§9 owner-gate 4): `wrap.styles` (free-form NodeStyles bag), `repeat.each` (free-form static rows), `geograph.geoCodeMap` (opaque ISO→dimVal map). Everything else is structured.
3. **Depth is gated too.** The coverage recursion (§2) makes a nested `itemSchema`'s own fields obey forward-only completeness — so authorability can't leak one level down.

---

## 7. Raw-data upload + pipeline assembly surface (prominent, legible, never a dead end)

**All engine pieces exist and are correct** — the gap is *legibility*, not capability. Today Model mode (`ModelSurface`, Steward lens) stacks three regions with no visible through-line:
- `SourceAuthoringPanel` — ingest: upload static rows / connect a stats cube, **Test**, **Browse** (dims/measures), Save. (+ `ExcelUpload`, `IngestResultPanel`, `DsdVersionPanel`.)
- cube-profile / DSD — *implicit today* (browsed, not authored as a stage).
- `MetricCatalogManager` / `MetricEditor` / `CalcBuilder` — governed metric authoring.

**Design: a legible pipeline spine in Model mode** — render the three as an explicit staged flow the Steward *assembles*:

```
 ┌─ SOURCE ─────┐   ┌─ CUBE PROFILE / DSD ─┐   ┌─ GOVERNED METRIC ─┐
 │ upload/ingest│ → │ dims · measures ·    │ → │ metric-ref noun,  │
 │ · test·browse│   │ DSD version (expert) │   │ calc/derived      │
 └──────────────┘   └──────────────────────┘   └───────────────────┘
```

- Make **"define raw data" prominent**: the Source/ingest stage gets **equal billing** with the metric catalog (today it's below a divider), and the **cube-profile/DSD middle stage becomes a visible node** (it exists only implicitly now via Browse).
- Each stage is clickable → its existing editor (reuse `SourceAuthoringPanel`, `DsdVersionPanel`, `MetricCatalogManager` — **do not reinvent the engine**).
- **Honesty boundary (owner's mandate):** the DSD/SDMX stage is expert-grade — label it as such, guide it, but **never dead-end**. A metric that has no upstream source shows the missing stage, not a blank.
- **Role-is-lens preserved:** the pipeline stays behind the Steward lens (`FF-AUTHOR-NO-QUERY`, `FF-ROLE-IS-LENS`) — authors bind governed nouns via the Metric Palette; stewards define. This is the honesty boundary as a lens, not a lock.

This is a **surface reorganization + a legible pipeline model**, not new engine — lower priority than D7 per the phasing.

---

## 8. ADR-022 (engine change) — rejected alternatives (full ceremony)

**Decision:** additive `PropField.itemSchema?: PropSchema` (+ `itemLabel?`, `itemGroups?`) in `packages/core`, rendered by a generic recursive nested editor.

- **(A) Bespoke per-item editors** (`KpiItemEditor`, `HeroCardEditor`, …). **Rejected:** violates the one-Inspector / OCP mandate; N editors to build and maintain; a new nested type needs new UI — the exact anti-pattern the schema-driven Inspector was built to kill.
- **(B) Status quo — raw-JSON textarea.** **Rejected:** not authorable by non-programmers, zero discovery, error-prone, fails the 100%-authorable invariant. This is the defect being fixed.
- **(C) New `PropFieldType` `'array-of'`/`'object-of'`.** **Rejected:** forks the `array`/`object` types, breaks every existing meta and the `isOpaqueNested` predicate (which already keys off `'itemSchema' in field`), and gives a field no graceful opaque fallback. Additive property = smaller blast radius, OCP-cleaner, pre-committed by the codebase.
- **(D) Adopt JSON Schema `items` wholesale for nesting.** **Rejected:** the platform's authoring vocabulary is **PropSchema** (richer: `enum-ref`+`source`, `coverage:'localized'`, `showWhen`). `itemSchema = PropSchema` keeps **one** vocabulary at all depths; `propSchemaToSubSchema` already bridges to JSON Schema at the *wire* boundary. Forking the vocabulary at depth would split the model.

**Trade-off named (ISO 25010):** buys *usability* (deep authorability) + *maintainability* (one generic editor) at a small *complexity* cost in the nested editor + coverage recursion. Reversible (additive) → not a one-way door.

---

## 9. One-way doors & owner decisions

| # | Decision | Recommendation | Reversible? |
|---|---|---|---|
| 1 | Filter controls: **BRIDGE** (keep page drawer + add node drill) vs MOVE (drill only) | **BRIDGE** — two entry points, one model | Yes |
| 2 | Add `itemLabel` (item display-title dot-path) to `PropField` | **Yes** — tiny additive, large UX win | Yes |
| 3 | Interaction weight thresholds (`≤4 fields → inline`) | Adopt as tunable default | Yes (tunable) |
| 4 | `OPAQUE_BY_DESIGN` allowlist = `{wrap.styles, repeat.each, geograph.geoCodeMap}` | Owner ratifies the exact set | Yes |
| 5 | Raw-data pipeline stays **Steward-gated** (honesty boundary as lens) | **Yes** — keep role-is-lens; make legible, not open | Yes |

**No hard one-way doors.** Every change is additive/reversible: `itemSchema` is optional (old configs unaffected), the filter bridge is read+write-through to the existing SSOT (no migration), the pipeline is a UI reorg. Schema versioning: no config migration required — a stored config with no `itemSchema`-authored nested value is byte-identical before/after.

---

## 10. Phased build plan (engine FIRST, full ceremony)

- **D7.0 — Engine (ADR-022, full ceremony).** Additive `PropField.itemSchema`/`itemLabel`/`itemGroups` in `packages/core`; `propSchemaToJsonSchema` recursion (wire lossless); `validateConfig` recursion; coverage-recursion in `schema-contract.ts`; extend `schema-completeness.fitness` for nested (no new opaque). **No UI.** The single one-time engine change.
- **D7.1 — Generic nested editor.** `ArrayOfControl` + `ObjectControl` in `apps/panel`; `FieldControlRegistry` precedence; the drill-in/inline/popover shells + breadcrumb (`useDrillStack`) + canvas double-click/Esc gesture. Recursion validated. Raw-JSON retired for `itemSchema` fields.
- **D7.2 — Drain the backlog.** Give each `SCHEMA_TODO` field its `itemSchema` (kpi-strip.items→KpiSpec, hero.cards→HeroCardDef, chart axes/legend, table.columns, slides, links, crumbs, gauge steps…). Each removal is *forced* by the fitness `stale` check. Terminal gate: `SCHEMA_TODO === {}` (minus `OPAQUE_BY_DESIGN`).
- **D7.3 — Filter-control drill.** The node→filterSchema bridge (§5): reach a specific control from the selected filter-bar node.
- **D8 — Raw-data pipeline surface.** The legible ingest→cube→metric spine in Model mode (§7); make define-raw-data prominent; honor the honesty boundary.

**Sequencing rule:** D7.0 lands and stabilizes (with its ADR) *before* any editor work — the engine seam is the contract everything above depends on, and it must be got right once. D7.2 can proceed field-by-field in parallel once D7.1 exists. D8 is independent of D7 and can run anytime after D7.0.

---

## 11. Invariants honored

- **Dependency arrow (Law 3):** `itemSchema` lives in `packages/core` (importable by all); editors live in `apps/panel`; engine names the seam, panel binds the control — no upward import.
- **Config is data, logic in the renderer (Law 2):** `itemSchema` is pure data; filter controls stay in the filterSchema SSOT (no denormalization); no functions/`fetch`/`eval` introduced.
- **Semantic spine (Law 5) / role-is-lens:** raw-data pipeline stays Steward-gated; authors bind governed nouns.
- **OCP (Law 8):** new nested type = a populated optional field + (if needed) one control registration; `PropField`/`SliceMeta`/`Inspector` interfaces unchanged.
- **YAGNI:** reuse `FiltersDrawer`/`ParamDefEditor`/`SourceAuthoringPanel`/`MetricCatalogManager` machinery; build the *seam* and the *reach*, not parallel systems.
- **Accessibility (Law 9):** the nested editor inherits the Inspector's grouped `<fieldset>`/`<legend>`, labelled controls, and keyboard model; breadcrumb + Esc are keyboard-first.
</content>
</invoke>
