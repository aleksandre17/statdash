---
name: container-visible-gate
description: useContainerVisible (packages/react/engine/hooks) gates any DOM-measuring renderer on real layout; ApexRenderer (charts) + GeoMap (leaflet) are consumers
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

**2nd consumer — GeoMap (fix/map-visibility-gate).** `GeoMap.tsx`
(`packages/plugins/nodes/geograph/default/components`) now gates its
`<GeoJSON>` mount on `mapVisible` — the layer is mounted ONLY while laid out, so
a selection/scale mutation while the map is `display:none` (table view active)
can't project a Leaflet vector layer against a 0×0 box and corrupt every path to
`d="M0 0"` (the permanent-blank defect two prior deploys cycled). Proven in a
REAL browser (Playwright + Chromium + real react-leaflet 5 / leaflet 1.9.4 /
georgia-regions.geojson): gated map mounts 0 paths while hidden, projects all 13
regions to real geometry on show, colours preserved (occupied `#dc2626`,
selected `#e8a33d`). KEY LESSON on the corruption itself: real Leaflet RETAINS a
valid zoom/center/pixel-origin through `display:none`, so an isolated
remount-while-hidden does NOT reliably corrupt in a harness — the live
corruption is state/timing-dependent (map-init or invalidateSize against a
genuinely 0×0 view). The gate is airtight precisely because it removes the
whole class: no mount while hidden ⇒ nothing to corrupt ⇒ recovery never needed.
jsdom CANNOT prove this (it mocks `<GeoJSON>`→null, no projection) — a real
browser was required.

**3rd fix — map stale-ORIGIN, gate was insufficient (fix/map-reproject-on-show).**
Live prod (b9503aa) proved the gate alone still went BLANK: the gate stops a hidden
LAYER from being corrupted, but it cannot fix the underlying **Leaflet MAP INSTANCE's
pixel origin** when the `MapContainer` was initialized/sized against a 0×0 box. A
freshly-remounted `<GeoJSON>` on show-back still projects against that stale origin →
`d="M0 0"`. KEY LESSON: `map.invalidateSize()` corrects container SIZE but does NOT
re-project already-added layers — you need a FULL view reset. Fix in `RepairOnShow`:
on the hidden→shown edge, `invalidateSize()` synchronously, then ONE `requestAnimationFrame`
later `map.fitBounds(L.geoJSON(data).getBounds(), {animate:false})` — DATA bounds are
always finite (never the map's current/NaN bounds). PLUS a `layerReady` state in GeoMap
that defers the `<GeoJSON>` mount one rAF after `mapVisible` flips true, so the layer
only ever projects against the already-corrected origin (removes the effect-ordering
race where the layer mounts+projects before invalidateSize runs). eslint
`react-hooks/set-state-in-effect` forbids synchronous `setState` in an effect body — reset
the defer flag in the effect CLEANUP, not the body. Still jsdom-unprovable; needs live check.
