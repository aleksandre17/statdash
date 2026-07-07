// @vitest-environment jsdom
//
// ── Declarative axis hiding (axes.{x,y}.hidden) — R6 ──────────────────────────
//
//  ChartOutput axes are SEMANTIC (axes.y = VALUE axis, axes.x = CATEGORY axis).
//  ApexCharts swaps them visually for a horizontal bar, so buildCartesian maps the
//  semantic-hidden flag to the correct VISUAL apex axis. Hiding the value axis drops
//  its scale/ticks/border/labels + gridlines while the per-bar data labels and the
//  category (region) axis stay — the AR-2 R6 ask (remove the redundant 5k…45k scale
//  on the regional hbar, keep bar values + region names).
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartSeries } from '@statdash/charts'
import { buildCartesian } from './cartesian'

function series(name: string, color: string, vals: number[]): ChartSeries {
  return { name, color, data: vals.map((v) => ({ value: v, formatted: String(v) })) }
}

function out(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type: 'bar', categories: ['Tbilisi', 'Adjara'],
    series: [series('GVA', '#0080BE', [42620, 8634])],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: false }, tooltip: { show: true }, annotations: [],
    ...over,
  }
}

const labelsShow = (labels: unknown): boolean | undefined =>
  (labels as { show?: boolean } | undefined)?.show

describe('R6 — axes.{x,y}.hidden hides the value scale (declarative)', () => {
  it('hbar + value axis hidden → apex XAXIS (bottom scale) is hidden, category yaxis kept', () => {
    const opts = buildCartesian(out({
      type: 'hbar', horizontal: true,
      axes: { x: {}, y: { hidden: true }, y2: undefined },
    }))
    // Bottom value scale gone: labels/ticks/border all off.
    expect(labelsShow(opts.xaxis?.labels)).toBe(false)
    expect(opts.xaxis?.axisTicks?.show).toBe(false)
    expect(opts.xaxis?.axisBorder?.show).toBe(false)
    // Value gridlines gone.
    expect(opts.grid?.xaxis?.lines?.show).toBe(false)
    // Region-name (category) axis is untouched — NOT hidden.
    const yaxis = Array.isArray(opts.yaxis) ? opts.yaxis[0] : opts.yaxis
    expect(yaxis?.show).not.toBe(false)
    // Per-bar value labels stay on.
    expect(opts.dataLabels?.enabled).toBe(true)
  })

  it('vbar + value axis hidden → apex YAXIS (left value scale) is hidden, category xaxis kept', () => {
    const opts = buildCartesian(out({
      type: 'bar', horizontal: false,
      axes: { x: {}, y: { hidden: true }, y2: undefined },
    }))
    const yaxis = Array.isArray(opts.yaxis) ? opts.yaxis[0] : opts.yaxis
    expect(yaxis?.show).toBe(false)
    expect(opts.grid?.yaxis?.lines?.show).toBe(false)
    // Category (x) axis untouched.
    expect(labelsShow(opts.xaxis?.labels)).not.toBe(false)
  })

  it('no hidden flag → axes render normally (default, unchanged)', () => {
    const opts = buildCartesian(out({ type: 'hbar', horizontal: true }))
    expect(labelsShow(opts.xaxis?.labels)).not.toBe(false)
    expect(opts.xaxis?.axisBorder?.show).not.toBe(false)
    expect(opts.grid?.xaxis).toBeUndefined()
  })
})
