// ── ChartEmitter fitness — SVG fidelity to the ChartOutput SSOT ────────
//
//  Grounded in the SSOT: every ChartOutput under test is produced by the REAL
//  interpreters (interpretChart) from DataRow[] — never hand-authored — so the
//  emitter is proven against exactly what the pipeline emits, the same input
//  the live Apex adapter consumes. Assertions are STRUCTURAL (mark counts,
//  axis ticks, labels present, viewBox sane, gap honesty), not pixel snapshots.
//

import { describe, it, expect } from 'vitest'
import type { DataRow, SectionContext } from '@statdash/engine'
import { interpretChart } from '../interpret'
import { chartRegistry } from '../registry'
import '../interpreters' // side-effect: register built-ins
import type { ChartDef } from '../types'
import { emit } from './emitter'
import { isEmittable, EMITTABLE_TYPES, EMIT_GAPS } from './coverage'
import { niceScale } from './scale'

const CTX = {} as SectionContext
const def = (over: Partial<ChartDef> = {}): ChartDef => ({ type: 'bar', label: 'GDP', ...over })

function row(series: string, label: string, value: number, extra: Partial<DataRow> = {}): DataRow {
  return { id: `${series}:${label}`, label, value, series, ...extra } as DataRow
}

const count = (s: string, re: RegExp): number => (s.match(re) || []).length
const RECTS      = /<rect[^>]*data-series=/g
const POLYLINE   = /<polyline/g
const POLYGON    = /<polygon/g
const CIRCLE     = /<circle/g
const GRIDLINE   = /stroke="#F0F5F3"/g

// Multi-series grouped bar: 2 series × 3 categories, all non-zero.
const barRows = [
  row('Imereti', 'Agri', 10), row('Imereti', 'Ind', 20), row('Imereti', 'Serv', 30),
  row('Kartli',  'Agri', 15), row('Kartli',  'Ind', 25), row('Kartli',  'Serv', 35),
]

describe('emit — every emitted SVG is well-formed + pure', () => {
  const cases: Array<[string, ChartDef, DataRow[]]> = [
    ['bar',   def({ type: 'bar' }),   barRows],
    ['hbar',  def({ type: 'hbar' }),  barRows],
    ['line',  def({ type: 'line' }),  barRows],
    ['area',  def({ type: 'area' }),  barRows],
    ['combo', def({ type: 'combo' }), barRows],
  ]

  it.each(cases)('%s → valid, self-contained, deterministic, NaN-free', (_name, d, rows) => {
    const out = interpretChart(d, rows, CTX)
    const svg = emit(out)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('viewBox="0 0 ')
    expect(svg).toContain('role="img"')
    expect(svg).toContain('<title>')
    expect(svg).toContain('<desc>')
    // Purity: no floating-point / undefined leakage into the document.
    expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    // Deterministic: same output → byte-identical SVG.
    expect(emit(out)).toBe(svg)
  })
})

describe('emit — cartesian marks match the series×category structure', () => {
  it('grouped bar draws one rect per non-zero (series,category) cell', () => {
    const out = interpretChart(def({ type: 'bar' }), barRows, CTX)
    const svg = emit(out)
    // 2 series × 3 categories, all non-zero → 6 bar rects.
    expect(count(svg, RECTS)).toBe(6)
    // value-axis gridlines == the nice-scale tick count for this domain.
    const ticks = niceScale(0, 35, 5).ticks.length
    expect(count(svg, GRIDLINE)).toBe(ticks)
    // multi-series → legend rendered (both series names present).
    expect(svg).toContain('Imereti')
    expect(svg).toContain('Kartli')
    // bar default: data labels ON when not stacked (uses point.formatted).
    expect(svg).toContain('data-layer="data-labels"')
  })

  it('stacked bar keeps the rects but suppresses data labels (mirrors showDataLabels)', () => {
    const out = interpretChart(def({ type: 'bar', stacked: true }), barRows, CTX)
    const svg = emit(out)
    expect(count(svg, RECTS)).toBe(6)
    expect(svg).not.toContain('data-layer="data-labels"')
  })

  it('line draws one polyline per series + a marker per point, no bars', () => {
    const out = interpretChart(def({ type: 'line' }), barRows, CTX)
    const svg = emit(out)
    expect(count(svg, POLYLINE)).toBe(2)          // 2 series
    expect(count(svg, CIRCLE)).toBe(6)            // 2 × 3 markers
    expect(count(svg, RECTS)).toBe(0)
  })

  it('area draws a filled polygon per series', () => {
    const out = interpretChart(def({ type: 'area' }), barRows, CTX)
    const svg = emit(out)
    expect(count(svg, POLYGON)).toBe(2)
  })

  it('combo mixes bar (rect) + line (polyline) marks', () => {
    const out = interpretChart(def({ type: 'combo' }), barRows, CTX)
    const svg = emit(out)
    expect(count(svg, RECTS)).toBeGreaterThan(0)
    expect(count(svg, POLYLINE)).toBeGreaterThan(0)
  })
})

