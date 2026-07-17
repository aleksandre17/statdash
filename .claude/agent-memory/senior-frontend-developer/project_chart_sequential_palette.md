---
name: chart-sequential-palette
description: Declarative per-chart palette capability (categorical | sequential blue ramp) + where each chart color path lives
metadata:
  type: project
---

`ChartDef.palette?: 'categorical' | 'sequential'` selects a chart's categorical/by-index/donut hues declaratively (Law 2/8). Added for the portal review batch (reviewer wanted single-hue blues on donuts + GDP/regional dynamics bars, not per-chart hex).

**Why:** rainbow categorical palette read as noisy for parts-of-a-whole; owner wanted "დაახლოებით მსგავს ფერებში" (sequential blues).

**How to apply / the color paths (non-obvious — colors resolve in MULTIPLE places):**
- Token SSOT: `--chart-seq-1..7` (light + BOTH dark blocks — `[data-theme=dark]` AND `@media prefers-color-scheme:dark`; `tokens.parity.test.ts` FAILS if the two dark blocks diverge — always edit both).
- Resolver: `packages/styles/src/utils/palette.ts` → `chartSequential()` / `chartSequentialSample(n)` (samples N across the ramp so slices span light→dark). Exported from styles `index.ts`.
- Type: `packages/charts/src/types.ts` `ChartDef.palette` + `ChartOutput.palette` (+ `ChartPalette` type). Interpreters copy def→output in `interpreters/cartesian.ts` (bar/line/area) and `interpreters/radial.ts` (pie/donut) — each return spreads `...(def.palette ? {palette} : {})`.
- **GOTCHA (fixed 2026-07-17, card 0078):** `interpreters/special.ts` `ComboInterpreter` (chartType `combo`) originally did NOT spread palette/distributed/seriesColorByIndex — a single-series `palette:"sequential"` combo dropped its palette and rendered `DEFAULT_SERIES_COLOR` GREY (the „ხაზოვანი დინამიკა" gray-bars indictment). Now mirrors the bar contract. If a chartType renders unexpectedly grey, check ITS interpreter propagates these three flags — each interpreter must, they are not inherited.
- A single-series chart with NO `palette` and no explicit `s.color` → `DEFAULT_SERIES_COLOR` grey (both live `colors.ts` plain branch and emit). To make it blue: add `palette:"sequential"` to the ChartDef in provisioning (config-level, served by API — NOT in the bundle). This is why some portal charts stay grey until the api-image redeploys.
- **Donut is a CUSTOM SVG component**, NOT apex: `plugins/panels/chart/default/components/DonutChart.tsx` + `donutGeometry.ts` (`build()` picks `chartSequentialSample` when `output.palette==='sequential'`, overriding per-row thresholdColor). `pie` type → apex `pie.ts`; `donut` type → DonutChart (see `chart-renderers.tsx`).
- Cartesian bars: `plugins/.../utils/apex/cartesian/colors.ts` `buildColors` — sequential branch: distributed→sample by category, by-index→sample by series, **plain single series→ramp ANCHOR (SEQ_ANCHOR=4, #0080be)** as an honest uniform blue.
- Authorable: MUST also be in `ChartNode.ts` `ChartSchema` (compile-time `_ChartCovers` assert + `authorableContract.fitness.test.ts` EXPECTED map both fail otherwise) + ChartGroups. Re-run `pnpm gen:schema` after.

Live-render color SSOT ≠ emit color SSOT: BOTH now sequential-aware. Emit path `charts/src/emit/palette.ts` gained `EMIT_SEQUENTIAL` (charts-local --chart-seq twin) + `sequentialSample()`; `resolveSeriesColors`/`markColor` mirror the live `colors.ts` branches (by-index sampled, distributed per-category at mark site, plain→anchor #0080be). Covered by `emit/palette.sequential.fitness.test.ts`. SSR/export SVG now colour-parity with live for `palette:"sequential"`.
