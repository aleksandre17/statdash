// @vitest-environment jsdom
//
// ── Numeric axis formatter survives the responsive merge (AUDIT F6 / R5) ──────
//
//  Defect: at narrow widths the gdp chart y-axis printed a raw float
//  "120000.000000000000" instead of the canonical "120 000". Root cause:
//  ApexCharts' responsive merge re-runs each breakpoint's `yaxis` through
//  Config.extendYAxis, which rebuilds the axis from library defaults and drops
//  any `labels.formatter` the override doesn't re-supply — so a bare
//  `{ labels: { style: { fontSize } } }` override reverts the value axis to
//  ApexCharts' built-in float printer. The fix (responsiveYAxis) re-carries the
//  fmtNum-backed formatter into every responsive numeric-y-axis override.
//
//  This guard pins the invariant: the value-axis formatter present at base must
//  also be present — and produce identical, zero-run-free output — at EVERY
//  responsive breakpoint, for every builder that owns a numeric y-axis.
//

import { describe, it, expect } from 'vitest'
import type { ApexOptions } from 'apexcharts'
import type { ChartOutput, AxisOutput } from '@statdash/charts'
import { buildCartesian }    from './cartesian'
import { buildContribution } from './contribution'

// Representative awkward value: an integer that ApexCharts' default printer
// renders with a 12-zero float tail when no formatter is applied.
const RAW = 120000
const RAW_FLOAT = /\d\.0{3,}/ // matches "120000.000000000000" et al.

function makeOutput(y: AxisOutput): ChartOutput {
  return {
    type:       'bar',
    categories: ['2021', '2022'],
    series: [{
      name:  'GDP',
      color: '#0080BE',
      data: [
        { value: RAW,    formatted: '120 000' },
        { value: 240000, formatted: '240 000' },
      ],
    }],
    axes:        { x: {}, y, y2: undefined },
    stacked:     false,
    horizontal:  false,
    legend:      { show: true },
    tooltip:     { show: true },
    annotations: [],
  }
}

/** Pull a single y-axis label formatter out of an ApexOptions yaxis slot. */
function yFormatterOf(yaxis: ApexOptions['yaxis']): ((v: number) => string) | undefined {
  const axis = Array.isArray(yaxis) ? yaxis[0] : yaxis
  return axis?.labels?.formatter as ((v: number) => string) | undefined
}

/** Every responsive breakpoint that carries a numeric `yaxis` override. */
function responsiveYFormatters(opts: ApexOptions): Array<(v: number) => string> {
  return (opts.responsive ?? [])
    .map((r) => yFormatterOf((r.options as ApexOptions).yaxis))
    .filter((f): f is (v: number) => string => typeof f === 'function')
}

describe('numeric y-axis formatter — responsive survival', () => {
  it('cartesian: base axis formats RAW cleanly (no raw float tail)', () => {
    const out = buildCartesian(makeOutput({ unit: undefined, decimals: undefined }))
    const fmt = yFormatterOf(out.yaxis)
    expect(fmt).toBeTypeOf('function')
    const label = fmt!(RAW)
    // The exact grouped string is owned by core fmtNum; this guard only pins
    // that the axis emits a clean formatted label, never the raw float that
    // ApexCharts' default printer produces ("120000.000000000000").
    expect(label).not.toMatch(RAW_FLOAT)
    expect(label).not.toBe(String(RAW))
    expect(label.length).toBeGreaterThan(0)
  })

  it('cartesian: EVERY responsive breakpoint keeps an identical clean formatter', () => {
    const out  = buildCartesian(makeOutput({ unit: undefined, decimals: undefined }))
    const base = yFormatterOf(out.yaxis)!(RAW)
    const fmts = responsiveYFormatters(out)
    // BP_MD + BP_SM both override yaxis — the formatter must ride along on both.
    expect(fmts.length).toBeGreaterThanOrEqual(2)
    for (const f of fmts) {
      expect(f(RAW)).not.toMatch(RAW_FLOAT)
      expect(f(RAW)).toBe(base)
    }
  })

  it('cartesian: unit + decimals ride along on every breakpoint', () => {
    const out  = buildCartesian(makeOutput({ unit: 'unit', decimals: 1 }))
    const base = yFormatterOf(out.yaxis)!
    const baseLabel = base(88425.6)
    // Sanity: no raw float, the unit rode along, the single decimal survived.
    expect(baseLabel).not.toMatch(RAW_FLOAT)
    expect(baseLabel.endsWith('unit')).toBe(true)
    expect(baseLabel).toMatch(/\.6\b/)
    // Identical at every responsive breakpoint (the regression guard).
    for (const f of responsiveYFormatters(out)) {
      expect(f(88425.6)).toBe(baseLabel)
    }
  })

  it('contribution: value axis formatter also survives every breakpoint', () => {
    const out  = buildContribution(makeOutput({ unit: undefined, decimals: undefined }))
    const base = yFormatterOf(out.yaxis)!(RAW)
    expect(base).not.toMatch(RAW_FLOAT)
    const fmts = responsiveYFormatters(out)
    expect(fmts.length).toBeGreaterThanOrEqual(2)
    for (const f of fmts) {
      expect(f(RAW)).not.toMatch(RAW_FLOAT)
      expect(f(RAW)).toBe(base)
    }
  })
})
