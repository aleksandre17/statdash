# Board 02 — §E Charts + §F Geo-map (RX-12..17)

> Part of [Board 02 index](02-react.md). Analysis only.

## §E — Charts (ApexCharts adapter, neutral-color seam, deferred kinds)

### [RX-12] Chart interpreter registry (neutral ChartOutput)
- **Status**: ✅DONE
- **Evidence**: `platform/packages/charts/src/registry.ts:23-45`; `interpret.ts:19-44`; `interpreters.ts:20-32` (13 registered)
- **What & why**: `ChartDef + DataRow[] → ChartOutput` (renderer-agnostic neutral format) via a strategy registry. 13 interpreters: bar, hbar, hbar-diverging, line, area, pie, donut, waterfall, contribution, combo, treemap + `map`/`sankey` placeholders. Split into `@statdash/charts` to break the engine→charts→engine cycle.
- **Critical analysis**: Clean Grammar-of-Graphics separation (interpret → neutral → adapter). The neutral format makes the ApexCharts dep swappable. But `ChartType = string` (`core/src/core/context.ts:24`) is **fully unconstrained** — a typo'd type falls through to `placeholderOutput` silently (interpret.ts:26). Constructor has no compile-time chart-kind list; must call `chartRegistry.chartTypes()` at runtime — weak authoring DX.
- **Reference platforms**: Vega-Lite (mark→view), Observable Plot (mark registry), ECharts series registry. **Where WE beat them**: the neutral `ChartOutput` decouples interpretation from renderer — Vega-Lite is bound to Vega; we could swap Apex→ECharts→D3 per-tenant by registering a different `chartRendererRegistry` adapter. Real architectural edge.
- **Foresight (multi-tenant)**: A tenant wanting D3 registers a different renderer adapter against the same neutral output — already possible. Missing: a typed `ChartKind` union for authoring.
- **Plan**: Keep `ChartType=string` for runtime extensibility but emit a generated `KnownChartKind` union (from registry) for Constructor/TS. File: `charts/src/types.ts`, codegen. Effort **S**, risk **two-way**, Class **G**, priority **P3**.
- **Raises-the-bar**: Renderer-swappable charts via a neutral interpreter seam.

### [RX-13] Neutral-color seam (literal hex defaults, themed cssVar layered on)
- **Status**: ✅DONE
- **Evidence**: `charts/src/colors.ts:13-19`; cssVar layering verified in `plugins/panels/chart/default/utils/apex/{base,cartesian,pie,…}.ts`; [[project_charts_neutral_color_seam]]
- **What & why**: Interpreters emit **literal hex** defaults (`#6B7B8D` etc.) because ChartOutput is JSON parsed in SVG/JS-color-math contexts where `var()` is invalid. The Apex adapter (`@statdash/plugins`) layers the themed `cssVar` fallback ON TOP at render time. Wire-safe seeds named once (DRY/SSOT).
- **Critical analysis**: Correct — `var()` genuinely can't live in the neutral wire format. cssVar IS applied in apex utils (verified, not just claimed). Subtlety: the hex defaults (`#6B7B8D` grey, `#0080BE` accent, `#E53E3E` "action red" for rollup-total) are **app-flavored choices baked into the agnostic charts package**. Defaults are defensible (rule allows defaults-only), but the semantic red/accent should arguably be adapter-supplied tokens, not charts-layer constants. Borderline first-tenant erosion ([[feedback_first_tenant_erosion]]); low risk since overridable.
- **Reference platforms**: Vega-Lite scheme defaults, ECharts palette, Grafana viz color modes. **Where WE beat them**: themed-token layering re-colors the SAME chart across light/dark/tenant themes with zero re-interpretation — Apex/ECharts bake colors at config time.
- **Foresight (multi-tenant)**: Tenant palettes flow through cssVar automatically. Keep charts-layer hex truly neutral (grey only); move semantic reds/accents to the adapter token map.
- **Plan**: Move `DEFAULT_TOTAL_COLOR`/`DEFAULT_ACCENT_COLOR` semantic choices to the adapter's token resolution; keep only true-neutral grey in `charts/colors.ts`. Files: `charts/src/colors.ts`, apex `base.ts`. Fitness: extend `no-tenant-content.fitness.test.ts`. Effort **S**, risk **two-way**, Class **G**, priority **P2**.
- **Raises-the-bar**: Theme-reactive chart colors via a JSON-safe neutral seam + adapter cssVar layering.

