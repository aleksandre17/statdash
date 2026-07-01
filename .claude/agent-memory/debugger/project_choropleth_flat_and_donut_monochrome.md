---
name: choropleth-flat-and-donut-monochrome
description: Geograph map rendered flat single color (no value→color scale ever existed) + donuts monochrome grey (thresholdColor??muted fallback, treemap already solved it) — both color-correctness defects that "renders + 0 errors" hid
metadata:
  type: project
---

Server-verify with real data (not metric-green) exposed two color-correctness defects on the Regional Accounts + GDP demo pages.

**ROOT-1 — regional GDP choropleth painted flat single color.** `packages/plugins/nodes/geograph/default/components/GeoMap.tsx` `baseStyle()` returned the same `fillColor()` (`--color-accent`) for EVERY region; `fillOpacity` varied only by selection, never by value. **No value→color scale was ever implemented in the geograph node.** The `buildColorScale` util (quantile/linear/threshold) exists ONLY in the *separate, legacy* `packages/plugins/panels/map` stub (the one CLOSE-BOARD flagged as "paints nothing") — it was never imported by the real geograph. Distinct components; don't conflate them.

**ROOT-2 — donuts monochrome grey** while sibling bar/treemap were full color. `packages/plugins/panels/chart/default/components/donutGeometry.ts` `build()`: `color = pt.thresholdColor ?? cssVar('--color-text-muted')`. The pie interpreter (`packages/charts/src/interpreters/radial.ts`) builds plain data points with no `thresholdColor`, so every slice fell to the muted grey. `TreemapChart.tsx` (lines ~154-171) had ALREADY solved the identical "no per-tile color → distribute `chartPalette()`" case — the donut simply never got that treatment. Genuine palette-not-applied defect, not a deliberate monochrome choice.

**Fix (canonical, agnostic):** new token-derived `sequentialRamp()` + `quantileColors()` in `packages/styles/src/utils/choropleth.ts` (sibling to `palette.ts`; ramp derived from `--color-accent`+`--color-surface` so it rebrands under `[data-tenant]`; quantile-by-rank so a Tbilisi-dominant skew still spans the full ramp instead of collapsing near the light end like a linear scale would). GeoMap builds `colorByGeo` from `rows` and shades per region; selection moved to opacity+stroke-weight so value/color and selection encodings stay orthogonal. Donut copied the treemap's `distribute = distinct.size <= 1` guard.

**Why:** owner's top concern is exactly this cross-panel inconsistency (არეთგვაროვნება) — one panel colorful, its neighbor grey. Value-correctness defects like these render cleanly with 0 console errors, so they slip past build/typecheck/unit green; only a real-browser render with real data surfaces them.

**How to apply:** for any value-shaded encoding (choropleth/heat) use `sequentialRamp`+`quantileColors` from `@statdash/styles`, never a hardcoded palette. For any categorical SVG chart (donut/treemap/custom), when the series carries no per-datum color, distribute `chartPalette()` — mirror the treemap. Fitness guards: `choropleth.fitness.test.ts` + `donutPalette.fitness.test.ts`. The `panels/map` `buildColorScale` is legacy and token-blind — prefer the styles util; migrate that stub to it if it ever ships. See [[project_dynamics_geomap_sector_parity]] (prior geomap/sector-donut work) and [[project_cagr_span_and_treemap_render]] (treemap color `??`-vs-`||` fix).
