// ── ApexCharts shared base — shared constants & helpers ───────────────
//
//  Consumed by every builder in this folder.
//  Nothing here imports from sibling builder files.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartSeries, ChartOutput } from '@statdash/charts'
import { fmtNum }                         from '@statdash/engine'
import { cssVar, prefersReducedMotion }  from '@statdash/styles'

// ── Shared base config ─────────────────────────────────────────────────
//
//  Applied to every chart type. Individual builders override as needed.
//
export function liftTooltip(chartCtx: { el: Element }) {
  const tip = chartCtx.el.querySelector<HTMLElement>('.apexcharts-tooltip')
  if (tip) tip.style.zIndex = '99999'
}

// ── Theme-aware chrome ─────────────────────────────────────────────────
//
//  ApexCharts draws axis/label/grid/legend/tooltip chrome straight to SVG in
//  JS — a layer CSS `var()` cannot reach. So chart chrome must READ the token
//  values (via cssVar, resolved from the live cascade) at build time, and the
//  chart must be re-built when the theme flips (see useThemeVersion). foreColor
//  is Apex's single fallback ink for anything a builder doesn't override; left
//  unset it stays Apex's built-in dark grey (#373d3f) → dim on a dark surface.
//

/**
 * Effective dark-mode probe — luminance of the RESOLVED surface token.
 *
 * Token-driven + agnostic: follows whatever `--color-surface` resolves to under
 * the active `[data-theme]` / OS cascade — no hardcoded theme name or tenant
 * hue. Used only to pick ApexCharts' built-in light|dark tooltip skin (its
 * background + ink live inside the library, unreachable by our CSS). Falls back
 * to the media query when the token isn't a parseable hex/rgb (SSR / jsdom).
 */
export function isDarkTheme(): boolean {
  const lum = luminanceOf(cssVar('--color-surface', '#ffffff'))
  if (lum !== null) return lum < 0.5
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  return false
}

/** Relative luminance (0–1) of a hex/rgb color string; null if unparseable. */
function luminanceOf(color: string): number | null {
  const rgb = parseRgb(color)
  if (!rgb) return null
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function parseRgb(color: string): [number, number, number] | null {
  const s   = color.trim()
  const hex = s.replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(hex))
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  if (/^[0-9a-fA-F]{3}$/.test(hex))
    return [parseInt(hex[0]! + hex[0]!, 16), parseInt(hex[1]! + hex[1]!, 16), parseInt(hex[2]! + hex[2]!, 16)]
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1]!.split(',').map((x) => parseFloat(x))
    if (p.length >= 3 && p.slice(0, 3).every((n) => !Number.isNaN(n))) return [p[0]!, p[1]!, p[2]!]
  }
  return null
}

