---
name: horizontal-height-and-map-hidden-remount
description: Chart.tsx output.horizontal inline height override is a shared root for tall-clip + short-cramp regressions; GeoMap collapses to M0 0 on hidden GeoJSON key-remount (pre-existing, Leaflet)
metadata:
  type: project
---

Two live-prod defect families found on b5ae777 (2026-07-03 diagnosis).

**Chart.tsx horizontal-height override is a SHARED root (B+C).**
`platform/packages/plugins/panels/chart/default/Chart.tsx` ~L44 sets, for `output.horizontal`, an inline `{ height:'auto', flex:'0 0 auto' }` on `.chart-wrap` — opting EVERY horizontal chart out of the panel band. This is binary and ignores content size:
- Tall many-category horizontal (custom, non-Apex renderer, e.g. /ka/accounts "National Accounts") → chart-wrap grows to full content (~1953px), breaks out of the `[data-height="16:9"]` band (section body fixed ~646px, `overflow:hidden`), band CLIPS the overflow, internal `overflow-y:auto` scroll area loses its bounded parent → scroll gone, ~1300px unreachable.
- Few-bar horizontal (Apex hbar, e.g. /ka/regional "regional comparison") → floored at `HBAR_MIN_HEIGHT=240` (base.ts `categoricalChartHeight`) → cramped.
Both NEW in b5ae777 (commit 5889938). **Why:** the override was written for the few-bar whitespace case only; it never modeled the tall case. **How to apply:** the horizontal height model must bound between a generous MIN (fix C) and the band as a MAX-with-scroll (fix B) — one coherent fix, not two patches. base.ts `categoricalChartHeight` only feeds Apex `height=`; a CUSTOM horizontal renderer is governed solely by Chart.tsx's inline style.

**GeoMap hidden-remount collapse (A) is PRE-EXISTING + independent (Leaflet, not the batch).**
`GeoMap.tsx` L218 keys `<GeoJSON key={choroplethLayerKey(selectedGeos, colorByGeo)}>`. A cross-filter row-select changes `selectedGeos` WHILE the map view is `display:none` (table active) → GeoJSON layer remounts and projects paths against a 0×0 Leaflet container → all region paths collapse to `d="M0 0"` (svg overlay bbox 0×0 = blank map). FitBounds (L99-108) only `invalidateSize()+fitBounds` on `[map, geoJson]`, neither changes on re-show, so projection never repairs. GeoMap.tsx is BYTE-IDENTICAL ba95362↔b5ae777 → NOT a batch regression; owner's association with the UI batch is misattribution. **How to apply:** fix = re-`invalidateSize()`+redraw when the map container becomes laid-out (reuse the app-agnostic `useContainerVisible` primitive — its docstring already names "a map" as a target), and/or stop keying the layer on selection (style-only change → `setStyle`, not remount). The batch's ApexRenderer `useContainerVisible` gate is functioning (toggle storm produced no stuck-hidden charts, no apex getComputedStyle error) — it is NOT the map's cause.
