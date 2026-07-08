---
name: alwaysresolve-seam
description: ParamHidden.alwaysResolve flag — bar-independent default resolution, collapses per-bar hidden-param duplication
metadata:
  type: reference
---

`alwaysResolve?: boolean` on `ParamHidden` (audit FINDING 3, 2026-06) — OCP-clean seam (new optional flag, interface unchanged) for a bar-independent hidden-param default.

- Type: `platform/packages/core/src/config/filter-params.ts` `ParamHidden` (and flows to `ParamHiddenNode` via the Omit pattern). Authoring schema: `param-schemas.ts` `hiddenSchema` gains a `boolean` field (Constructor-authorable).
- **Gate (current, post perspective-axis P6):** `platform/packages/react/src/filters/useFilterState.ts` `defaultParams` filter — `isAlwaysResolve(def) || ownsActive?.has(key) || !ownsAny?.has(key)`. Default resolution is gated by **perspective OWNERSHIP** (`perspectiveOwnedParamKeys`, [[project_perspective_axis]]), NOT bar visibility — the original `!barShowWhen || evalWhen(barShowWhen,state)` branch was DELETED in P6 once every config migrated off bar-scoped gating. `alwaysResolve:true` still hoists a param OUT of the ownership gate the same way it hoisted it out of the old bar gate.
- WHY: span/cube-derived state vars (spanFrom/spanTo = full data extent) are PAGE-level, not owned by any one perspective — must resolve regardless of the active perspective. Lets them be declared ONCE instead of copy-pasted per bar/perspective.
- Applied in `platform/apps/api/provisioning/geostat.provisioning.json`: spanFrom/spanTo declared ONCE (now in the single collapsed filter bar) with `alwaysResolve:true`.
- Generic: any hidden param, any dataset. Absent/false = byte-identical ownership-gated behaviour.
