---
name: chart-table-rendering
description: "Chart/table rendering seams — declarative sequential palette, low-cardinality colour-by-series + bounded bar fill, the DataTable band flex-chain fix, and the .scroll-fancy scrollbar SSOT. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 4 sibling files (chart-sequential-palette,
> chart-low-cardinality-render-rule, datatable-band-fill-chain, scrollbar-utility-and-table-overflow).

## Declarative per-chart palette (categorical | sequential)
`ChartDef.palette?: 'categorical'|'sequential'` selects hues declaratively (Law 2/8) — a
single-hue blue ramp for donuts/parts-of-a-whole vs the noisy rainbow default.

**Colour paths (resolve in MULTIPLE places, non-obvious):**
- Token SSOT: `--chart-seq-1..7` in light + BOTH dark blocks (`tokens.parity.test.ts` fails if the
  two dark blocks diverge — always edit both).
- Resolver: `packages/styles/src/utils/palette.ts` `chartSequential()`/`chartSequentialSample(n)`.
- Type: `charts/src/types.ts ChartDef.palette` + `ChartOutput.palette`; interpreters
  (`cartesian.ts`, `radial.ts`) copy def→output — **each interpreter must independently spread
  `palette`/`distributed`/`seriesColorByIndex`, they are NOT inherited.** A chartType that renders
  unexpectedly grey is missing this spread (found once in `special.ts` ComboInterpreter).
- Donut is a CUSTOM SVG component (`DonutChart.tsx`+`donutGeometry.ts`), not apex — `build()` picks
  `chartSequentialSample` when `output.palette==='sequential'`. `pie` type uses apex `pie.ts`.
- Cartesian bars: `apex/cartesian/colors.ts buildColors` — plain single-series sequential → ramp
  ANCHOR (`SEQ_ANCHOR=4`, `#0080be`) as an honest uniform blue (not `DEFAULT_SERIES_COLOR` grey).
- Authorable: must ALSO be in `ChartNode.ts ChartSchema` (compile-time `_ChartCovers` assert +
  `authorableContract.fitness`) — re-run `pnpm gen:schema` after.
- **Emit path (SSR/export SVG) mirrors live independently:** `charts/src/emit/palette.ts` has its
  own `EMIT_SEQUENTIAL`/`sequentialSample()`; `resolveSeriesColors`/`markColor` mirror the live
  branches. Covered by `emit/palette.sequential.fitness.test.ts`.

## Low-cardinality render rule (few series / few bars)
ONE uniform rule (Law 1/4), no per-panel special-case:
- **Colour-by-series:** `BarInterpreter` sets `ChartOutput.seriesColorByIndex` only when >1 series
  AND none carries a semantic colour; the render layer resolves `chartColorAt(i)` theme-aware
  (mirrors the `distributed` seam). Explicit row colours still win.
- **Bounded bar fill:** `autoBarFillPct(categoryCount)` (`apex/base.ts`) bounds
  `BAR_FILL_MAX_PCT=64` (few→wide) → `BAR_FILL_MIN_PCT=34` (many→floor), taper 4/category —
  category-count driven, orientation-neutral (replaced an inverted `barCount*7`).
- **Horizontal content-height:** `Chart.tsx` sets inline `{height:'auto',flex:'0 0 auto'}` on
  `.chart-wrap` when `output.horizontal`, so an authored aspectRatio band doesn't force a tall box
  a 2-row hbar can't fill. Vertical charts keep filling their band (`chart-fill.test.ts` locks
  vbar=100%/hbar=px). Inline is deliberate — beats the band + equal-height-stretch rules without a
  CSS specificity fight; see [[project_panel_sizing_cqi_model]].
- **Known follow-up:** ComboInterpreter does not set the colour-by-series flag (differentiates by
  bar/line shape) — extend if combo greys appear.

## DataTable band fill-chain (why a banded table failed to scroll)
A banded table (AR-8 height band around a chart↔table toggle) can render at full content height,
overflow the band, and get clipped with no scrollbar.

**Root cause (the chart-vs-table asymmetry to remember):** `TableShell.tsx` renders an
intermediate `<div {...bodyAttrs}>` (badges + `<DataTable>` + export bar) BETWEEN the band box and
`.data-table__wrap`; that div is `display:block`, so the wrap's `flex:1` is inert and it grows to
full table height. The CHART shell doesn't have this problem — `Chart.tsx` spreads
`{...bodyAttrs}` DIRECTLY onto `.chart-wrap`, so its content box IS the band's direct child.
(Table-specific — NOT the ApexCharts NaN-dimension hidden-view bug, a different mechanism.)

**Fix (`data-table.css`, table-owned):** make the wrap's direct parent a fill-flex link via
`:has(> .data-table__wrap)` under the band's own `[data-view]/[data-height]/[data-aspect]`
attributes (reads, never redefines the band — same `:has()` idiom node-styles uses for the chart
leaf): `display:flex;flex-direction:column;flex:1;min-height:0`. Unbanded tables match none of the
selectors and keep the `max-height:var(--data-table-max-h,70vh)` viewport (below). Bonus: un-clips
the per-section export bar. Guard: `data-table.layout.fitness.test.ts` (FF-TABLE-BAND-FILL-CHAIN,
CSS-source assertions — jsdom has no layout).

## Scrollbar SSOT + the min-width:auto table-clip trap
**SSOT:** `packages/styles/src/css/scrollbar.css` — `--scrollbar-*` vars (colour DERIVED from
`--color-border-strong/-interactive/-frame`, no hex, not in tokens.css), the page-root `html`
scrollbar, and the reusable `.scroll-fancy` class (WebKit `::-webkit-scrollbar*` rounded pill +
Firefox `scrollbar-width:thin`). Add `scroll-fancy` to any NEW bounded `overflow:auto` region.
Already on `.data-table__wrap`, panel `.canvas-root`, `.cmdk-list`.

**Table-clip root cause:** `.data-table__wrap` is a flex item inside the AR-8 band's
`[data-view=visible]{flex-direction:column}` chain; default `min-width:auto` refuses to shrink
below the table's min-content width, so a wide table pushes past the card with NO scrollbar. Fix:
`overflow:auto;min-width:0;max-width:100%` in the plugin's own `data-table.css` —
`min-width:0` is the load-bearing bit.
