// @vitest-environment jsdom
//
// ── theme-chrome.fitness — chart chrome must FLIP with the theme (F5) ─────────
//
//  ApexCharts draws axis / tick / grid / legend / tooltip chrome straight to SVG
//  in JS, a layer CSS `var()` cannot reach. Before this guard the chrome colours
//  were baked once for light and stayed dim on a dark surface (AUDIT F5). The
//  root fix: every chrome colour READS a CSS token (via cssVar) at build time, so
//  it resolves against the live [data-theme] cascade — and the chart is remounted
//  on a runtime theme flip (useThemeVersion) to re-run those reads.
//
//  This pins two invariants so a regression (a hardcoded hex creeping back, or a
//  builder dropping the token read) turns red:
//    1. AGNOSTIC — chrome colours are token-DERIVED: flip the token, the built
//       option changes. A hardcoded hex would be inert to this.
//    2. BOTH-MODES — the SAME chrome field differs between a light and a dark
//       token set (i.e. it genuinely themes, not just "reads a token that never
//       moves").
//

import { describe, it, expect, afterEach } from 'vitest'
import type { ChartOutput, AxisOutput } from '@statdash/charts'
import { BASE, isDarkTheme } from './base'
import { buildCartesian } from './cartesian'
import { buildContribution } from './contribution'

// A light and a dark value for each token the chart chrome reads. Concrete hexes
// (mirroring tokens.css light/dark) — the test only cares that light ≠ dark.
const LIGHT = {
  '--color-surface':        '#ffffff',
  '--color-text-secondary': '#4a5568',
  '--color-text-muted':     '#6b7b8d',
  '--color-chart-grid':     '#f0f5f3',
  '--color-chart-frame':    '#e0ebe8',
} as const
const DARK = {
  '--color-surface':        '#15151f',
  '--color-text-secondary': '#c9d1d9',
  '--color-text-muted':     '#9aa4b2',
  '--color-chart-grid':     '#22222e',
  '--color-chart-frame':    '#2c2c3a',
} as const

function applyTheme(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v)
}
afterEach(() => {
  for (const k of Object.keys(LIGHT)) document.documentElement.style.removeProperty(k)
})

function makeOutput(over: Partial<ChartOutput> = {}): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type: 'bar', categories: ['A', 'B', 'C'],
    series: [{ name: 'S', color: '#00A896', data: [
      { value: 40000, formatted: '40 000' },
      { value: 25000, formatted: '25 000' },
      { value: 18000, formatted: '18 000' },
    ] }],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: true }, tooltip: { show: true }, annotations: [],
    ...over,
  }
}

// Pull the first yaxis label colour out of a built cartesian option set.
function yLabelColor(horizontal: boolean): string {
  const opts = buildCartesian(makeOutput({ type: horizontal ? 'hbar' : 'bar', horizontal }))
  const yaxis = Array.isArray(opts.yaxis) ? opts.yaxis[0] : opts.yaxis
  return String(yaxis?.labels?.style?.colors ?? '')
}

describe('theme-chrome — foreColor is set + token-derived', () => {
  it('BASE.chart.foreColor is defined (never falls back to Apex built-in dark grey)', () => {
    applyTheme(LIGHT)
    expect(BASE.chart?.foreColor).toBeTruthy()
  })

  it('foreColor differs light vs dark (chrome ink flips with the theme)', () => {
    applyTheme(LIGHT); const light = BASE.chart?.foreColor
    applyTheme(DARK);  const dark  = BASE.chart?.foreColor
    expect(light).not.toBe(dark)
    expect(dark).toBe(DARK['--color-text-secondary'])
  })
})

describe('theme-chrome — grid + axis colours flip with the theme', () => {
  it('grid.borderColor differs light vs dark', () => {
    applyTheme(LIGHT); const light = BASE.grid?.borderColor
    applyTheme(DARK);  const dark  = BASE.grid?.borderColor
    expect(light).not.toBe(dark)
  })

  it('cartesian y-axis label colour differs light vs dark (vertical + horizontal)', () => {
    applyTheme(LIGHT); const lv = yLabelColor(false), lh = yLabelColor(true)
    applyTheme(DARK);  const dv = yLabelColor(false), dh = yLabelColor(true)
    expect(lv).not.toBe(dv)
    expect(lh).not.toBe(dh)
    expect(dv).toBe(DARK['--color-text-muted'])
  })

  it('contribution x-axis label colour differs light vs dark', () => {
    const color = () => {
      const opts = buildContribution(makeOutput({ type: 'contribution' }))
      return String(opts.xaxis && !Array.isArray(opts.xaxis) ? opts.xaxis.labels?.style?.colors ?? '' : '')
    }
    applyTheme(LIGHT); const light = color()
    applyTheme(DARK);  const dark  = color()
    expect(light).not.toBe(dark)
  })
})

describe('theme-chrome — tooltip skin tracks the surface luminance', () => {
  it('isDarkTheme() reads the resolved surface token (light → false, dark → true)', () => {
    applyTheme(LIGHT); expect(isDarkTheme()).toBe(false)
    applyTheme(DARK);  expect(isDarkTheme()).toBe(true)
  })

  it('BASE.tooltip.theme flips light|dark with the surface', () => {
    applyTheme(LIGHT); expect(BASE.tooltip?.theme).toBe('light')
    applyTheme(DARK);  expect(BASE.tooltip?.theme).toBe('dark')
  })
})
