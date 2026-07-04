// @vitest-environment jsdom
//
// ── APEX-NO-PARENT-REDRAW — Apex's own resize-redraw is disabled ─────────────
//
//  Two symptoms, ONE shared root: ApexCharts ships its OWN internal
//  ResizeObserver-driven "redraw when the parent resizes" behaviour
//  (chart.redrawOnParentResize, default true), which:
//
//   1. Races ApexRenderer's own useContainerVisible mount/unmount gate (the
//      chart↔table toggle NaN-crash fix) — Apex's redraw can fire against a
//      just-shrunk (display:none-bound) parent in the SAME resize-observer
//      delivery batch, before our own gate finishes unmounting the chart.
//   2. Debounces via a bare `window.setTimeout(..., 150)` that Apex's own
//      `destroy()` never clears — a hide-then-unmount within that window
//      leaves the timer armed to fire into an already-torn-down chart
//      context (the `getComputedStyle`-on-teardown page error).
//
//  ApexRenderer's visibility gate is already the single, precise source of
//  truth for "did my container's layout change" — so Apex's redundant,
//  racy, un-cancellable internal redraw is disabled outright rather than
//  patched around. `redrawOnWindowResize` (a genuine BROWSER resize, not a
//  parent-layout reflow) is left untouched.
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartSeries } from '@statdash/charts'
import { BASE }            from './base'
import { buildCartesian }  from './cartesian'
import { buildPie }        from './pie'

const y: AxisOutput = { unit: undefined, decimals: undefined }

function series(name: string, color: string, vals: number[]): ChartSeries {
  return { name, color, data: vals.map((v) => ({ value: v, formatted: String(v) })) }
}

function out(over: Partial<ChartOutput> = {}): ChartOutput {
  return {
    type: 'bar', categories: ['A', 'B'],
    series: [series('one', '#6B7B8D', [1, 2])],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: true }, tooltip: { show: true }, annotations: [],
    ...over,
  }
}

describe('APEX-NO-PARENT-REDRAW — redrawOnParentResize disabled at the shared root', () => {
  it('BASE.chart pins redrawOnParentResize:false', () => {
    expect(BASE.chart?.redrawOnParentResize).toBe(false)
  })

  it('a genuine window resize still redraws — redrawOnWindowResize is untouched', () => {
    expect(BASE.chart?.redrawOnWindowResize).not.toBe(false)
  })

  it('composes into every builder that spreads BASE.chart (cartesian + pie)', () => {
    expect(buildCartesian(out()).chart?.redrawOnParentResize).toBe(false)
    expect(buildPie(out({ type: 'donut' })).chart?.redrawOnParentResize).toBe(false)
  })
})
