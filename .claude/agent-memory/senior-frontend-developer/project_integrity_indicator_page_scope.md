---
name: integrity-indicator-page-scope
description: AR-40 — the preliminary/data-integrity indicator is ONE page-level indicator (page-header__right), not per-section/per-strip. NodeStatusContext is now a TWO-channel scope owned by inner-page (page root); page-header subscribes. Where each piece lives + the kpi-strip publish gotcha.
metadata:
  type: project
---

The data-integrity (preliminary) indicator is consolidated to **ONE page-level
indicator** rendered in `.page-header__right` (`.page-header__integrity`). It was
per-section (AR-39, `.section__integrity`) + a per-strip freshness badge; AR-40
moved the OWNING SCOPE from section → page. Branch `feat/integrity-pageheader`
(commit 7657e4f), un-merged as of 2026-07-03.

**Why the scope MUST live at inner-page, not page-header:** page-header and the
sections are SIBLINGS under `inner-page` (InnerPageShell renders `children.rendered`
= [page-header, sections...]). React context flows DOWN, so the page-header cannot
wrap its sibling sections' panels. The common ancestor is the page root, so
`InnerPageShell` owns `useNodeStatusScope()` and wraps the page body in
`NodeStatusProvider`. The page-header can only SUBSCRIBE.

**Two-channel NodeStatusContext** (`packages/react/src/engine/NodeStatusContext.tsx`):
- publish channel (`NodeStatusContext`, the collector) — panels report UP via
  `useReportNodeStatus`; collector identity is stable (useMemo []).
- read channel (`NodeStatusAggregateContext`) — the OR-folded aggregate flows DOWN;
  `useNodeStatusAggregate()` lets a descendant subscriber (page-header) read it.
  Only aggregate-consumers re-render when the fold changes (page-header re-renders;
  sections/panels don't, since children.rendered element refs are stable + they
  only touch the stable collector).
- `NodeStatusProvider` now takes BOTH `collector` + `aggregate` (required — a
  provider with no fold to distribute is meaningless). PageHeaderShell reads the
  aggregate and passes `preliminary` + localized labels to the presentational
  `PageHeader`.

**kpi-strip publish gotcha (important):** a kpi-strip's true preliminary is a FOLD
over its per-item flags (`kpi.preliminary = spec.preliminary || provenance 'p'`,
core `kpi.ts`), which `resolvePreliminary(strip-def, ctx)` CANNOT see (a strip has
no single `measure` / `ctx.rows`). So `usePanelTitleBadge` gained a 4th optional
arg `preliminaryOverride` — the strip passes `anyPreliminary || undefined` so the
page summary keeps KPI provenance. Any future "folding" panel uses the same seam.

**What stays local (locality detail retained):** per-cell OBS_STATUS 'p' flags +
the table footer legend. Page indicator = summary; per-cell = detail.

**i18n:** the preliminary labels live in each slice's `meta.ts` `i18n` block (NOT
provisioning JSON). Moved from `section`/`kpi-strip` namespaces to `page-header`
(`preliminary`, `preliminary-short` = "წინასწ."/"Prelim.", `data-integrity`).

**Removed:** `PreliminaryBadge` (`.badge.badge--preliminary` — was UNSTYLED, no CSS
ever existed; rendered as raw text on scope-less panels like the KPI strip) + its
`PANEL_TITLE_BADGE` contribution in `apps/geostat/.../setupExtensions.ts` + dead
`feedback` i18n keys. The `PANEL_TITLE_BADGE` point itself stays open (no
contributor now) — chart/table/gauge still call `usePanelTitleBadge` for the
PUBLISH side (their title-badge return is currently inert).

**Fitness:** `FF-ONE-INTEGRITY-INDICATOR` evolved from section→page scope
(`packages/plugins/nodes/page-header/default/data-integrity.fitness.test.tsx` —
real PageHeader + real engine publish/subscribe seam; the section-folder test was
deleted). `FF-INTEGRITY-REACHABLE` asserts not-color-only (dot + label + caption).
Verified green via [[project_windows_longpath_vitest_worktree_block]] junction technique.

**Section responsive fix (shipped same commit):** `.section__title-wrap` given a
`--section-title-min: 16rem` floor (`flex: 1 1 var; min-width: min(100%, var)`) so
a LONG title makes `.section__actions` wrap to line 2 (via the existing
`.section__head` flex-wrap) instead of cramping the title.
