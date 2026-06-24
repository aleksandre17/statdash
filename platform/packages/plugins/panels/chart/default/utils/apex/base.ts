// ── ApexCharts shared base — shared constants & helpers ───────────────
//
//  Consumed by every builder in this folder.
//  Nothing here imports from sibling builder files.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartSeries } from '@statdash/charts'
import { fmtNum }           from '@statdash/engine'
import { cssVar }           from '@statdash/styles'

// ── Shared base config ─────────────────────────────────────────────────
//
//  Applied to every chart type. Individual builders override as needed.
//
export function liftTooltip(chartCtx: { el: Element }) {
  const tip = chartCtx.el.querySelector<HTMLElement>('.apexcharts-tooltip')
  if (tip) tip.style.zIndex = '99999'
}

export const BASE: ApexOptions = {
  chart: {
    toolbar:    { show: false },
    fontFamily: 'BPG Arial, Roboto, sans-serif',
    animations: { enabled: true, easing: 'easeinout', speed: 600,
      animateGradually: { enabled: true, delay: 40 } },
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
  tooltip: { theme: 'light' },
  states: {
    hover:  { filter: { type: 'lighten', value: 0.08 } },
    active: { filter: { type: 'darken',  value: 0.12 } },
  },
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Build a Y-axis label formatter that appends a unit string. */
export function yFormatter(unit?: string, decimals?: number): (val: number) => string {
  return (val: number) => {
    if (val === undefined || val === null) return ''
    const n = typeof decimals === 'number'
      ? fmtNum(val, decimals)
      : Math.abs(val) >= 1000
        ? fmtNum(val / 1000, 0) + ' 000'
        : fmtNum(val, 0)
    return unit ? `${n} ${unit}` : n
  }
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
