// ── ApexCharts shared base — shared constants & helpers ───────────────
//
//  Consumed by every builder in this folder.
//  Nothing here imports from sibling builder files.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartSeries, ChartOutput } from '@statdash/charts'
import { fmtNum, compact }               from '@statdash/engine'
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
    toolbar:    { show: false },
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
 * `decimals` undefined → the core `compact` SSOT (`88.4K` / `88,4 ათ.`), locale-aware
 * and monotonic. This replaces the old lossy `fmtNum(val/1000,0)+' 000'` hack that
 * fabricated "88 000" from 88 425.6 and collapsed adjacent ticks (C1 / FF-FORMAT-SSOT).
 */
export function yFormatter(unit?: string, decimals?: number, locale?: string): (val: number) => string {
  return (val: number) => {
    if (val === undefined || val === null) return ''
    const n = typeof decimals === 'number' ? fmtNum(val, decimals) : compact(val, locale)
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
const HBAR_MIN_HEIGHT      = 240  // floor — keeps a 1–6 row hbar from collapsing
const HBAR_MAX_HEIGHT      = 920  // cap — beyond this the panel scrolls

// ── Auto bar thickness (low-cardinality fill) ──────────────────────────
//
//  ApexCharts sizes a bar as a PERCENTAGE of its per-category slot
//  (columnWidth for vertical, barHeight for horizontal). A fixed low percent
//  leaves few-category charts looking thin with gaping whitespace between
//  bars (2–3 regions); a fixed high percent turns a many-category chart into a
//  solid wall. The market standard (ECharts barMaxWidth / Highcharts pointWidth,
//  Datawrapper) is a bounded rule: WIDE bars when few categories (fill the plot,
//  read as a deliberate comparison), TAPERING toward a legible floor as the
//  category count climbs — never absurd at either extreme.
//
//  Category-count-driven + orientation-neutral (Law 1): the same fraction feeds
//  columnWidth and barHeight. Grammar-of-Graphics "bar mark" sizing, not a
//  per-panel magic number. Bounds are the single tunable; exported for the gate.
//
export const BAR_FILL_MAX_PCT = 64  // few categories → wide, plot-filling bars
export const BAR_FILL_MIN_PCT = 34  // many categories → slim but legible floor
const BAR_FILL_TAPER          = 4   // percent shed per category beyond the 2-cat baseline

/**
 * Bounded bar-fill percentage for `columnWidth` / `barHeight`, driven by category
 * count. n≤2 → BAR_FILL_MAX_PCT (thick), easing by BAR_FILL_TAPER per extra
 * category down to BAR_FILL_MIN_PCT. Returns a bare integer percent (no `%`).
 */
export function autoBarFillPct(categoryCount: number): number {
  const n = Math.max(1, categoryCount)
  return Math.round(
    Math.min(BAR_FILL_MAX_PCT, Math.max(BAR_FILL_MIN_PCT, BAR_FILL_MAX_PCT - (n - 2) * BAR_FILL_TAPER)),
  )
}

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