describe('emit — per-point semantic colour survives to the SVG (Law 1)', () => {
  it('contribution paints each bar its row colour via thresholdColor', () => {
    const rows = [
      row('exp', 'Consumption', 100, { color: '#1b9e77' }),
      row('exp', 'Investment',   40, { color: '#005a9c' }),
      row('exp', 'Imports',     -30, { color: '#d81b60' }),
      row('exp', 'GDP',         110, { isTotal: true, color: '#E53E3E' }),
    ]
    const out = interpretChart(def({ type: 'contribution' }), rows, CTX)
    const svg = emit(out)
    // Every authored colour appears on a mark (per-point fillColor wins).
    expect(svg).toContain('fill="#1b9e77"')
    expect(svg).toContain('fill="#005a9c"')
    expect(svg).toContain('fill="#d81b60"')
  })
})

describe('emit — horizontal orientation maps category→left, value→bottom', () => {
  it('hbar emits rects + a category-axis layer', () => {
    const out = interpretChart(def({ type: 'hbar' }), barRows, CTX)
    const svg = emit(out)
    expect(count(svg, RECTS)).toBe(6)
    expect(svg).toContain('data-chart-type="hbar"')
    expect(svg).toContain('data-layer="category-axis"')
  })
})

describe('emit — gaps are EXPLICIT and enumerated, never silently wrong', () => {
  it.each(['pie', 'donut', 'treemap', 'hbar-diverging', 'map'])('%s renders a labelled gap placeholder', (type) => {
    // Build a minimal non-empty output for the type via a bar output, retyped.
    const base = interpretChart(def({ type: 'bar' }), barRows, CTX)
    const out = { ...base, type }
    const svg = emit(out)
    expect(isEmittable(type)).toBe(false)
    expect(svg).toContain(`data-chart-gap="${type}"`)
    expect(svg).toContain('not exported')
  })

  it('every REGISTERED chart type is either emittable or an enumerated gap (no silent divergence)', () => {
    for (const type of chartRegistry.chartTypes()) {
      const known = isEmittable(type) || type in EMIT_GAPS
      expect(known, `chart type '${type}' is neither emittable nor an enumerated gap`).toBe(true)
    }
  })

  it('EMITTABLE_TYPES and EMIT_GAPS do not overlap', () => {
    for (const t of EMITTABLE_TYPES) expect(t in EMIT_GAPS).toBe(false)
  })
})

describe('emit — empty output degrades to an explicit empty state', () => {
  it('no series → a "No data" placeholder, still valid SVG', () => {
    const out = interpretChart(def({ type: 'bar' }), [], CTX)
    const svg = emit(out)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('No data')
  })
})

describe('niceScale — Grammar-of-Graphics value scale primitive', () => {
  it('spans the data, monotonic ascending, includes a zero baseline', () => {
    const { ticks, niceMin, niceMax } = niceScale(0, 35, 5)
    expect(niceMin).toBeLessThanOrEqual(0)
    expect(niceMax).toBeGreaterThanOrEqual(35)
    expect(ticks[0]).toBe(niceMin)
    expect(ticks[ticks.length - 1]).toBe(niceMax)
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!)
  })

  it('honours an authored min/max exactly (deliberate bounds are not rounded away)', () => {
    const { niceMin, niceMax } = niceScale(3, 97, 5, 0, 100)
    expect(niceMin).toBe(0)
    expect(niceMax).toBe(100)
  })

  it('never collapses on a degenerate (all-equal) domain', () => {
    const { ticks } = niceScale(5, 5, 5)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
  })
})
