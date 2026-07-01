// @vitest-environment jsdom
//
// ── FILL-vbar — a vertical bar must FILL its (growable, equal-height) card ─────
//
//  Defect (measured on the live server): the expenditure vertical-bar
//  (`contribution`) did NOT fill its stretched equal-height card — the ApexCharts
//  plot froze at its intrinsic ~176px while the card body stretched to match the
//  taller paired production donut, leaving a white gap that GREW with width
//  (150px @1024 → 319px @1920).
//
//  Root cause (config half): a vertical bar must hand ApexCharts a RELATIVE height
//  (`chart.height: '100%'`) so Apex sizes the SVG to the parent's (now definite,
//  flex-stretched) clientHeight — never a FIXED pixel number, which freezes the
//  plot regardless of how tall the card grows. `parentHeightOffset: 0` keeps the
//  fill flush (no phantom offset band re-opening the gap). The CSS half — the
//  unbroken flex/height chain from the stretched card body down to the Apex mount
//  div — is locked separately by FF-PANEL-SIZING (panel-sizing.fitness.test.ts).
//
//  This gate pins the config invariant so a frozen-176 regression (someone
//  re-introducing a fixed `chart.height` on a vertical bar, or dropping
//  parentHeightOffset) turns red. Horizontal bars are DELIBERATELY exempt: they
//  size to their category count (categoricalChartHeight → a px number) so rows
//  never cram — that non-regression is asserted here too.
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput, ChartType } from '@statdash/charts'
import { BASE, categoricalChartHeight } from './base'
import { buildCartesian }               from './cartesian'
import { buildContribution }            from './contribution'

function makeOutput(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type:       'bar',
    categories: ['C', 'I', 'X', 'M'],
    series: [{
      name:  'Expenditure',
      color: '#00A896',
      data: [
        { value: 40000, formatted: '40 000' },
        { value: 25000, formatted: '25 000' },
        { value: 18000, formatted: '18 000' },
        { value: 12000, formatted: '12 000' },
      ],
    }],
    axes:        { x: {}, y, y2: undefined },
    stacked:     false,
    horizontal:  false,
    legend:      { show: false },
    tooltip:     { show: true },
    annotations: [],
    ...over,
  }
}

/** The `chart.height` a builder hands ApexCharts. */
const chartHeightOf = (opts: { chart?: { height?: number | string } }) => opts.chart?.height

describe('FILL-vbar — vertical bar config fills a growable card', () => {
  it('BASE pins parentHeightOffset:0 (no phantom offset re-opens the fill gap)', () => {
    expect(BASE.chart?.parentHeightOffset).toBe(0)
  })

  it('contribution (the ka-gdp expenditure vbar) asks Apex for height:100%, never a fixed px', () => {
    const opts = buildContribution(makeOutput({ type: 'contribution' }))
    expect(chartHeightOf(opts)).toBe('100%')
    expect(typeof chartHeightOf(opts)).not.toBe('number')
    // Inherits the flush-fill offset from BASE.
    expect(opts.chart?.parentHeightOffset).toBe(0)
  })

  it('cartesian vertical bar asks Apex for height:100%, never a fixed px', () => {
    const opts = buildCartesian(makeOutput({ type: 'bar', horizontal: false }))
    expect(chartHeightOf(opts)).toBe('100%')
    expect(typeof chartHeightOf(opts)).not.toBe('number')
    expect(opts.chart?.parentHeightOffset).toBe(0)
  })

  it('the desktop responsive breakpoints (≥ the fill widths) never pin a fixed vbar height', () => {
    // The frozen-176 defect was measured at 1024 / 1440 / 1920 — all at or above
    // BP_MD (1024). A fixed `chart.height` at those breakpoints would re-freeze the
    // plot. Only the mobile breakpoints (BP_SM 768 / BP_XS 480 — single-column, no
    // equal-height pairing) may pin a fixed height; assert the top breakpoint (the
    // one that fires FIRST as the container narrows from desktop) keeps it fluid.
    for (const build of [buildContribution, buildCartesian]) {
      const opts = build(makeOutput({ type: build === buildContribution ? 'contribution' : 'bar' }))
      const topBp = (opts.responsive ?? [])
        .filter(r => (r.breakpoint ?? 0) >= 1024)
        .sort((a, b) => (b.breakpoint ?? 0) - (a.breakpoint ?? 0))[0]
      // If a ≥1024 breakpoint exists, it must NOT override chart.height to a number.
      if (topBp) {
        const h = (topBp.options as { chart?: { height?: number | string } }).chart?.height
        expect(typeof h).not.toBe('number')
      }
    }
  })
})

describe('FILL-vbar non-regression — horizontal bars still size to their rows', () => {
  const hbarTypes: ChartType[] = ['hbar']

  it('categoricalChartHeight fills the container (100%) for a VERTICAL chart', () => {
    expect(categoricalChartHeight(makeOutput({ horizontal: false }))).toBe('100%')
  })

  it('categoricalChartHeight returns a DEFINITE px height for a HORIZONTAL chart (rows never cram)', () => {
    for (const type of hbarTypes) {
      const h = categoricalChartHeight(makeOutput({ type, horizontal: true }))
      expect(typeof h).toBe('number')
      expect(h).toBeGreaterThan(0)
    }
  })

  it('a horizontal chart with zero categories falls back to fill (no NaN/zero height)', () => {
    expect(categoricalChartHeight(makeOutput({ horizontal: true, categories: [] }))).toBe('100%')
  })
})
