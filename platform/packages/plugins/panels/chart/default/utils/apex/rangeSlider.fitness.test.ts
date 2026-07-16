// @vitest-environment jsdom
//
// ── rangeSlider — the x-range navigator brush is wired, and inert when absent ──
//
//  Portal review item 7: a range-slider (dataZoom/navigator) strip under the long
//  time-dynamics charts. Realized as an ApexCharts BRUSH companion (a slim second
//  chart whose selection drives the main plot's x-window). This gate pins the
//  OPTIONS-level contract — the parent handles live browser verification on the
//  dev tier — so the two invariants can't silently regress:
//
//    • flag DECLARED (vertical cartesian, enough categories) ⇒ the main chart
//      takes a stable id and the brush companion links to it via brush.target +
//      an enabled full-range selection.
//    • flag ABSENT ⇒ toApexOptions is byte-identical to the pre-rangeSlider
//      output (no chart.id, no default drift) and no slider renders.
//

import { describe, it, expect } from 'vitest'
import type { ChartOutput, AxisOutput } from '@statdash/charts'
import { toApexOptions } from '../toApexOptions'
import { shouldRenderSlider, buildBrushOptions, sliderChartId, navSeriesData, SLIDER_MIN_CATEGORIES } from './cartesian/brush'

// A long (12-year) vertical time-dynamics bar — the shape the three portal targets
// share (accounts stacked bar / gdp dynamics combo / regional sector-history area).
function longOutput(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: 'GEL mn', decimals: undefined }
  const years = Array.from({ length: 12 }, (_, i) => String(2010 + i))
  return {
    type:       'bar',
    categories: years,
    series: [{
      name:  'GDP',
      color: '#0080be',
      data:  years.map((_, i) => ({ value: 1000 + i * 100, formatted: String(1000 + i * 100) })),
    }],
    axes:        { x: {}, y },
    stacked:     false,
    horizontal:  false,
    legend:      { show: false },
    tooltip:     { show: true },
    annotations: [],
    ...over,
  }
}

describe('rangeSlider — gate (shouldRenderSlider)', () => {
  it('renders for a long vertical cartesian with the flag declared', () => {
    expect(shouldRenderSlider(longOutput({ rangeSlider: true }))).toBe(true)
  })

  it('does NOT render without the flag', () => {
    expect(shouldRenderSlider(longOutput())).toBe(false)
  })

  it('does NOT render on a horizontal bar (x-slider is meaningless there)', () => {
    expect(shouldRenderSlider(longOutput({ rangeSlider: true, horizontal: true }))).toBe(false)
  })

  it('does NOT render on a short series (nothing to window — honest degrade)', () => {
    const short = longOutput({ rangeSlider: true })
    const trimmed: ChartOutput = {
      ...short,
      categories: short.categories.slice(0, SLIDER_MIN_CATEGORIES - 1),
      series: short.series.map((s) => ({ ...s, data: s.data.slice(0, SLIDER_MIN_CATEGORIES - 1) })),
    }
    expect(shouldRenderSlider(trimmed)).toBe(false)
  })
})

describe('rangeSlider — main chart takes the linking id', () => {
  it('sets chart.id when a slider id is threaded', () => {
    const mainId = sliderChartId(':r7:', 'main')
    const opts = toApexOptions(longOutput({ rangeSlider: true }), undefined, 'en', mainId)
    expect(opts.chart?.id).toBe(mainId)
  })

  it('joins the converted-numeric domain: threaded id ⇒ xaxis.tickPlacement "on"', () => {
    // Apex can only window (xaxis.min/max) a category axis it has CONVERTED to
    // numeric 1..n — bar's default tickPlacement 'between' blocks the conversion,
    // so a brush against such a main silently cannot drive it (live defect class).
    const opts = toApexOptions(longOutput({ rangeSlider: true }), undefined, 'en', 'chart-main-x')
    expect((opts.xaxis as { tickPlacement?: string }).tickPlacement).toBe('on')
  })

  it('sliderChartId strips useId() colons to an Apex-safe id', () => {
    expect(sliderChartId(':r7:', 'main')).toBe('chart-main-r7')
    expect(sliderChartId(':r7:', 'brush')).toBe('chart-brush-r7')
  })
})

describe('rangeSlider — brush companion wiring', () => {
  const mainId = 'chart-main-x'
  const brushId = 'chart-brush-x'
  const out = longOutput({ rangeSlider: true })
  const brush = buildBrushOptions(out, { mainId, brushId })

  it('targets the main chart and enables a full-range selection', () => {
    const chart = brush.chart!
    expect(chart.id).toBe(brushId)
    expect(chart.brush?.enabled).toBe(true)
    expect(chart.brush?.target).toBe(mainId)
    expect(chart.selection?.enabled).toBe(true)
    // Full range on first paint (nothing hidden). Apex's category→numeric
    // conversion indexes categories ONE-BASED (labels[floor(val) - 1]), so the
    // full-range selection is [1, n] — [0, n-1] is off-domain on both ends.
    expect(chart.selection?.xaxis).toEqual({ min: 1, max: out.categories.length })
  })

  it('is a chromeless navigator (no toolbar / legend / tooltip / data labels)', () => {
    expect(brush.chart?.toolbar?.show).toBe(false)
    expect(brush.legend?.show).toBe(false)
    expect((brush.tooltip as { enabled?: boolean })?.enabled).toBe(false)
    expect(brush.dataLabels?.enabled).toBe(false)
  })

  it('navigator shape = per-category sum of the non-spacer series', () => {
    expect(navSeriesData(out)).toEqual(out.series[0]!.data.map((d) => d.value))
  })
})

describe('rangeSlider — ESM global seam (brush.ts module side-effect)', () => {
  // apexcharts' brush link resolves its target through the UMD global
  // (`ApexCharts.getChartByID`, Core.js setupBrushHandler) — absent in an ESM
  // bundle unless published. Importing brush.ts (done above) must have run the
  // one-time bootstrap; these pin the two live-crash killers (2026-07-16).
  it('publishes the apexcharts class to window.ApexCharts (UMD brush link)', () => {
    expect(typeof (window as { ApexCharts?: unknown }).ApexCharts).toBe('function')
  })

  it('quarantines the instance registry: window.Apex._chartInstances exists but is NON-ENUMERABLE', () => {
    // Enumerable, it rides Config's deep-merge of window.Apex into every later
    // chart's config, whose initialConfig clone then walks a live chart instance
    // (cyclic ctx) → RangeError. Non-enumerable = functional but merge-invisible.
    const apex = (window as { Apex?: Record<string, unknown> }).Apex
    expect(apex).toBeDefined()
    const desc = Object.getOwnPropertyDescriptor(apex, '_chartInstances')
    expect(desc).toBeDefined()
    expect(desc?.enumerable).toBe(false)
    expect(Object.keys(apex!)).not.toContain('_chartInstances')
  })
})

describe('rangeSlider — flag absent ⇒ byte-identical options (no drift)', () => {
  it('toApexOptions (no threaded id) emits NO chart.id whether the flag is set or not', () => {
    const withFlag    = toApexOptions(longOutput({ rangeSlider: true }), undefined, 'en')
    const withoutFlag = toApexOptions(longOutput(), undefined, 'en')
    expect(withFlag.chart?.id).toBeUndefined()
    // The rangeSlider intent alone changes NOTHING in the main options — the id is
    // the sole delta, and only when explicitly threaded by the renderer.
    expect(JSON.stringify(withFlag)).toBe(JSON.stringify(withoutFlag))
  })
})