export const BASE: ApexOptions = {
  chart: {
    // No drag gesture on a READ plot (owner, 2026-07-17: „მაუსზე გათიშე წლების
    // რეინჯი") — the range NAVIGATOR below long charts is the one windowing
    // affordance (Highcharts navigator convention). Killed at apex's GESTURE
    // gate (globals.zoomEnabled = autoSelected==='zoom' && tools.zoom &&
    // zoom.enabled — apexcharts.js:6903), NOT via zoom.enabled: the brush
    // pipeline needs the target's zoom CAPABILITY, only the mouse gesture goes.
    // The navigator overrides this toolbar wholesale, so apex's own brush()
    // defaults (autoSelected 'selection') keep its drag-window fully alive.
    toolbar:    { show: false, tools: { zoom: false, selection: false, pan: false } },
    // Apex ships its OWN internal ResizeObserver-driven "redraw on parent resize"
    // (default true), debounced via a bare setTimeout its destroy() never clears —
    // so a hide-then-unmount within that window fires a redraw into a torn-down
    // chart (the getComputedStyle-on-teardown pageerror; complements the synchronous
    // unmount gate in ApexRenderer). We drive our own resize (HBarDiverging owns its
    // React-state redraw), so disable Apex's internal one outright — one source of
    // truth. redrawOnWindowResize (genuine browser resize) is untouched. [AR: apex-2root]
    redrawOnParentResize: false,
    fontFamily: 'system-ui, sans-serif',
    // Apex's single fallback ink for every axis/tick/legend/label a builder
    // doesn't override. A getter re-reads the token at spread (render) time, so
    // it flips with [data-theme]; useThemeVersion forces the re-render that
    // refreshes an already-mounted chart on a runtime theme toggle.
    get foreColor() { return cssVar('--color-text-secondary', '#4A5568') },
    // Fill the container exactly — no extra offset band. With chart.height:'100%'
    // Apex sizes the SVG to the parent's clientHeight; parentHeightOffset (default 15)
    // would only be added at the px-height responsive breakpoints (mobile), so pinning
    // it to 0 keeps a vertical bar flush to its (now growable) card body at every width
    // and prevents a phantom offset from re-opening a fill gap. See FILL-vbar guard.
    parentHeightOffset: 0,
    // Reduced-motion: a getter, not a literal — read at spread time (render), so
    // the OS/user setting is honoured live. JS half of the motion baseline
    // (the CSS half neutralises declarative animation; Apex draws to SVG via JS,
    // which CSS @media cannot reach, so it must gate on prefersReducedMotion()).
    get animations() {
      const motion = !prefersReducedMotion()
      return { enabled: motion, easing: 'easeinout' as const, speed: 600,
        animateGradually: { enabled: motion, delay: 40 } }
    },
    events: {
      mounted: liftTooltip,
      updated: liftTooltip,
    },
  },
  grid: {
    get borderColor() { return cssVar('--color-chart-grid', '#F0F5F3') },
    strokeDashArray: 4,
    padding:         { left: 4, right: 4 },
  },
  // Apex's tooltip skin (its own bg + ink) lives inside the library, out of CSS
  // reach — so pick light|dark from the resolved surface token. A getter re-reads
  // at spread time (render), flipping with the theme like the rest of the chrome.
  get tooltip(): ApexTooltip { return { theme: isDarkTheme() ? 'dark' : 'light' } },
  states: {
    hover:  { filter: { type: 'lighten', value: 0.08 } },
    active: { filter: { type: 'darken',  value: 0.12 } },
  },
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Build a Y-axis label formatter that appends a unit string.
 *
 * `decimals` fixed → `fmtNum(val, decimals)` (a rate axis wants `10, 5, 0, -5`).
 * `decimals` undefined → `fmtNum(val, 0)` — the FULL, space-grouped number
 * ("80 000", "120 000"), NOT the `K`/`M` compact abbreviation. Reviewer directive
 * (portal notes item 10): axis ticks read as complete localized numbers with space
 * thousands-grouping, never "80K". Applied ONCE here, so every cartesian value axis
 * (yFmt / y2Fmt) inherits it. `fmtNum` does NOT divide (the old lossy `/1000+' 000'`
 * hack did) — it rounds the tick to whole units and groups, so Apex's already-nice
 * round ticks (0 · 20 000 · 40 000 …) stay monotonic and never collapse. `locale`
 * is retained in the signature (grouping char is locale-neutral U+00A0 here) so a
 * future locale-specific grouping is a one-line change, no call-site churn.
 */
export function yFormatter(unit?: string, decimals?: number, _locale?: string): (val: number) => string {
  return (val: number) => {
    if (val === undefined || val === null) return ''
    const n = fmtNum(val, typeof decimals === 'number' ? decimals : 0)
    return unit ? `${n} ${unit}` : n
  }
}

/**
 * Responsive y-axis font override that PRESERVES the value formatter.
 *
 * ApexCharts' responsive merge runs each breakpoint's `yaxis` through
 * Config.extendYAxis, which rebuilds the axis from library defaults
 * (`new Options().yAxis`) — silently dropping any `labels.formatter` the
 * override doesn't re-supply. A bare `{ labels: { style: { fontSize } } }`
 * override therefore reverts the numeric axis to ApexCharts' built-in float
 * printer, surfacing raw floats like "120000.000000000000" at narrow widths
 * (AUDIT F6 / R5). Re-carrying the formatter keeps the canonical fmtNum output
 * at every breakpoint. Use this for ANY responsive numeric-y-axis font tweak.
 */
export function responsiveYAxis(
    fontSize: string,
    formatter: (val: number) => string,
): ApexYAxis {
  return { labels: { formatter, style: { fontSize } } }
}

/**
 * Pre-formatted data labels closure.
 * ApexCharts dataLabels.formatter receives (value, opts).
 * We use opts.seriesIndex + opts.dataPointIndex to look up the
 * engine-formatted string — respects FieldConfig unit/decimals.
 */
export function makeDataLabelFormatter(
    formatted: string[][],
): (val: number, opts: { seriesIndex: number; dataPointIndex: number }) => string {
  return (_val, opts) =>
      formatted[opts.seriesIndex]?.[opts.dataPointIndex] ?? ''
}

/** Collect per-series formatted strings from ChartOutput. */
export function collectFormatted(series: readonly ChartSeries[]): string[][] {
  return series.map((s) => s.data.map((pt) => pt.formatted))
}

// SVG presentation attributes don't support CSS clamp() — compute from window.innerWidth.
// Called inside each builder at render time, so sizes update on every chart render.
export function scaledPx(vw: number, min: number, max: number): string {
  return `${Math.round(Math.min(max, Math.max(min, window.innerWidth * vw / 100)))}px`
}

// ── Responsive breakpoints for numeric (non-CSS) values ────────────────
//
//  ApexCharts numeric values (offsetY, borderRadius, marker.size, padding)
//  cannot use CSS clamp(). The `responsive` array applies overrides when
//  the chart's container width is at-or-below each breakpoint. ApexCharts
//  picks the most-specific match (smallest matching breakpoint wins) and
//  deep-merges the override onto the base options.
//
export const BP_MD = 1024 // small laptop / large tablet
export const BP_SM = 768  // tablet / large phone landscape
export const BP_XS = 480  // phone portrait

// ── Category-aware height (horizontal / categorical charts) ─────────────
//
//  A vertical chart's category axis runs along the (elastic) x-direction, so a
//  fixed container height works at any cardinality. A HORIZONTAL bar stacks one
//  row per category down the (fixed) height — so a many-category hbar squeezes
//  bars + axis labels together until they overlap, worst at narrow widths. The
//  fix is to make height a function of category count: reserve a minimum slot
//  per row so every label can breathe, bounded so few-category charts don't grow
//  gratuitously and huge ones stay within a scrollable cap. Generic for any
//  categorical hbar, any count — vertical charts keep filling their container.
//
const HBAR_PX_PER_CATEGORY = 34   // min vertical slot per row (bar + gap + label)
// Floor raised 240 → 380 (b5ae777 follow-up, defect C), then 380 → 560 (owner
// follow-up: still read as a cramped strip on the live "regional comparison"
// panel — a FULL-WIDTH solo hbar, per provisioning `templateColumns:"1fr"`, the
// only current non-diverging `hbar` instance). 240/380 were both sized off
// HBAR_PX_PER_CATEGORY (a per-row content estimate) — the wrong axis for a
// solo/few-bar FOCUS chart, whose honest size is "a deliberate visualisation
// filling a real section", not "N rows stacked". 560 is instead anchored on
// HBAR_MAX_HEIGHT (≈61%): a substantial majority of the many-category scroll
// cap, while preserving real headroom (560→920) so a genuinely tall many-row
// chart still reads as taller — floor and cap stay proportionally related, not
// two independent magic numbers. Many-category hbars are UNCHANGED: they still
// grow past the floor via HBAR_PX_PER_CATEGORY and cap/scroll at 920 (the
// b5ae777 fix B guard).
const HBAR_MIN_HEIGHT      = 560  // floor — a solo/few-bar hbar reads as a real focus chart
const HBAR_MAX_HEIGHT      = 920  // cap — beyond this the panel scrolls

/**
 * Resolve the render height for a ChartOutput. Horizontal categorical charts get
 * a height derived from their category count (so rows never cram); everything
 * else fills its container ('100%'), unchanged.
 */
export function categoricalChartHeight(output: ChartOutput): number | '100%' {
  const n = output.categories.length
  if (!output.horizontal || n === 0) return '100%'
  return Math.min(HBAR_MAX_HEIGHT, Math.max(HBAR_MIN_HEIGHT, n * HBAR_PX_PER_CATEGORY))
}

// ── Bar thickness — absolute px CAP at low cardinality ─────────────────
//
//  THE PROBLEM ApexCharts hands us: it sizes a bar as a PERCENT of its
//  per-category slot (columnWidth for vertical, barHeight for horizontal), where
//  slot = plotDimension / categoryCount. It has NO native absolute ceiling — no
//  `barMaxWidth` (ECharts) / `maxPointWidth` (Highcharts). So a FIXED percent is
//  the wrong lever at low cardinality: at n=1 the slot is the WHOLE plot, so any
//  generous percent (the old 64%) paints one bar as a full-width/height BLOCK —
//  the "terribly thick fat stripe" a solo region produces on the State-B
//  composition bar and the regional-comparison hbar.
//
//  THE MODEL (market standard — Datawrapper / Observable Plot / ECharts
//  barMaxWidth): cap the bar's ABSOLUTE thickness. A solo/2-bar chart reads as a
//  deliberate FOCUS bar of sane thickness with intentional whitespace around it,
//  never a block; a many-bar chart still fills its (now narrow) slots up to a
//  gap-preserving ceiling. We translate the px cap into the percent ApexCharts
//  wants: to cap thickness at `capPx`, and since slot = plotDim / n,
//      pct = capPx / slot * 100 = capPx * n * 100 / plotDim
//  clamped to [BAR_FILL_MIN_PCT, BAR_FILL_MAX_PCT] (a legible floor; a ceiling
//  that always leaves a gap so many bars never fuse into a wall). `floor` makes
//  "thickness ≤ capPx" a hard guarantee (never rounds a solo bar back over the
//  cap). Orientation-neutral (Law 1): the SAME function feeds columnWidth and
//  barHeight; only the plot dimension + cap differ per axis.
//
//  Where `plotDim` comes from:
//   • HORIZONTAL — the bar's thickness is the row height, and we OWN the chart
//     height (categoricalChartHeight). So the cap is EXACT — no estimate.
//   • VERTICAL — the bar's thickness is its width, a % of the plot WIDTH, which
//     ApexCharts only knows at render (container-query / solo-vs-paired). We
//     estimate it from the viewport (estimatedPlotWidth), biased to the FULL-WIDTH
//     solo case (the State-B / comparison panels that actually hit the pathology).
//     A wider real plot yields a proportionally wider bar, still gap-bounded by
//     BAR_FILL_MAX_PCT — so the worst case (a full-width BLOCK) is eliminated even
//     though the px cap is exact only at the reference width. A true all-width px
//     cap would require reading gridWidth in a mounted/updated event + updateOptions
//     (ECharts/Highcharts do it at layout) — deferred as a larger change.
//
export const BAR_CAP_PX_VERTICAL   = 88   // solo/few vertical column: max absolute WIDTH  (owner: 64–96px)
export const BAR_CAP_PX_HORIZONTAL  = 128  // solo/few horizontal bar:  max absolute THICKNESS (a sane focus band)
export const BAR_FILL_MAX_PCT      = 82   // ceiling — many bars fill their slot but keep a gap (never a wall)
export const BAR_FILL_MIN_PCT      = 6    // floor — keeps the percent a valid, painted positive
const REFERENCE_PLOT_WIDTH         = 900  // assumed plot width when no viewport (SSR / jsdom)
const PLOT_WIDTH_FRACTION          = 0.82 // plot width ≈ this share of a full-width panel's viewport

/**
 * Bar-fill PERCENT (bare integer, no `%`) that caps a bar's absolute thickness at
 * `capPx` for `categoryCount` bars sharing a `plotDimPx`-wide/tall plot. Rises with
 * n (bars fill their shrinking slots) up to BAR_FILL_MAX_PCT; floored at
 * BAR_FILL_MIN_PCT. `floor` guarantees the resulting thickness never exceeds capPx.
 */
export function barFillPctForCap(categoryCount: number, plotDimPx: number, capPx: number): number {
  // Finite guard (Law 6 — root cause, not a downstream suppression): a NaN/≤0
  // plotDimPx (an unmounted/detached box hands ApexCharts a 0-size or NaN plot
  // dimension) would make slot → NaN, pct → NaN, and Math.min/max/floor all
  // propagate NaN straight into columnWidth/barHeight — a NaN reaching apex
  // options. When no finite plot dimension exists we cannot compute an absolute
  // cap, so fall back to the gap-preserving ceiling: bars fill their slot but
  // never fuse into a wall (identical to the pre-cap default), and it is always a
  // valid painted positive. capPx is a module constant (finite by construction).
  if (!Number.isFinite(plotDimPx) || plotDimPx <= 0) return BAR_FILL_MAX_PCT
  const n    = Math.max(1, Number.isFinite(categoryCount) ? categoryCount : 1)
  const slot = plotDimPx / n
  const pct  = (capPx / slot) * 100
  return Math.floor(Math.min(BAR_FILL_MAX_PCT, Math.max(BAR_FILL_MIN_PCT, pct)))
}

/** Estimated plot WIDTH (px) for a vertical bar — viewport-derived, biased to the
 *  full-width solo panel; REFERENCE_PLOT_WIDTH when there's no window (SSR/jsdom). */
export function estimatedPlotWidth(): number {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  return vw > 0 ? Math.max(320, vw * PLOT_WIDTH_FRACTION) : REFERENCE_PLOT_WIDTH
}

/** columnWidth fill-percent for a VERTICAL bar — caps absolute WIDTH at BAR_CAP_PX_VERTICAL. */
export function verticalBarFillPct(categoryCount: number): number {
  return barFillPctForCap(categoryCount, estimatedPlotWidth(), BAR_CAP_PX_VERTICAL)
}

/** barHeight fill-percent for a HORIZONTAL bar — caps absolute THICKNESS at
 *  BAR_CAP_PX_HORIZONTAL against the EXACT owned chart height (no estimate). */
export function horizontalBarFillPct(output: ChartOutput): number {
  const h           = categoricalChartHeight(output)
  const totalHeight = typeof h === 'number' ? h : HBAR_MIN_HEIGHT
  return barFillPctForCap(output.categories.length, totalHeight, BAR_CAP_PX_HORIZONTAL)
}

// ── Horizontal value-axis headroom (out-of-bar end-labels) ─────────────
//
//  Root cause: an hbar prints each bar's value label OUTSIDE the bar end
//  (dataLabels position:'top' + offsetX). The label's width scales with the
//  value, so the LONGEST bar's label overhangs the plot's right edge — and it
//  clips there whether the value scale is HIDDEN (Apex auto-fits the range flush
//  to the data max) or VISIBLE (Apex's nice-scale headroom is only a few percent
//  — far short of a multi-digit label like "983" for Tbilisi, which shears).
//  Grid padding (grid.ts) cannot cover a label whose width scales with the value
//  and is clipped at the PLOT area, so reserve the room in the SCALE itself: end
//  the longest bar before the edge, leaving the label inside the plot.
//
//  Applied when: horizontal + labels shown + no explicit max authored (an authored
//  max is deliberate → respected untouched). Axis visibility is IRRELEVANT — the
//  end-label needs bar-end room either way. The headroom is rounded UP to a nice
//  scale so a VISIBLE axis keeps clean, round tick labels (not an arbitrary max).
//  Returns the authored max otherwise (undefined ⇒ Apex auto-scale, unchanged).
//
const HBAR_VALUE_HEADROOM = 1.10   // ≥10% past the data max, then nice-rounded up

// A 1-2-5-ish "nice" ladder — round a raw headroom value UP to the next clean
// scale so the resulting axis max yields round tick labels on a visible axis.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const

function niceCeil(v: number): number {
  if (v <= 0) return v
  const mag  = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  const step = NICE_STEPS.find((s) => s >= norm - 1e-9) ?? 10
  return step * mag
}

/**
 * Nice FLOOR for a negative axis extent — rounds a negative value DOWN (further
 * from zero) to the same 1-2-5 "nice" ladder niceCeil uses, mirrored across zero.
 * niceFloor(-18 000) → -20 000; niceFloor(-2 836) → -3 000; v ≥ 0 → 0.
 *
 * Portal notes item 9 root cause: a stacked/bar chart whose negatives are small
 * (≈ -20K) let ApexCharts auto-pick a far-too-generous floor (-50K), wasting half
 * the plot. Fitting the axis floor to the data's ACTUAL negative extent — nice-
 * rounded so ticks stay clean — is the data-driven fix (never a hardcoded -20).
 */
export function niceFloor(v: number): number {
  return v >= 0 ? 0 : -niceCeil(-v)
}

export function hbarValueAxisMax(
  horizontal:      boolean,
  showDataLabels:  boolean,
  authoredMax:     number | undefined,
  series:          readonly ChartSeries[],
): number | undefined {
  if (!horizontal || !showDataLabels || authoredMax != null) return authoredMax
  const dataMax = Math.max(0, ...series.flatMap((s) => s.data.map((pt) => pt.value ?? 0)))
  return dataMax > 0 ? niceCeil(dataMax * HBAR_VALUE_HEADROOM) : authoredMax
}
