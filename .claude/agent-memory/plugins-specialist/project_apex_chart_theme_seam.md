---
name: apex-chart-theme-seam
description: apex/base.ts is the shared seam for BOTH theme-color participation (token reads + runtime re-render on [data-theme]) and the responsive-yaxis formatter-drop gotcha — same file, two coupled facts
metadata:
  type: project
---

Two coupled facts about `packages/plugins/panels/chart/default/utils/apex/base.ts`
and the ApexCharts chrome it builds.

**1. Theme participation (AUDIT F5).** ApexCharts draws axis/grid/label/legend/tooltip
chrome to SVG imperatively in JS — a layer CSS `var()` cannot reach — so chrome stayed
dim/dark on the dark surface even after the token layer was complete. "Themable" needs
BOTH: read colours from tokens AND re-render when the theme flips at runtime (a baked
SVG can't re-drive via CSS alone).
- Chart chrome colours resolve via `cssVar(--token, fallback)` (`@statdash/styles`),
  which reads `getComputedStyle(documentElement)` LIVE at build time — theme-correct on
  the render it happens on. `BASE.chart.foreColor` (getter → `--color-text-secondary`)
  is Apex's single fallback ink; unset reverts to Apex's built-in `#373d3f` (dim on
  dark). `BASE.tooltip` is a getter → `{theme: isDarkTheme()?'dark':'light'}`.
- `isDarkTheme()` = luminance of the RESOLVED `--color-surface` token (< 0.5 → dark).
  Agnostic — no theme-name/tenant-hue literal; falls back to
  `matchMedia(prefers-color-scheme)` when the token isn't parseable (SSR/jsdom). Reuse
  this — don't re-detect theme by reading the `data-theme` attribute value.
- Runtime re-render seam: `utils/useThemeVersion.ts` — a module-singleton
  `MutationObserver` on `[data-theme]` + `matchMedia` change, surfaced via
  `useSyncExternalStore`. `Chart.tsx` folds it into a `key` on the
  `.chart-wrap__render` wrapper, remounting EVERY renderer (Apex builders +
  custom-SVG donut/treemap/hbar) so all `cssVar` reads re-run. A new chart renderer
  that bakes token colours to SVG/JS is already covered by this key — no per-renderer
  wiring needed.
- Guard: `apex/theme-chrome.fitness.test.ts` — set light vs dark token values on
  `documentElement.style` (jsdom resolves inline-set custom props through
  `getComputedStyle`), assert the built chrome field differs. Guards against a
  hardcoded hex creeping back.
- Label-collision (F10/F13): `contribution` x-axis = `hideOverlappingLabels+trim` +
  responsive `rotate` at BP_SM/XS; `cartesian` horizontal end-labels need generous
  RIGHT grid-pad (outside-bar dataLabels shear at the plot edge otherwise).

**2. Responsive-yaxis formatter drop (AUDIT-responsive F6/R5).** ApexCharts (3.54.1)
responsive merge runs each breakpoint's `yaxis` through `Config.extendYAxis`, which
**rebuilds the axis from `new Options().yAxis` defaults** — dropping any
`labels.formatter` the override doesn't re-supply. So a bare responsive
`yaxis: { labels: { style: { fontSize } } }` reverts the numeric value axis to
ApexCharts' built-in float printer, surfacing raw floats like
`120000.000000000000` at narrow widths. (`xaxis` is NOT affected — plain
`Utils.extend`, only `yaxis` hits `extendYAxis`.)
- **How to apply:** ANY chart builder with a numeric y-axis (cartesian, contribution,
  future builders) must re-carry the formatter into every responsive `yaxis`
  override via the shared helper `responsiveYAxis(fontSize, formatter)`. Hoist the
  `yFormatter(...)` call into a `yFmt` const so base + responsive share one instance.
  Guard: `axis-formatter.test.ts` asserts responsive formatter output === base output
  (no raw-float tail) for cartesian + contribution.
- **Note (unrelated latent bug, do not fix here):** core `fmtNum(n, 0)` strips an
  integer's trailing zeros (`/\.?0+$/` quirk → `fmtNum(120,0)='12'`), so the gdp
  thousands-branch `fmtNum(val/1000,0)+' 000'` yields `12 000` for 120000. Out of
  plugins/charts scope — a foundational time-mode workstream owns core next.

See also [[project_chart_fill_leaf_band]] (height/fill, same file family) and
[[project_chart_render_boundary]] (locale/template resolution, different seam).
