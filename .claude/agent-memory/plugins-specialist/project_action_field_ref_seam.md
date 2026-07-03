---
name: action-field-ref-seam
description: Cross-filter FilterAction.key/fromField now accept {$ctx} refs (resolveActionField); the composition table's _selKey is CONSTANT "region" today by design — it rotates only when AR-38's sector-focus arm lands
metadata:
  type: project
---

`FilterAction.key`/`fromField` (packages/react node-events) were Postel-widened to `ActionField = string | CtxScopeRef`, lowered at the ONE write point via `resolveActionField` (useNodeInteractions, dims→vars fallback — same dispatcher as resolveEncodingRefs). Landed on branch `fix/composition-interactivity` (2026-07-03) to fix the composition table going inert in State B: PivotTable got the WCAG select affordance on the SERIES/column axis (region), DataTable forwards onRowSelect to it, and the sectors table writes `key:{$ctx:_selKey}`.

**Why:** the composition pivots (State A rows=region SimpleTable ↔ State B rows=sector, region on series axis PivotTable); the same click must keep targeting the `region` param through the rotation.

**How to apply:** `_selKey` page var is CONSTANT `"region"` in the shipped region arm — do NOT delete it as a pointless indirection. It is the seam DESIGN-directional-sector-crossfilter.md §4.1 (AR-38, sector arm) extends: when a sector-focus click lands, `_selKey` flips to `"sector"`. The rotation of the selectable AXIS (row→series) lives in PivotTable (renderer knows its own orientation), not in the derive. enc.id="geo" ⇒ a pivot row's `id` is the region code in BOTH states, so `fromField:"id"` stays literal. See [[feedback_variant_spine_vs_runtime_state]] for the "runtime selection ≠ authored spine" rule this respects.
