---
name: container-visible-gate
description: useContainerVisible (packages/react/engine/hooks) gates any DOM-measuring renderer on real layout; ApexRenderer is the first consumer
metadata:
  type: project
---

`useContainerVisible<T extends HTMLElement>()` — app-agnostic primitive at
`platform/packages/react/src/engine/hooks/useContainerVisible.ts`, exported from
`@statdash/react/engine`. Returns `{ ref, visible }`; `visible` is true only when
the attached element has `clientWidth > 0 && offsetParent !== null` — i.e. it is
NOT sitting behind a `display:none` ancestor (the `[data-view="hidden"]`
chart/table toggle case, `packages/styles/src/css/node-styles.css`). Implemented
via `useLayoutEffect` + `ResizeObserver` so it flips false→true the moment the
container becomes laid out again, with zero remount.

**Why it exists:** `ApexRenderer` (`packages/plugins/panels/chart/default/components/ApexRenderer.tsx`)
remounts `ReactApexChart` on every series change via `key={chartKey}` — including
while the chart view is hidden behind an inactive toggle slot. ApexCharts
measures its host box at mount to size its SVG; a 0×0/detached box produces NaN
width/height/transform (console SVG errors, broken chart on toggle-back).
`ApexRenderer` now wraps `ReactApexChart` in a host div (`ref={hostRef}`,
`width:100%,height:100%`) and renders it only when `visible` — the host div
itself always renders (keeps its footprint), so the visibility measurement is
never circular.

**How to apply:** ANY future renderer that measures its own DOM box at mount
time (a map, canvas, or other library sizing itself off its container) should
gate on `useContainerVisible` instead of re-deriving the clientWidth/offsetParent
check inline — this is the generic seam, not chart-specific. See
[[project_charts_neutral_color_seam]] for the sibling chart-interpreter seam and
[[project_shell_ui_hooks_shared]] for the broader shell-hooks pattern this
follows (hooks live in `packages/react/engine/hooks`, never per-panel).

Landed together with the low-cardinality bar-sizing work on
`feat/chart-lowcardinality-render` (same root domain: a chart must only ever
measure a real, laid-out container).
