---
name: rail-cell-panel-pattern
description: Inner-sidebar rail = fixed layout cell + absolute overlay panel; hover-expand must NEVER transition an in-flow width
metadata:
  type: project
---

The geostat inner sidebar (`packages/plugins/chrome/inner-sidebar/default/`) is
a CELL + PANEL split since 2026-07-16: `.inner-sidebar-cell` (sticky flex child,
fixed `--inner-sidebar-w`) owns the layout allocation; `aside.inner-sidebar` is
`position:absolute` over it and hover/focus-within-expands 78→260 as an overlay
(z-40 — above page-header 30 / filter-bar 29, below app header 50). The shell
wraps the aside in `<div className={SIDEBAR.cell}>`.

**Why:** the first hover-expand implementation (bb3ab69) transitioned the rail's
own in-flow width — layout resized, all content reflowed ("texts dance", owner
defect). Also `justify-content:center` on the ultrawide sidebar layout centred
the RAIL+content pair off the viewport edge; now only `.page-content` re-centres
(`margin-inline:auto` at ≥2xl in `pages/inner-page/default/page-layout.css`) and
the rail stays flush at x=0.

**How to apply:** any expanding chrome (rails, docks, drawers) — the flex/grid
child the page composes against keeps a CONSTANT size; expansion is always an
absolutely-positioned overlay. Mobile ≤1280 collapses both boxes to static flow.
