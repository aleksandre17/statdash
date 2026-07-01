---
name: alwaysresolve-seam
description: ParamHidden.alwaysResolve flag — bar-independent default resolution, collapses per-bar hidden-param duplication
metadata:
  type: reference
---

`alwaysResolve?: boolean` on `ParamHidden` (audit FINDING 3, 2026-06) — OCP-clean seam (new optional flag, interface unchanged) for a bar-independent hidden-param default.

- Type: `platform/packages/core/src/config/filter-params.ts` `ParamHidden` (and flows to `ParamHiddenNode` via the Omit pattern). Authoring schema: `param-schemas.ts` `hiddenSchema` gains a `boolean` field (Constructor-authorable).
- Gate: `platform/packages/react/src/filters/useFilterState.ts` `defaultParams` filter — `isAlwaysResolve(def) || !barShowWhen || evalWhen(barShowWhen, state)`. Default resolution is normally gated by the owning bar's `showWhen` (so a hidden year-bar's `time` pin does not bleed into range mode); `alwaysResolve:true` hoists a param OUT of that gate.
- WHY: span/cube-derived state vars (spanFrom/spanTo = full data extent) are PAGE-level, not a property of one bar's visibility — must resolve in every time-mode. Lets them be declared ONCE instead of copy-pasted into each bar.
- Applied in `platform/apps/api/provisioning/geostat.provisioning.json`: spanFrom/spanTo now declared ONCE in year-bar with `alwaysResolve:true` (removed the range-bar duplicates). context.dims still maps them (present in year-bar).
- Generic: any hidden param, any dataset. Absent/false = byte-identical bar-gated behaviour.
