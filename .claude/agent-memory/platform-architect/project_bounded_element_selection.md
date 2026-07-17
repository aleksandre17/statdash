---
name: project-bounded-element-selection
description: ADR-039 BE-1 bounded value-band selection is BUILT + e2e-VERIFIED on feat/ar49 — Composite (node,item-path) selection + BandItemBoundary render-contract + bounded item Inspector; FF-NO-EXTERNAL-SPECIAL-CASE green
metadata:
  type: project
---

**BE-1 (the owner's #1 "click a KPI card separately, dock shows only its contract + FITS") is BUILT + e2e-VERIFIED** on `feat/ar49-m0-metric-first-authoring` (commit 17d30dc, 2026-07-11). ADR-039 (`docs/architecture/decisions/ADR-039-bounded-element-selection-projection.md`) extends ADR-038 [[project-adr038-trunk-state]]. Do NOT rebuild it.

**The seam (all declaration-driven — no per-type branch anywhere):**
- **Selection = Composite address `(node, item-path)`**: store `selectedItemPath: string|null` + `selectItem(nodeId, path)` (`apps/panel/src/store/constructor.store.ts` + `.history.ts` StudioUiSlice + `.selectors.ts` `useSelectedItemPath`). Whole-node = null-path case. Preserved across undo/redo.
- **Band discovery** `bandFieldsOf`/`bandItemsOf` (`apps/panel/src/canvas/bandItems.ts`): a value-band = ANY declared `array` PropField carrying `itemSchema`. Pure projection; new band-owning element = zero new code (OCP). Two representations share it (overlay passes the flattened node; inspector passes `node.props`).
- **Render anchor = `BandItemBoundary`** (`packages/react/src/engine/bandAnchor.tsx`, exported from engine barrel): the ONE generic render contract (Builder.io `<Blocks>` pattern) a band-owning shell opts into. Emits `data-canvas-item-field/-index` (`display:contents`, inert) ONLY inside `AuthoringAnchorContext` (provided by `CanvasView`); a zero-DOM Fragment off-canvas → runtime + FF-PROMOTION-LOSSLESS byte-identical. `KpiStripShell` wraps each legacy `<KpiCard>` (unified visible-set carries the ORIGINAL store index).
- **Overlay** (`CanvasOverlay.tsx`) measures the anchors → one `.canvas-item` frame per declared item → `onSelectItem`; suppresses the parent node's selected chrome while an item is active.
- **Bounded Inspector**: RightDock `element.schema` section (`inspector/sections/builtins.tsx`) projects the SAME generic `Inspector` over the item's OWN `itemSchema` via `fixedSchemaSource` when `selectedBand` is set (derived in `useCanvasController`); node-only sections (context/visibility) scope to `wholeNodeSelected`; footer Delete hidden under an item.

**Gates (green):** `FF-NO-EXTERNAL-SPECIAL-CASE` = `apps/panel/src/canvas/noExternalSpecialCase.fitness.test.ts` (work item 0057 — negative source-scan + positive itemSchema-derivation, proven bites). Playwright real-bundle `apps/panel/e2e/bandItemSelect.e2e.ts` PASSES (getByDisplayValue does NOT exist in this PW build — use `.insp-locale__input` + `toHaveValue` and dock-scoped `getByText`). Panel vitest 776/0 · tsc -b apps/panel 0 · root tsc -b --force 0 · lint 0 errors. Work items 0060 + 0057 → done.

**Do NOT resurrect** `registerNodeProjector`/`nodeProjection` (ADR-039 rejected alt #1 — the reverted 0056 anti-pattern). Canvas anchoring is the `BandItemBoundary` primitive, NOT node-promotion-in-canvas.
