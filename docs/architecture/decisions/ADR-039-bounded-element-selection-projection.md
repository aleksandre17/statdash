# ADR-039 — Bounded-Element Selection Projection (the canvas selects, and the inspector projects, any declared value-band item)

**Status:** ACCEPTED (2026-07-11). **Extends:** ADR-038 (The Bounded Element Law — governing). **Implements:** work item 0060 (BE-1), 0057 (FF-NO-EXTERNAL-SPECIAL-CASE). **Scope:** the authoring canvas selection model, the WYSIWYG overlay, and the RightDock inspector projection.

## Context (the owner's #1 live-panel symptom)
> "You can't click a KPI card separately — clicking a KPI selects the whole strip; and clicking a KPI dumps EVERYTHING onto the right and it doesn't fit."

A KPI card is a **value-band item** (`kpi-strip.items[]`, a `KpiSpec`) — a bounded element under ADR-038, whose contract is already DECLARED (`KpiStripSchema.items.itemSchema = KpiItemSchema`). But the authoring selection model addressed only whole **stored tree nodes** (`selectedNodeId: string`), so a band item was unreachable on the canvas, and the dock rendered the strip's whole schema (the `items` array band) at once. Both are ADR-038 violations: selection was not per-element, the inspector was not a bounded projection.

The reverted anti-pattern (work item 0056: `registerNodeProjector('kpi-strip', { toNode: kpiSpecToCardNode })`) reached for this capability the WRONG way — an external per-type hand-wire that promotes items into nodes. ADR-038 §Consequences mandates the lawful form: **derive the projection from each element's declared contract, generically.**

## Decision
Model selection as a **Composite address** and make selection + render + inspector three **generic projections over the declaration** — no per-type branch anywhere:

1. **Selection address = (node, item-path).** Add `selectedItemPath: string | null` (a dot-path into `node.props`, e.g. `'items.0'`) alongside `selectedNodeId`; `selectItem(nodeId, path)` pins both. A whole-node selection is the `path === null` case (backward-compatible).
2. **Band discovery is a pure projection of the declaration** (`bandItemsOf` / `bandFieldsOf`): a value-band is any `PropField` of `type:'array'` carrying an `itemSchema`. There is NO concrete-type check — a new band-owning element (hero cards, R3, …) is discovered with zero new code (OCP · DIP).
3. **The render-side anchor is ONE generic primitive** — `BandItemBoundary` (`@statdash/react/engine`), the Builder.io `<Blocks>` / Craft.js `<Element>` contract. A band-owning shell wraps each declared item in it; it emits a queryable, layout-inert (`display:contents`) anchor **only inside an authoring canvas** (`AuthoringAnchorContext`), and a zero-DOM Fragment everywhere else — so runtime output and FF-PROMOTION-LOSSLESS stay byte-identical. The overlay measures those anchors and draws one selection frame per item.
4. **The inspector is a bounded projection** over the selected item's OWN `itemSchema` (`fixedSchemaSource` + the generic `Inspector`), written through the item path — the SAME Inspector, a different declaration source (Strategy / DIP). The strip's other cards and the array band never appear → the dock FITS.

Enforced by fitness: **FF-NO-EXTERNAL-SPECIAL-CASE** (no per-type literal / projector in the generic layers; band selection derives from `itemSchema`), complementing the existing **FF-SCHEMA-COMPLETE** (every element declares its contract) and **FF-PROMOTION-LOSSLESS** (the anchor is inert off-canvas).

## Rejected alternatives
1. **Resurrect the node-promotion projector (`registerNodeProjector` / render each card as a promoted `kpi-card` node in the canvas).** Rejected: it is the exact reverted anti-pattern (0056) — external per-type knowledge of a concrete element's internals; it is implemented for `kpi-card` ONLY (not generic to "any band"), and couples selection to the dark/unverified promotion residence. Violates ADR-038 §2 (no external special-casing).
2. **Count-and-repeat DOM heuristic — the overlay guesses per-item geometry by matching a container's N element-children to the declared item count, with no plugin cooperation.** Rejected: fragile (class/structure-coupled, misfires on wrappers/empty states), and it smuggles rendering assumptions into the generic overlay. Not a highest-standard cut.
3. **Per-plugin `data-*` attributes hand-added in each shell.** Rejected: not generic — every future band element would re-invent the attribute; the overlay would risk coupling to plugin-specific markers. Superseded by the ONE shared `BandItemBoundary` primitive (uniform contract, machinery unchanged).

