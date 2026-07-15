// @vitest-environment jsdom
//
// ── Low-cardinality render rules — colours + bar thickness ────────────────────
//
//  Locks the three-defect rendering rule so a few-series / few-bar chart reads at
//  the market standard (owner ref scriness/img_5), applied UNIFORMLY (no per-panel
//  special-casing):
//
//   #1 Distinct categorical colour PER SERIES — a multi-series bar whose series carry
//      no explicit semantic colour must resolve one distinct hue per series index
//      (Grammar-of-Graphics colour encoding), not collapse to a single grey.
//   #4 Bar thickness is CAPPED in absolute px at low cardinality — a solo / 2-bar
//      chart reads as a focus bar with whitespace, NEVER a fat stripe/block; the
//      fill % rises as the count climbs so many bars still fill their (narrow)
//      slots up to a gap-preserving ceiling. Same rule for columnWidth (vertical),
//      barHeight (horizontal) and the diverging hbar.
//
//  Agnostic: colours keyed on series INDEX, thickness on category COUNT + a px cap
//  — never a region/sector name or a per-config number.
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartSeries } from '@statdash/charts'
import { chartColorAt } from '@statdash/styles'
import { buildCartesian }        from './cartesian'
import { buildHBarDiverging }    from './hbar-diverging'
import {
  barFillPctForCap, verticalBarFillPct, horizontalBarFillPct, categoricalChartHeight,
  hbarValueAxisMax,
  BAR_FILL_MAX_PCT, BAR_FILL_MIN_PCT, BAR_CAP_PX_VERTICAL, BAR_CAP_PX_HORIZONTAL,
} from './base'

/** Absolute px thickness a fill percent yields for n bars in a plotDim-wide/tall plot. */
const thicknessPx = (pct: number, plotDim: number, n: number) => (pct / 100) * (plotDim / n)

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

// ── #1 colour-by-series ───────────────────────────────────────────────────────
describe('DEFECT#1 — distinct categorical colour per series', () => {
  it('seriesColorByIndex → each series resolves a DISTINCT hue by index', () => {
    const opts = buildCartesian(out({
      seriesColorByIndex: true,
      categories: ['Agriculture', 'Industry'],
      series: [
        series('Imereti',      '#6B7B8D', [10, 20]),   // both grey seed …
        series('Shida Kartli', '#6B7B8D', [15, 25]),   // … indistinguishable before the fix
      ],
    }))
    const colors = opts.colors as string[]
    expect(colors).toHaveLength(2)
    expect(colors[0]).toBe(chartColorAt(0))
    expect(colors[1]).toBe(chartColorAt(1))
    expect(colors[0]).not.toBe(colors[1])            // the whole point: distinguishable
  })

  it('without the flag, explicit series colours are preserved verbatim', () => {
    const opts = buildCartesian(out({
      series: [series('a', '#005a9c', [1]), series('b', '#e8710a', [2])],
    }))
    expect(opts.colors).toEqual(['#005a9c', '#e8710a'])
  })

  it('distributed still wins for a single-series categorical bar (unchanged seam)', () => {
    const opts = buildCartesian(out({ distributed: true, series: [series('x', '#6B7B8D', [1, 2])] }))
    expect((opts.colors as string[]).length).toBeGreaterThan(1)
  })
})

