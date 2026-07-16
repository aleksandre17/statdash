// ── Emit-path sequential-palette parity + rangeSlider passthrough ──────────
//
//  Two guarantees, both grounded in the REAL interpreters (interpretChart), never
//  hand-authored output:
//    1. A `palette: "sequential"` chart resolves the SAME blue ramp on the emit
//       (SSR/export SVG) path as the live ApexCharts realizer — the two-realizer
//       colour parity the live buildColors already holds (secondary portal task).
//    2. `ChartDef.rangeSlider` is a pure def→output passthrough (bar/area/combo);
//       absent ⇒ omitted so the neutral output stays byte-identical (Postel).
//

import { describe, it, expect } from 'vitest'
import type { DataRow, SectionContext } from '@statdash/engine'
import { interpretChart } from '../interpret'
import '../interpreters' // side-effect: register built-ins
import type { ChartDef } from '../types'
import { resolveSeriesColors, markColor, sequentialSample } from './palette'

const CTX = {} as SectionContext
const def = (over: Partial<ChartDef> = {}): ChartDef => ({ type: 'bar', label: 'GDP', ...over })
const row = (series: string, label: string, value: number): DataRow =>
  ({ id: `${series}:${label}`, label, value, series } as DataRow)

// 2 series × 3 categories, NO explicit colour → interpreter sets seriesColorByIndex.
const multiRows = [
  row('A', '2010', 10), row('A', '2011', 20), row('A', '2012', 30),
  row('B', '2010', 15), row('B', '2011', 25), row('B', '2012', 35),
]
// single series → plain (no by-index, no distributed).
const soloRows = [row('A', '2010', 10), row('A', '2011', 20), row('A', '2012', 30)]

// Charts-local light-mode fallbacks (mirror of the --chart-seq ramp).
const RAMP = ['#cfe8f5', '#a6d3ec', '#6fb7de', '#3f9bd0', '#0080be', '#005f8f', '#003f60']
const SEQ_ANCHOR = '#0080be' // --chart-seq-5

describe('emit palette — sequential parity with the live realizer', () => {
  it('by-index multi-series sequential → each series sampled across the blue ramp', () => {
    const out = interpretChart(def({ palette: 'sequential' }), multiRows, CTX)
    expect(out.seriesColorByIndex).toBe(true)
    expect(out.palette).toBe('sequential')
    // 2 series → the ramp's two ends (sampled), NOT the categorical scale.
    expect(resolveSeriesColors(out)).toEqual([RAMP[0], RAMP[6]])
  })

  it('plain single-series sequential → the ramp anchor (honest uniform accent blue)', () => {
    const out = interpretChart(def({ palette: 'sequential' }), soloRows, CTX)
    expect(out.distributed).toBeUndefined()
    expect(resolveSeriesColors(out)).toEqual([SEQ_ANCHOR])
  })

  it('distributed single-series sequential → each CATEGORY sampled across the ramp (mark site)', () => {
    const out = interpretChart(def({ palette: 'sequential', distributed: true }), soloRows, CTX)
    const colors = resolveSeriesColors(out)
    const sampled = sequentialSample(out.categories.length)
    out.categories.forEach((_, ci) => {
      expect(markColor(out, colors, 0, ci)).toBe(sampled[ci])
    })
  })

  it('categorical (no palette) is UNCHANGED — sequential branch is inert', () => {
    const out = interpretChart(def({}), multiRows, CTX)
    // categorical --chart-color-1 fallback, not the seq ramp
    expect(resolveSeriesColors(out)[0]).toBe('#005a9c')
    expect(resolveSeriesColors(out)[0]).not.toBe(RAMP[0])
  })
})

describe('interpretChart — rangeSlider passthrough (neutral intent)', () => {
  it.each(['bar', 'line', 'area', 'combo'] as const)('%s carries rangeSlider when declared', (type) => {
    const out = interpretChart(def({ type, rangeSlider: true }), multiRows, CTX)
    expect(out.rangeSlider).toBe(true)
  })

  it('omits rangeSlider when absent (byte-identical, Postel)', () => {
    const out = interpretChart(def({ type: 'bar' }), multiRows, CTX)
    expect('rangeSlider' in out).toBe(false)
  })
})
