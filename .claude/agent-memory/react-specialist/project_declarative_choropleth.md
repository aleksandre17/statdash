---
name: declarative-choropleth
description: geograph map is a declarative d3-geo SVG choropleth (Leaflet fully retired) — DOM-free projection kills the hidden-container blank-map bug class
metadata:
  type: project
---

The geograph node's map renderer is a DECLARATIVE d3-geo SVG choropleth, NOT Leaflet (branch `feat/declarative-choropleth`, un-merged in worktree). Region `<path>` geometry is projected from the geojson DATA via `geoMercator().fitSize` into a data-derived viewBox in `nodes/geograph/default/components/projection.ts` (`projectChoropleth`, pure/DOM-free). GeoMap.tsx renders the SVG; ./choropleth.ts stays the value→fill SSOT (now renderer-neutral `ChoroplethStyle`, no Leaflet `PathOptions`).

**Why:** Leaflet computes pixel geometry by MEASURING its DOM container. The map lives in a chart↔table toggle (`display:none` when table active); a selection change while hidden re-projected against a 0×0 box → every path degenerated to `d="M0 0"` → blank. FIVE imperative patches (invalidateSize / fitBounds / visibility-gate / setStyle / one-frame-defer) all failed on real prod. Data-derived projection has no pixel origin to go stale → the bug class is structurally impossible.

**How to apply:** For any future map/geo work, keep geometry data-derived (never measure the container). Deleted machinery that must NOT return: RepairOnShow, FitBounds, useContainerVisible-on-map, `choroplethLayerKey` (layer-remount key), leaflet/react-leaflet deps. Guards: `__tests__/one-map-engine.fitness.test.ts` (now forbids react-leaflet, asserts one `<svg>` renderer) + `components/projection.fitness.test.ts` (real geometry + determinism). Node config contract (occupiedIso/geoCodeMap/on[]/paramKey) is UNCHANGED — only rendering swapped. Strokes use `vector-effect="non-scaling-stroke"` so selection weights read at any SVG scale. Vitest is env-blocked in the deep worktree path — verified via `platform/work/verify-declarative-choropleth.mjs` (node replica against the real 13-region geojson). See [[worktree-vitest-maxpath-block]], [[container-visible-gate]] (that gate stays for ApexRenderer; only the map stopped using it).