### [RX-14] Deferred chart kinds — map & sankey are placeholders
- **Status**: 🟡PARTIAL
- **Evidence**: `charts/src/interpreters.ts:31-32` (`PlaceholderInterpreter('map'|'sankey')`); `charts/src/interpreters/placeholder.ts`; `plugins/panels/chart/default/chart-renderers.tsx:13-14`
- **What & why**: `map` and `sankey` register a placeholder interpreter emitting empty `ChartOutput`; shells render a `ChartPlaceholder`. Map is actually served by the dedicated `geograph` (Leaflet) + `map` panels instead.
- **Critical analysis**: `sankey` is the one genuinely-unbuilt chart kind (flow/Sankey is standard for national-accounts: sector flows, supply-use tables). `map`-as-chart is a dead placeholder given geograph exists — confusing duplication (RX-16). Beyond these, **no scatter, heatmap, radar, boxplot, histogram, candlestick** — all standard statistical viz. For "full benefit of standards" (Law 4), absent scatter (correlation) + heatmap (cross-tab intensity) is a real gap.
- **Reference platforms**: Plotly (40+ traces), ECharts (sankey/boxplot/heatmap/radar native), Observable Plot. **Where WE beat them**: nothing here — coverage deficit; Plotly/ECharts dominate on breadth.
- **Foresight (multi-tenant)**: Supply-use / input-output tables (core national-accounts) demand Sankey + heatmap; a stats tenant hits this within months.
- **Plan**: P1 = Sankey interpreter + adapter (d3-sankey → neutral `ChartOutput.flows`; new field). P2 = scatter + heatmap. Remove `map` from charts registry (delegate to geograph). Files: `charts/src/interpreters/special.ts`, new `scatter.ts`/`heatmap.ts`, `charts/src/types.ts`, apex/d3 adapters in plugins. Fitness: per-interpreter unit tests + a11y table fallback per kind. Effort **L**, risk **two-way**, Class **M**, priority **P1** (sankey) / **P2** (scatter/heatmap).
- **Raises-the-bar**: National-accounts-grade flow/intensity viz on the neutral seam.

### [RX-15] ApexCharts adapter + interaction events
- **Status**: ✅DONE
- **Evidence**: `plugins/panels/chart/default/components/ApexRenderer.tsx:1-49`; `chart-renderers.tsx`; `useChartInteractions.ts`
- **What & why**: `toApexOptions(neutralOutput)` → `<ReactApexChart>`. Hover/leave/click wired into `chart.events` without mutating base options. `chartKey` forces remount on data change. Custom renderers (DonutChart, TreemapChart, HBarDivergingChart) for kinds Apex does poorly.
- **Critical analysis**: Solid adapter, but **`react-apexcharts` is a static top-level import** (line 1) — ~500KB into the main bundle even if no chart renders (RX-26). The `chartKey` remount-on-data-change (line 13) is a **perf footgun**: any data change tears down and rebuilds the chart (losing animation continuity + zoom state) rather than letting Apex diff — Grafana/Plotly do in-place updates. Metric-green (charts render) hides the remount cost on frequent-filter dashboards.
- **Reference platforms**: Grafana viz (in-place updates), Plotly.react (diff-based), Recharts (React-reconciled). **Where WE beat them**: neutral-output indirection means we're not married to Apex. **Where they beat us**: in-place updates vs our full remount.
- **Foresight**: Frequent-filter dashboards feel the remount jank; need a keyed-but-diffed update path.
- **Plan**: (1) Lazy-load Apex (RX-26); (2) replace `chartKey` full-remount with Apex `updateSeries`/`updateOptions` (or key on series *shape*, not values). File: `ApexRenderer.tsx`. Fitness: render-count test asserting no remount on value-only change. Effort **M**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Renderer-agnostic charts with in-place updates.

