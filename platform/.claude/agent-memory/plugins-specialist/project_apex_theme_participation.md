---
name: apex-theme-participation
description: How ApexCharts + custom-SVG chart chrome flips with [data-theme] — token reads + runtime re-render seam (F5)
metadata:
  type: project
---

Chart runtime now participates in the theme (AUDIT F5, commit on feat/tenant-agnostic-platform).

**Why:** ApexCharts draws axis/grid/label/legend/tooltip chrome to SVG in JS — a layer CSS `var()` cannot reach — so chrome stayed dim/dark on the dark surface even after the token layer was complete (`e74414d`). "Themable" needs BOTH: read colours from tokens AND re-render when the theme flips at runtime (a baked SVG can't re-drive via CSS alone).

**How to apply:**
- Chart chrome colours are resolved via `cssVar(--token, fallback)` (in `@statdash/styles`), which reads `getComputedStyle(documentElement)` LIVE at build time. So any colour is theme-correct on the render it happens on. `apex/base.ts` `BASE.chart.foreColor` (getter → `--color-text-secondary`) is Apex's single fallback ink; leaving it unset reverts to Apex's built-in `#373d3f` (dim on dark). `BASE.tooltip` is a getter → `{theme: isDarkTheme()?'dark':'light'}`.
- `isDarkTheme()` (in `apex/base.ts`) = luminance of the RESOLVED `--color-surface` token (< 0.5 → dark). Agnostic — no theme-name/tenant-hue literal; falls back to `matchMedia(prefers-color-scheme)` when the token isn't parseable (SSR/jsdom). Reuse this, don't re-detect theme by reading the `data-theme` attribute value.
- Runtime re-render seam: `utils/useThemeVersion.ts` — a module-singleton `MutationObserver` on `[data-theme]` + `matchMedia` change, surfaced via `useSyncExternalStore`. `Chart.tsx` folds it into a `key` on the `.chart-wrap__render` wrapper, remounting EVERY renderer (Apex builders + custom-SVG donut/treemap/hbar) so all `cssVar` reads re-run. If you add a new chart renderer that bakes token colours to SVG/JS, it is already covered by this key — no per-renderer wiring needed.
- Both-modes fitness lives at `apex/theme-chrome.fitness.test.ts`: set light vs dark token values on `documentElement.style` (jsdom resolves inline-set custom props through `getComputedStyle`), assert the built chrome field differs. This is the guard against a hardcoded hex creeping back.
- Label-collision (F10/F13): `contribution` x-axis = `hideOverlappingLabels+trim`+responsive `rotate` at BP_SM/XS; `cartesian` horizontal end-labels need generous RIGHT grid-pad (outside-bar dataLabels shear at the plot edge otherwise). See [[apex_responsive_yaxis_formatter_drop]] for the responsive-yaxis formatter-drop gotcha in the same files.
