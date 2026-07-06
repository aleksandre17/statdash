// @vitest-environment jsdom
//
// ── Donut + Treemap numeric labels — hover-only gate (admin B4) ────────────────
//
//  THE INVARIANT: the numeric VALUE labels drawn ON donut slices / treemap tiles are
//  gated on the declarative `output.dataLabels` flag, defaulting OFF for these marks
//  (the ChartOutput contract: "true for bar/hbar, false otherwise"). When off, the
//  numbers live ONLY in the hover tooltip; the CATEGORY names stay (donut legend / tile
//  label) and the treemap contribution markers (=/+/-) stay — those are structure, not
//  the numeric value the admin asked to remove. `dataLabels: true` restores on-graph
//  numbers, so it stays Constructor-controllable (a render option, never a hardcode).
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ChartOutput } from '@statdash/charts'
import DonutChart   from './DonutChart'
import TreemapChart from './TreemapChart'

afterEach(cleanup)

// Donut leader labels render fmtV(value) = fmtNum(value, 1), which STRIPS trailing
// zeros (137 → "137", not "137.0"). Values are chosen distinct from the centre total
// (400) and from each other so a substring hit is unambiguous.
function donutOutput(dataLabels?: boolean): ChartOutput {
  return {
    type: 'donut', categories: ['ალფა', 'ბეტა'],
    series: [{
      name: 'დონატი', color: '#cccccc',
      data: [{ value: 137, formatted: '137 ₾' }, { value: 263, formatted: '263 ₾' }],
    }],
    axes: { x: {}, y: {} }, stacked: false, horizontal: false,
    legend: { show: true }, tooltip: { show: true }, annotations: [],
    total: 400, centerLabel: 'მშპ',
    ...(dataLabels !== undefined ? { dataLabels } : {}),
  }
}

function treemapOutput(dataLabels?: boolean): ChartOutput {
  return {
    type: 'treemap', categories: ['(=) ჯამი', '(+) ალფა', '(+) ბეტა'],
    series: [{
      name: 'ხე', color: '#0080BE',
      data: [
        { value: 350, formatted: '350.0' },
        { value: 100, formatted: '100.0' },
        { value: 250, formatted: '250.0' },
      ],
    }],
    axes: { x: {}, y: {} }, stacked: false, horizontal: false,
    legend: { show: false }, tooltip: { show: true }, annotations: [],
    ...(dataLabels !== undefined ? { dataLabels } : {}),
  }
}

describe('DonutChart — keeps its on-graph numbers by default (admin B4 = treemap-only)', () => {
  it('default (no dataLabels): the donut SHOWS its numeric slice values on-graph', () => {
    const { container } = render(<DonutChart output={donutOutput()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('ალფა')   // legend category kept
    expect(text).toContain('მშპ')    // centre label kept
    expect(text).toContain('400')    // centre rollup total kept
    // Numbers stay ON the donut (owner: numbers-hover-only is TREEMAP ONLY).
    expect(text.includes('137') || text.includes('263')).toBe(true)
  })

  it('dataLabels:false opts the donut numbers OUT to hover-only (Constructor-controllable)', () => {
    const { container } = render(<DonutChart output={donutOutput(false)} />)
    const text = container.textContent ?? ''
    expect(text).toContain('ალფა')       // legend category still kept
    expect(text).not.toContain('137')    // per-slice numeric value → hover-only
    expect(text).not.toContain('263')
  })
})

describe('TreemapChart — numeric tile values hover-only (default)', () => {
  it('default (no dataLabels): tile category + markers stay, numeric values are hidden', () => {
    const { container } = render(<TreemapChart output={treemapOutput()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('ჯამი')   // tile category (marker stripped) kept
    expect(text).toContain('ალფა')
    expect(text).toContain('ბეტა')
    expect(text).toContain('=')       // contribution marker kept (structure)
    expect(text).toContain('+')
    expect(text).not.toContain('350.0')  // tile numeric value → hover-only
    expect(text).not.toContain('100.0')
    expect(text).not.toContain('250.0')
  })

  it('dataLabels:true restores the on-tile numeric values', () => {
    const { container } = render(<TreemapChart output={treemapOutput(true)} />)
    const text = container.textContent ?? ''
    expect(text).toContain('ჯამი')
    expect(text).toContain('350.0')
    expect(text).toContain('250.0')
  })
})
