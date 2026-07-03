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
//   #4 Bars scale UP for few categories (autoBarFillPct), bounded, tapering as the
//      count climbs — the same rule for columnWidth (vertical) and barHeight
//      (horizontal) and the diverging hbar.
//
//  Agnostic: colours keyed on series INDEX, thickness on category COUNT — never a
//  region/sector name or a per-config number.
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartSeries } from '@statdash/charts'
import { chartColorAt } from '@statdash/styles'
import { buildCartesian }        from './cartesian'
import { buildHBarDiverging }    from './hbar-diverging'
import { autoBarFillPct, BAR_FILL_MAX_PCT, BAR_FILL_MIN_PCT } from './base'

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

// ── #4 bar thickness ───────────────────────────────────────────────────────────
describe('DEFECT#4 — bar thickness scales with cardinality (bounded)', () => {
  it('autoBarFillPct: few categories → MAX, tapering monotonically to the floor', () => {
    expect(autoBarFillPct(1)).toBe(BAR_FILL_MAX_PCT)
    expect(autoBarFillPct(2)).toBe(BAR_FILL_MAX_PCT)
    // strictly non-increasing as the count grows
    let prev = autoBarFillPct(2)
    for (let n = 3; n <= 40; n++) {
      const cur = autoBarFillPct(n)
      expect(cur).toBeLessThanOrEqual(prev)
      prev = cur
    }
    // bounded at both ends — never absurd
    expect(autoBarFillPct(2)).toBeLessThanOrEqual(BAR_FILL_MAX_PCT)
    expect(autoBarFillPct(999)).toBe(BAR_FILL_MIN_PCT)
  })

  it('a 2-category chart is markedly THICKER than a 12-category one', () => {
    expect(autoBarFillPct(2)).toBeGreaterThan(autoBarFillPct(12))
  })

  it('vertical bar uses the fill rule for columnWidth', () => {
    const opts = buildCartesian(out({ categories: ['A', 'B'], horizontal: false }))
    expect((opts.plotOptions?.bar as { columnWidth?: string }).columnWidth)
      .toBe(`${autoBarFillPct(2)}%`)
  })

  it('horizontal bar uses the fill rule for barHeight', () => {
    const opts = buildCartesian(out({ type: 'hbar', horizontal: true, categories: ['A', 'B'] }))
    expect((opts.plotOptions?.bar as { barHeight?: string }).barHeight)
      .toBe(`${autoBarFillPct(2)}%`)
  })

  it('diverging hbar uses the same fill rule', () => {
    const opts = buildHBarDiverging({
      type: 'hbar-diverging', categories: ['A', 'B', 'C'],
      series: [series('Resources', '#005a9c', [1, 2, 3])],
      axes: { x: {}, y, y2: undefined },
      stacked: false, horizontal: true,
      legend: { show: true }, tooltip: { show: true }, annotations: [], groups: [],
    })
    expect((opts.plotOptions?.bar as { columnWidth?: string }).columnWidth)
      .toBe(`${autoBarFillPct(3)}%`)
  })
})