// ── #4 bar thickness — absolute px cap ──────────────────────────────────────────
describe('DEFECT#4 — bar thickness capped in px at low cardinality (no fat stripe)', () => {
  const PLOT = 900   // reference plot dimension for the pure-math assertions

  it('caps absolute thickness at the px ceiling for a solo / few-bar chart', () => {
    // The pathology: a solo bar as a full-plot BLOCK. Assert the resolved thickness
    // never exceeds the cap for the low-cardinality range (floor() guarantees ≤ cap).
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const pct = barFillPctForCap(n, PLOT, BAR_CAP_PX_VERTICAL)
      expect(thicknessPx(pct, PLOT, n)).toBeLessThanOrEqual(BAR_CAP_PX_VERTICAL)
    }
  })

  it('fill percent RISES monotonically with cardinality, bounded both ways', () => {
    let prev = 0
    for (let n = 1; n <= 40; n++) {
      const pct = barFillPctForCap(n, PLOT, BAR_CAP_PX_VERTICAL)
      expect(pct).toBeGreaterThanOrEqual(prev)               // non-decreasing (bars fill shrinking slots)
      expect(pct).toBeLessThanOrEqual(BAR_FILL_MAX_PCT)       // ceiling — never a solid wall
      expect(pct).toBeGreaterThanOrEqual(BAR_FILL_MIN_PCT)    // floor — always a painted positive
      prev = pct
    }
    // many bars reach the gap-preserving ceiling and fill their slots
    expect(barFillPctForCap(40, PLOT, BAR_CAP_PX_VERTICAL)).toBe(BAR_FILL_MAX_PCT)
  })

  it('a 2-bar chart is markedly THICKER (px) than a 12-bar one — but neither a stripe', () => {
    const t2  = thicknessPx(barFillPctForCap(2,  PLOT, BAR_CAP_PX_VERTICAL), PLOT, 2)
    const t12 = thicknessPx(barFillPctForCap(12, PLOT, BAR_CAP_PX_VERTICAL), PLOT, 12)
    expect(t2).toBeGreaterThan(t12)
    expect(t2).toBeLessThanOrEqual(BAR_CAP_PX_VERTICAL)       // …still capped, not a block
  })

  it('horizontal thickness is capped against the EXACT owned chart height', () => {
    // Horizontal owns its height (categoricalChartHeight), so the cap is exact — no estimate.
    for (const n of [1, 2, 3]) {
      const o = out({ type: 'hbar', horizontal: true, categories: Array.from({ length: n }, (_, i) => `c${i}`) })
      const h = categoricalChartHeight(o) as number
      expect(thicknessPx(horizontalBarFillPct(o), h, n)).toBeLessThanOrEqual(BAR_CAP_PX_HORIZONTAL)
    }
  })

  it('vertical bar uses the capped fill rule for columnWidth', () => {
    const opts = buildCartesian(out({ categories: ['A', 'B'], horizontal: false }))
    expect((opts.plotOptions?.bar as { columnWidth?: string }).columnWidth)
      .toBe(`${verticalBarFillPct(2)}%`)
  })

  it('horizontal bar uses the capped fill rule for barHeight', () => {
    const o = out({ type: 'hbar', horizontal: true, categories: ['A', 'B'] })
    const opts = buildCartesian(o)
    expect((opts.plotOptions?.bar as { barHeight?: string }).barHeight)
      .toBe(`${horizontalBarFillPct(o)}%`)
  })

  it('NEVER returns NaN — a non-finite/≤0 plotDim falls back to the gap-preserving ceiling', () => {
    // Latent guard (Law 6): an unmounted/detached box hands a NaN or 0 plot
    // dimension. Without the finite-check, slot→NaN, pct→NaN, floor(NaN)→NaN would
    // reach columnWidth/barHeight. Every degenerate input must yield a valid,
    // painted, finite percent — and specifically the ceiling when uncomputable.
    for (const bad of [NaN, 0, -100, Infinity, -Infinity]) {
      const pct = barFillPctForCap(2, bad, BAR_CAP_PX_VERTICAL)
      expect(Number.isNaN(pct)).toBe(false)
      expect(pct).toBe(BAR_FILL_MAX_PCT)
    }
    // A NaN categoryCount must not poison a finite plotDim either.
    const pct = barFillPctForCap(NaN, 900, BAR_CAP_PX_VERTICAL)
    expect(Number.isFinite(pct)).toBe(true)
    expect(pct).toBeGreaterThanOrEqual(BAR_FILL_MIN_PCT)
    expect(pct).toBeLessThanOrEqual(BAR_FILL_MAX_PCT)
  })

  it('diverging hbar caps via barHeight (not the dead columnWidth)', () => {
    const o: ChartOutput = {
      type: 'hbar-diverging', categories: ['A', 'B', 'C'],
      series: [series('Resources', '#005a9c', [1, 2, 3])],
      axes: { x: {}, y, y2: undefined },
      stacked: false, horizontal: true,
      legend: { show: true }, tooltip: { show: true }, annotations: [], groups: [],
    }
    const opts = buildHBarDiverging(o)
    expect((opts.plotOptions?.bar as { barHeight?: string }).barHeight)
      .toBe(`${horizontalBarFillPct(o)}%`)
    // the old dead config must be gone (ApexCharts ignores columnWidth on horizontal)
    expect((opts.plotOptions?.bar as { columnWidth?: string }).columnWidth).toBeUndefined()
  })
})