## Consequences
- New public engine surface (additive, inert-by-default): `BandItemBoundary`, `AuthoringAnchorContext`, `BAND_ITEM_FIELD_ATTR`, `BAND_ITEM_INDEX_ATTR`. Rollback = delete the module + revert one barrel line + two consumer call-sites; nothing touches stored config/DB.
- A band-owning shell opts in with ONE wrap (`<BandItemBoundary>`); the selection / overlay / inspector machinery is unchanged for every new band element (OCP — the law's proof).
- Verified LIVE (Playwright, real Vite bundle in Chromium, `bandItemSelect.e2e.ts`): clicking a single KPI card selects it as a bounded element; the dock shows only that card's contract and FITS; the existing strip drill-in is not regressed.

---

## Delta — BE-4: the filter-bar's filters are a declared, generically-projected band (work item 0062)

**Status:** DESIGN SETTLED (2026-07-12). **Owner symptom:** *"the filtration items are also not objects."* In the canvas, an individual filter (account-select, year-select, from/to, …) is not clickable as a bounded element the way a KPI card is; only the whole filter-bar node selects.

### Root — why BE-1's machinery does not already cover it
BE-1 (above) makes a band item selectable when it is a **homogeneous props band**: a `PropField` of `type:'array'+itemSchema` whose values live in `node.props[field]`, read/written by dot-path (`getAtPath`/`setAtPath`). The filter items break BOTH of that model's assumptions:

1. **Value residence.** Filters are NOT on the filter-bar node. They live in the **page** SSOT — `page.meta.filterSchema.bars[barId].filters` (a `Record<key, ParamDef>`). The filter-bar node is a *placeholder* that projects whichever page bars its `barIds` selects (Grafana: the variable-controls panel is separate from the dashboard-level variable list). Multiple filter-bar nodes may project the same page bars. `FilterSchemaInput` is explicitly *"Owned by PageConfig, NOT by FilterBarNode."*
2. **Discriminated schema.** A homogeneous band has ONE fixed `itemSchema`. A filter item's authoring contract is **discriminated by its `type`** — resolved through the engine's `param-schema-registry` (`getParamSchema(type)`), the same registry the Constructor's `filterParamSchemaSource` already reads. There is no single `itemSchema` that fits.

### Decision — a generic **BandSource** port; the node DECLARES which source it projects (no per-type wire)
Generalize BE-1's "one homogeneous props band" into a declared **BandSource** (Strategy / DIP) that BE-1's selection · overlay · inspector machinery consume unchanged. A BandSource answers, generically: *enumerate my items* (each carrying its OWN resolved `itemSchema` — homogeneous or discriminated), *read one item's object*, *write one item's subfield*. Two adapters:

- **`propsBandSource`** — today's BE-1 band (values in `node.props`, one `itemSchema`, `getAtPath`/`setAtPath`). Unchanged behaviour; kpi-strip keeps working byte-identically.
- **`filterSchemaBandSource`** — values in the **page filterSchema SSOT**, enumerated via the EXISTING `toBarViews` projection, per-item schema resolved via `getParamSchema(param.type)` (discriminated), written via the EXISTING `setBarParams`/`commitBar` reducer path. **Zero SSOT fork** — the runner (`useFilterState`) and the authoring band read/write the ONE `filterSchema`; the reconciliation is the already-shipped `filterSchemaModel` (`toBarViews`/`setBarParams`), so no `packages/react` runner change is required.

The filter-bar node **DECLARES** its band in its registered META — a generic, type-neutral descriptor (a `band` source id), NOT an external `type === 'filter-bar'` branch. The canvas resolves `getBandSource(meta.band.source)` and projects. Any future node that projects a page-owned or otherwise-external discriminated band declares the same descriptor and is selectable for free (OCP — the machinery never changes). The render-side anchor stays the ONE primitive (`BandItemBoundary`): `FilterBarShell` wraps each rendered control keyed by its `(barId, key)` coordinate, so the overlay frames each control with no plugin-specific marker. The selection address generalises from a `node.props` dot-path to a source-scoped item address; the dock's item branch becomes a pure projection over the resolved selection's `{ itemSchema, itemObject, onChange }` — MORE lawful than today's direct `selected.props` reach.

### Rejected alternatives
1. **Declare `filters` as a value-band ON the filter-bar node (denormalise the page filters onto `node.props.filters` with an `itemSchema`).** Rejected — **forks the SSOT**: it copies page-owned filters onto the node, contradicting `FilterSchemaInput`'s page ownership and the runner + `useFilterBarAuthoring` write-through invariant (multiple filter-bar nodes would each hold a divergent copy). And a single `itemSchema` cannot express the discriminated `ParamDef` union. Violates CLAUDE.md Law 2/SSOT and the card's "don't fork the SSOT."
2. **A second, filter-only selection + inspector path (extend the existing `FilterBarControlsBridge` drill-list into the canvas).** Rejected — a PARALLEL authoring path (a list→drill panel in the node context) already exists; promoting it as the canvas gesture would leave two selection models and defeat the owner's "everything on the same object logic." The BandSource unifies filters onto the SAME BE-1 gesture (click item → bounded selection → its declared contract), one machinery.
3. **Overlay count-and-repeat DOM heuristic to find filter controls without a shared anchor.** Rejected for the SAME reason BE-1 rejected it (fragile, structure-coupled) — the `BandItemBoundary` primitive already solves it uniformly.

### Fitness
- **FF-NO-EXTERNAL-SPECIAL-CASE** stays green — the filter band is chosen by the node's DECLARED `band` descriptor + a registered BandSource, never a `type === 'filter-bar'` literal in a generic layer.
- **FF-FILTER-ITEMS-DECLARED-BAND** (new) — locks that (a) the filter-bar META declares a band descriptor; (b) the `filterSchemaBandSource` resolves each item's schema through `getParamSchema` (discriminated, derived from the ONE ParamDef declaration) and its write through `setBarParams` (the SSOT reducer, no denormalised copy); (c) selecting a filter item yields a bounded `itemSchema` projection, proven on the REAL registered ParamDef schemas — not a synthetic fixture.

### Scope note (for the implementing slice — this is NOT apps/panel-only)
The reach spans three layers (each additive, reversible): `packages/react` — a generic optional `band` descriptor on `NodeSliceMeta` (dist rebuild); `packages/plugins` — `FilterBarShell` wraps each control in `BandItemBoundary(barId,key)` + the filter-bar META declares the descriptor (dist rebuild); `apps/panel` — the `BandSource` port + the two adapters + the overlay/controller/dock generalisation + the FF + a Playwright real-boot e2e (`filterItemSelect.e2e.ts`, modelled on `bandItemSelect.e2e.ts`). The `filterSchema` runner SSOT is untouched (reconciled via the shipped `filterSchemaModel`), so the ADR-038 exit-condition (SSOT can't reconcile cheaply) does not arise.
