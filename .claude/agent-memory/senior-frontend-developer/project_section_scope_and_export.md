---
name: section-scope-and-export
description: "ExportBar→ExportMenu (compact icon menu, NodeExportContext publish/subscribe) + the data-integrity indicator's page-level scope (NodeStatusContext two-channel). Both are section/page-scoped publish-up/read-down seams built on the same Option-D pattern. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (export-menu-and-section-scope,
> integrity-indicator-page-scope).

## ExportMenu — the section-scoped export seam
Redesign: per-panel `ExportBar` (one text button per format, dozens per page) → **`ExportMenu`**
(`packages/react/src/components/feedback/ExportMenu.tsx`) — ONE compact download-icon menu-button,
full WAI-ARIA menu pattern (roving Arrow, Enter/Space open+focus-first, Esc, click-outside).
Placement: SECTION HEADER actions row, sibling of the copy-link permalink button. Download path
unchanged (`data:export` bus → `downloadExport`, CSV BOM / xlsx OOXML intact).

**The reusable seam — `NodeExportContext.tsx` (packages/react/engine), the EXPORT twin of
NodeStatusContext (below), the exact Option-D rows-aggregate consumer SectionShell reserved:**
- `useReportPanelExport(nodeId, rows, meta)` — panels PUBLISH `{rows,meta}` up; visibility-gated
  (reuses NodeVisibilityContext so a toggled-hidden view clears, only the on-screen slice exports);
  returns `scoped` (false ⇒ inline-menu fallback for a standalone panel with no section ancestor).
- `useExportScope()` → `{collector, hasExport, readActive}`. **Section owns the scope (not the
  page — export is per-section, Law 9; unlike NodeStatus, which moved UP to page, see below).**
- **Loop-safe pattern (reuse this for any similar aggregate):** PRESENCE lives in React state
  (mount/unmount/visibility only), ROWS are read from a REF at CLICK time via `readActive()` — a
  churning `ctx.rows` identity never re-triggers a re-render loop.
- Type `PanelExportData` (deliberately not `PanelExport` — that name is the component in the main
  barrel; two barrels, avoid the clash).

## Data-integrity indicator — ONE page-level indicator (AR-40)
Consolidated from per-section (AR-39, `.section__integrity`) + a per-strip freshness badge to ONE
page-level indicator in `.page-header__right` (`.page-header__integrity`).

**Why the scope MUST live at inner-page, not page-header:** page-header and sections are SIBLINGS
under `inner-page` (`InnerPageShell` renders `children.rendered` = [page-header, sections...]).
React context flows down, so page-header cannot wrap its sibling sections' panels — only the
common ancestor (the page root) can. `InnerPageShell` owns `useNodeStatusScope()` and wraps the
page body in `NodeStatusProvider`; page-header only SUBSCRIBES.

**Two-channel `NodeStatusContext`** (`packages/react/src/engine/NodeStatusContext.tsx`):
publish channel (`NodeStatusContext`, panels report up via `useReportNodeStatus`, stable identity)
+ read channel (`NodeStatusAggregateContext`, the OR-folded aggregate flows down via
`useNodeStatusAggregate()`). Only aggregate-consumers (page-header) re-render on a fold change;
sections/panels touching only the stable collector don't. `NodeStatusProvider` now requires BOTH
`collector`+`aggregate`.

**kpi-strip publish gotcha (reusable pattern for any "folding" panel):** a kpi-strip's true
preliminary flag is a FOLD over its per-item flags, which the generic `resolvePreliminary(def,ctx)`
can't see (a strip has no single `measure`/`ctx.rows`). `usePanelTitleBadge` gained a 4th optional
arg `preliminaryOverride` — the strip passes `anyPreliminary || undefined` so the page summary
keeps KPI provenance.

**What stays local:** per-cell OBS_STATUS 'p' flags + the table footer legend (page indicator =
summary, per-cell = detail). i18n labels live in each slice's own `meta.ts` `i18n` block, moved
from `section`/`kpi-strip` namespaces to `page-header` (`preliminary`/`preliminary-short`/
`data-integrity`). Removed the old unstyled `PreliminaryBadge` entirely (no CSS ever existed).

**Fitness:** `FF-ONE-INTEGRITY-INDICATOR` (page-header data-integrity.fitness, real
publish/subscribe seam) + `FF-INTEGRITY-REACHABLE` (not color-only: dot + label + caption).

**Same-commit responsive fix:** `.section__title-wrap` given `--section-title-min:16rem` floor
(`flex:1 1 var;min-width:min(100%,var)`) so a long title wraps `.section__actions` to line 2
instead of cramping the title.
