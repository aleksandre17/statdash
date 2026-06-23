---
name: project-commandbus-migration
description: CommandBus wired in SiteRenderer; GeorgraphShell + panel ExportBar shells migrated; controls use useFilter() not ctx.set
metadata:
  type: project
---

CommandBus is fully wired in `SiteRenderer.tsx` with handlers for `filter:set`, `filter:clear`, `filter:setMany`, `mode:set`, `nav:drill`, `data:export`.

**Migrations completed (2026-06-17):**
- `GeorgraphShell` — removed `useSearchParams`/`setParams`; `handleSelect` now dispatches `filter:set` / `filter:clear` via `ctx.bus.dispatch`.
- `ExportBar` — added `onExport?: (format: 'csv'|'xlsx') => void` prop (backward compat: absent = internal `useExport` download still runs).
- `TableShell`, `ChartShell`, `GaugeShell` — pass `onExport={fmt => ctx.bus.dispatch({ type: 'data:export', ... })}` to ExportBar.

**Controls NOT migrated — by design:**
`CascadeShell`, `SelectShell`, `YearSelectShell`, `MultiSelectShell`, `RangeShell` use `useFilter().set` from `FilterContext`, NOT `ctx.set`. `FilterControlSlice.Shell` is typed `ComponentType<{ filterKey, config }>` — no `ctx` prop. Wiring `ctx.bus` into controls requires changing that type in `engine/react` (architectural change, escalate to Opus if needed). The underlying call path is the same: `useFilter().set` → `filterSet` → same closure `ctx.bus` calls.

**Why:** CQS — all observable state mutations flow through the bus so middleware (logging, analytics, undo) can intercept them at one point.

**How to apply:** For any new shell that changes filter/navigation state, use `ctx.bus.dispatch(...)` not `useSearchParams`, not `ctx.set`.
