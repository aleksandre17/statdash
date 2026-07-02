---
name: project-cross-filter-capability
description: Cross-filter / "Grammar of Interaction" — the declarative selection→ctx→all-panel seam; port exists but adapter is unwired; design at platform/work/DESIGN-cross-filter-interaction.md
metadata:
  type: project
---

Owner-core capability (NOT future): select N regions / a sector → ALL panels + KPIs rescope; "logical binding everywhere". Design spec: `platform/work/DESIGN-cross-filter-interaction.md`.

**Diagnosis (non-obvious): the READ side already works; only the general WRITE side is missing.**
- Panels binding `{$ctx:"<dim>"}` re-query on `ctx.dims` change; store-filter (`resolveFilter` / `matchedValues` in `core/src/data/store-filter.ts`) splits a CSV `$ctx` value into an OR-set, so 2-region multi-select `= ANY` ALREADY works end-to-end at the data layer. No store change needed.
- `useKpiRows` already memoizes on `sectionCtx`+`filterParams` and recomputes when dims change — KPI "staleness" is NOT a reactivity bug; the regional KPI specs are AUTHORED with literal `geo:"_T"`/`sector:"_T"` pins instead of `{$ctx:"geo"}`. Fix = binding migration, zero machinery.
- Write side: only `GeographShell.handleSelect` has bespoke click→filter (→ `ctx.bus.dispatch('filter:set')`). Chart `useChartInteractions.onDataClick` dispatches ONLY `navigate` (drops the `action==='filter'` branch). Table shells have NO click wiring. The declarative seam (`NodeBase.on[]` / `FilterDataLink` target:`'filter'` / `NodeEventHandler` / `FilterAction` in `node-events.ts` + `links/`) is typed + core-resolved but consumed by NO shell — exercised only by `crossFilter.test.ts` pure-logic mocks. **Hexagonal port with no adapter + a first-tenant one-off (geograph).**

**Design (reuse, no parallel state):** selection IS a filter param (SSOT, URL permalink). Promote the dead `on[]` seam to a live shell-agnostic adapter `useNodeInteractions(def,ctx)` that reads `def.on[]`+`def.dataLinks` filter-branch → dispatches `filter:set`/`setMany`/`clear` via the ONE CommandBus write point. Extend `FilterAction` with `mode: replace|toggle|clear` + `max` (multi-select accumulation = geograph's inline logic lifted to a pure `applySelection` reducer). Retire geograph's bespoke path to the shared seam (Strangler-Fig). CommandBus write point: `SiteRenderer.tsx:235-242`; context.dims map: `filterSchema.context.dims` (dimKey→paramKey).

**Why:** owner's value-parity work missed this; "select 2 regions → everything scopes" is the core expectation. **How to apply:** any interaction/linked-view work reuses params+`$ctx`+CommandBus+`on[]`; refuse a separate SelectionContext (rejected alt A) and per-shell bespoke click handlers (rejected alt B, Shotgun Surgery / first-tenant erosion). See [[feedback-maximal-orthogonality]].
