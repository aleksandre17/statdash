---
name: part-anchor-merge
description: ADR-041 Phase 4 anchor merge — ONE PartAnchor + data-part-* family; overlay frames via port-recursion with a walkNodes fallback (accepts-gating blocks full walk removal)
metadata:
  type: project
---

ADR-041 Phase 4 (the anchor merge) is LIVE: `packages/react/src/engine/partAnchor.tsx` (generalizes the retired `bandAnchor.tsx`) exports ONE `<PartAnchor>` + ONE `data-part-*` attribute family covering value/sourced band items (`data-part-field`/`data-part-index`) AND slot children / whole nodes (`data-part-node-id`/`data-part-node-type`). `BandItemBoundary` + `BAND_ITEM_FIELD_ATTR`/`BAND_ITEM_INDEX_ATTR` stay exported as byte-identical aliases (BE-1 names → the new PART_* values). The panel node-anchor middleware (`setupCanvasRegistry.ts`) stamps the merged `PART_NODE_ID_ATTR`, so `CanvasOverlay` measures node anchors AND part anchors through ONE query family.

**Why:** unify BE-1/BE-4/BE-5's parallel anchors into the ONE Part port (a step toward blank-page composition) — the render-side half of the Bounded-Element reform.

**How to apply:** the overlay's node-frame TREE now derives by RECURSING `enumerateParts` (slot part = a whole child node framed via its merged node anchor; value/sourced part = an item frame) — kind-free (FF-DERIVED-CONTAINMENT). A transitional `walkNodes` pass is RETAINED as a fallback (deduped by a `framed` Set) so no node loses a frame → byte-identical frame set (Strangler EXPAND, not contract).

**The constraint that blocks removing walkNodes (for the later contract phase):** `slotParts` is `accepts`-gated (a child whose `type` ∉ the parent slot's `accepts` is NOT enumerated) and reads ONLY declared slot FIELDS. The existing selection e2e seeds put a `kpi-strip`/`filter-bar` directly in `inner-page.children` (whose `main` slot accepts only section/repeat/page-header) — so port recursion does NOT reach them; the walkNodes fallback frames them. Making `slotParts` the SOLE frame authority would drop those frames (breaks `bandItemSelect`/`filterItemSelect` e2e) and regress selection for any accepts-noncompliant stored child. Removing walkNodes waits until every container child is a declared, accepts-valid slot part (guarded by FF-COMPOSITE-INTEGRITY: children ∈ declared slots.accepts). See [[registry-over-special-case]].