// ── hbar value-label headroom + no residual axis (R6 follow-up + B3 fix) ─────────
//
//  A horizontal bar prints each bar's value label OUTSIDE the bar end. Without
//  headroom the LONGEST bar runs flush to the plot edge and its label shears +
//  overflows — whether the value scale is HIDDEN (Apex auto-fits flush to the data
//  max — the original "42 982.6" R6 case) or VISIBLE (Apex's nice-scale headroom is
//  only a few percent — the "983"/Tbilisi B3 clip). The fix reserves headroom in
//  the SCALE (hbarValueAxisMax) so the label fits, nice-rounded so a visible axis
//  keeps clean ticks; a hidden axis additionally leaves NO residual chrome behind.
//
describe('hbar value-label headroom (hidden OR visible value axis)', () => {
  const hiddenY: AxisOutput = { hidden: true }
  const bigSeries: ChartSeries = series('GDP', '#005a9c', [42982.6, 12000, 8000, 5000])
  const b3Series:  ChartSeries = series('Regions', '#005a9c', [983, 640, 420, 180]) // the audited "983"/Tbilisi case

  it('reserves scale headroom past the data max (label cannot shear at the edge)', () => {
    const max = hbarValueAxisMax(true, true, undefined, [bigSeries])
    expect(max).toBeDefined()
    expect(max!).toBeGreaterThan(42982.6)   // the longest bar ends BEFORE the plot edge
  })

  it('reserves headroom on a VISIBLE value axis too (B3 — the "983" clip)', () => {
    const max = hbarValueAxisMax(true, true, undefined, [b3Series])
    expect(max).toBeDefined()
    expect(max!).toBeGreaterThan(983)       // longest bar ends before the edge; label fits
    // nice-rounded so the visible axis keeps clean ticks (not an arbitrary 983*k)
    expect(max).toBe(1200)                  // niceCeil(983 * 1.10 = 1081.3) → 1200
  })

  it('respects an explicitly authored max (author intent wins)', () => {
    expect(hbarValueAxisMax(true, true, 50000, [bigSeries])).toBe(50000)
  })

  it('is inert unless horizontal + data-labels (axis visibility is irrelevant)', () => {
    expect(hbarValueAxisMax(false, true,  undefined, [bigSeries])).toBeUndefined() // vertical
    expect(hbarValueAxisMax(true,  false, undefined, [bigSeries])).toBeUndefined() // no labels
  })

  it('buildCartesian: hidden-value hbar gets a headroom max AND no residual axis', () => {
    const opts = buildCartesian(out({
      type: 'hbar', horizontal: true,
      categories: ['Tbilisi', 'Adjara', 'Imereti', 'Kakheti'],
      series: [bigSeries],
      axes: { x: {}, y: hiddenY, y2: undefined },
      dataLabels: true,
    }))
    const xaxis = opts.xaxis as { max?: number; labels?: { show?: boolean }
      axisBorder?: { show?: boolean }; axisTicks?: { show?: boolean } }

    // headroom reserved — the longest bar (42 982.6) ends before the plot edge
    expect(xaxis.max).toBeGreaterThan(42982.6)
    // no residual axis chrome where the scale used to be
    expect(xaxis.labels?.show).toBe(false)
    expect(xaxis.axisBorder?.show).toBe(false)
    expect(xaxis.axisTicks?.show).toBe(false)
    // gridlines for the hidden axis are dropped too (no leftover vertical rules)
    expect((opts.grid as { xaxis?: { lines?: { show?: boolean } } }).xaxis?.lines?.show).toBe(false)
    // per-bar value labels stay ON (R6 hides the scale, keeps the labels)
    expect(opts.dataLabels?.enabled).toBe(true)
  })

  it('buildCartesian: VISIBLE-value hbar also gets the headroom max (B3 regression guard)', () => {
    const opts = buildCartesian(out({
      type: 'hbar', horizontal: true,
      categories: ['Tbilisi', 'Adjara', 'Imereti', 'Kakheti'],
      series: [b3Series],
      axes: { x: {}, y: {}, y2: undefined },   // value axis VISIBLE (not hidden)
      dataLabels: true,
    }))
    const xaxis = opts.xaxis as { max?: number; labels?: { show?: boolean } }
    // the "983" bar ends before the plot edge; its outside label fits (nice max)
    expect(xaxis.max).toBe(1200)
    // the visible scale keeps its labels (headroom is orthogonal to axis chrome)
    expect(xaxis.labels?.show).not.toBe(false)
  })
})
