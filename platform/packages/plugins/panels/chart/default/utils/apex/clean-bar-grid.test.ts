// @vitest-environment jsdom
//
// ── Clean labeled-bar grid (hbarCleanGrid) — residual gridline suppression ─────
//
//  A horizontal bar with its value SCALE hidden (R6) and per-bar values printed ON
//  the bars is a "clean labeled bar" (like prices.geostat.ge). The value-axis
//  (vertical) gridlines already drop with the hidden axis, but the CATEGORY-axis
//  (horizontal) lines remain — the faint dashed lines the owner reads as "the
//  horizontal axis still showing" on the regional-comparison hbar. For this triad
//  the printed numbers ARE the scale, so ALL reference lines are suppressed; the
//  region-name (category) labels stay (grid LINES only, not the axis).
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartSeries } from '@statdash/charts'
import { buildCartesian } from './cartesian'
import { hbarCleanGrid } from './base'

function series(name: string, color: string, vals: number[]): ChartSeries {
  return { name, color, data: vals.map((v) => ({ value: v, formatted: String(v) })) }
}

function out(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type: 'bar', categories: ['Tbilisi', 'Adjara'],
    series: [series('GDP', '#0080BE', [42982.6, 8634])],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: false }, tooltip: { show: true }, annotations: [],
    ...over,
  }
}

describe('hbarCleanGrid — the clean labeled-bar predicate', () => {
  it('true only for horizontal + value-axis-hidden + data-labels (the clean-bar triad)', () => {
    expect(hbarCleanGrid(true, true, true)).toBe(true)
  })

  it('false for any leg missing (mirrors hbarValueAxisMax inertness)', () => {
    expect(hbarCleanGrid(false, true,  true)).toBe(false)  // vertical
    expect(hbarCleanGrid(true,  false, true)).toBe(false)  // value axis visible
    expect(hbarCleanGrid(true,  true,  false)).toBe(false) // no data labels
  })
})

describe('buildCartesian — grid reference lines for the clean labeled bar', () => {
  it('clean hbar (value axis hidden + labels) → BOTH axes gridlines suppressed', () => {
    const opts = buildCartesian(out({
      type: 'hbar', horizontal: true,
      axes: { x: {}, y: { hidden: true }, y2: undefined },
    }))
    // Value-axis (vertical) lines gone with the hidden axis…
    expect(opts.grid?.xaxis?.lines?.show).toBe(false)
    // …AND the residual category-axis (horizontal) lines gone — the owner's defect.
    expect(opts.grid?.yaxis?.lines?.show).toBe(false)
    // Region-name (category) axis itself stays visible — labels only, no grid lines.
    const yaxis = Array.isArray(opts.yaxis) ? opts.yaxis[0] : opts.yaxis
    expect(yaxis?.show).not.toBe(false)
    // Per-bar value labels stay on.
    expect(opts.dataLabels?.enabled).toBe(true)
  })

  it('normal hbar (value axis SHOWN) → grid unchanged (category lines keep default)', () => {
    const opts = buildCartesian(out({ type: 'hbar', horizontal: true }))
    // Not the clean-bar triad → no yaxis-line override, shared BASE grid intact.
    expect(opts.grid?.yaxis?.lines?.show).toBeUndefined()
    expect(opts.grid?.xaxis).toBeUndefined()
  })

  it('vertical bar with value axis hidden → NOT a clean bar: category (x) lines untouched', () => {
    const opts = buildCartesian(out({
      type: 'bar', horizontal: false,
      axes: { x: {}, y: { hidden: true }, y2: undefined },
    }))
    // Hidden VALUE axis is the y (left) here → its lines drop…
    expect(opts.grid?.yaxis?.lines?.show).toBe(false)
    // …but this is NOT the horizontal clean-bar case — the category x lines keep the
    // default (no override), so the shared grid stays for a vertical chart.
    expect(opts.grid?.xaxis).toBeUndefined()
  })
})
