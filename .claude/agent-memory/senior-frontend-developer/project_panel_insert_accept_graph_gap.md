---
name: panel-insert-accept-graph-gap
description: AR-49 M4.1 auto-wrap surfaced a real accept-contract gap — many content blocks have no page-level home and hit the guided hint
metadata:
  type: project
---

The M4.1 auto-wrap insert (resolveInsertPlan / planInserts in
`apps/panel/src/canvas/insertNode.ts`) resolves a page-level insert to
`page → section → type` when the frame can't hold the type directly. The canonical
wrapper is `section`. This exposed a structural gap in the node accept-graph.

**The accept-graph (as of 2026-07-10, verify before relying):**
- `inner-page` accepts `[section, repeat, page-header]`
  (main slot) + `[filter-bar, perspective-bar]` (sticky). NOTE (AR-49 foundation
  fix, later on 2026-07-10): the page-root type is NO LONGER hardcoded — `PAGE_ROOT_TYPE`
  was removed from `insertNode.ts` and `resolveInsertPlan` now derives the page-root
  accepts from `page.type` (per-page). `canvasPageAdapter` stamps/reads `page.type`
  (all three registered page roots — inner-page/tab-page/container-page — have
  canHaveChildren+slots, so per-page accepts is safe). See [[project_panel_per_page_type]].
- `section` accepts `[chart, table, kpi-strip, columns, grid, wrap, geograph]`.
- `grid/columns/card/wrap/stack` = open containers (no `accepts` ⇒ accept ANY).
- `geograph` accepts `[table]`; `repeat` accepts `[]` (⇒ any).

**The gap:** content blocks `hero, text, links, card, divider, spacer, stack,
stats-carousel, featured-slider` are accepted by NEITHER the frame NOR a `section`.
So a page-level insert of any of them resolves to `blocked` → a localized guided
hint ("add a Section, then a Grid/Columns, place it inside"), never a placement.
They ARE placeable manually (open containers accept any), just not via one-step
page-level auto-wrap. This is per-design (M4.1 chose hint-over-ambiguous-2-level-wrap),
but the large blocked set is a smell.

**Why:** section's `accepts` is data-panel-centric; the taxonomy has no generic
page-level CONTENT container, so structural/content blocks have no single-wrap home.

**How to apply:** if a future task wants page-level placement of content blocks
without friction, the root fix is one of — widen `section`'s `accepts` to include
content blocks, OR introduce a generic content container the frame accepts, OR let
auto-wrap build a 2-level structure with a chosen default (page→section→grid→block).
Do NOT special-case types in insertNode — keep the plan registry-derived
(`nestAccepts`); change the META `accepts`/add a container slice instead (OCP).
Related: FF-INSERT-NEVER-CLIFF (`insertNeverCliff.fitness.test.ts`) already treats
`blocked` as a legal terminal state, so widening accepts won't break the guard.
See [[project_section_authoring_uniformity]] for the section-composition model.
