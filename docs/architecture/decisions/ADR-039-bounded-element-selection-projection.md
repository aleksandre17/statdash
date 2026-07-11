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