## §F — Geo-map / Leaflet

### [RX-16] Two map implementations — geograph (Leaflet, real) vs panels/map (SVG placeholder)
- **Status**: 🟡PARTIAL (architecturally duplicated)
- **Evidence**: `plugins/nodes/geograph/default/components/GeoMap.tsx:15-16` (real react-leaflet); `plugins/panels/map/default/MapShell.tsx:71-86` (SVG choropleth = "Phase 2", renders table placeholder)
- **What & why**: `geograph` is a **real** agnostic Leaflet choropleth (GeoJSON, FitBounds, click-select, tooltip via `fmtNum`, cssVar colors). `panels/map` is a **stub** — `buildColorScale` runs but SVG projection is unimplemented; always renders an accessible table fallback (`MapPlaceholder`) even when topology is registered (71-85).
- **Critical analysis**: Real architectural smell — **two node types for one concept**, one real one stubbed. An author can't tell which to use. The `panels/map` topology-registry + colorScale code is dead weight if geograph is the answer. The accessible-table fallback (88-94) is genuinely good a11y (WCAG non-visual access), but a permanently-placeholdered panel is debt, not a feature. Maintaining both violates "best solution only" (Law 6).
- **Reference platforms**: Grafana Geomap (single panel, layers), Retool Map, Observable Plot geo. **Where WE beat them**: geograph is fully dimension-agnostic (`geoCodeMap` bridges ISO↔store dim) — Grafana Geomap assumes lat/lng. **Where they beat us**: one map concept, not two.
- **Foresight (multi-tenant)**: Tenants without a tile budget want self-hosted SVG (offline/print) — so BOTH have a rationale, but as **variants of one map node**, not two types.
- **Plan**: (1) Decide canonical map node; (2) make SVG vs Leaflet a `variant` (RX-09 spine), not two types; (3) finish OR formally defer the SVG projection with a tracked card. Files: `plugins/nodes/geograph`, `plugins/panels/map`. Fitness: "single-map-concept" test (one registered map type with variants). Effort **L**, risk **one-way** (touches configs), Class **M**, priority **P2**. **Escalate to architect** — public node-API consolidation.
- **Raises-the-bar**: One agnostic map node, Leaflet/SVG/print as variants on one data contract.

### [RX-17] geograph worker.js — off-main-thread geo processing
- **Status**: 🆕GAP (verify)
- **Evidence**: `plugins/nodes/geograph/default/components/worker.js`
- **What & why**: A worker file beside GeoMap — presumably off-thread GeoJSON parsing / topology simplification.
- **Critical analysis**: A raw `.js` worker in a TS/agnostic package is a typing + bundling concern (no `.d.ts`, worker-URL resolution is bundler-specific — Vite vs webpack differ). If it parses GeoJSON off-thread that's the right instinct (large topo files block the main thread), but a hand-rolled `.js` worker with no test is fragile. Could not confirm it is wired in or tested.
- **Reference platforms**: Mapbox GL workers, Deck.gl worker pools. **Where WE beat them**: n/a — verify it runs.
- **Foresight**: Municipality-level national topologies NEED off-thread parsing or first-paint jank.
- **Plan**: Verify wiring + add a worker smoke test + `?worker` Vite import typing. Files: `geograph/components/worker.js`, `GeoMap.tsx`. Effort **S**, risk **two-way**, Class **G**, priority **P3**.
- **Raises-the-bar**: Off-main-thread geo parsing for large topologies.
