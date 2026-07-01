// @vitest-environment node
//
// ── donutPalette.fitness — MONOCHROME-donut regression guard ──────────────────
//
//  The donut is a categorical chart (production-approach on GDP, sector on
//  Regional), yet a prior defect fell back to a single muted grey for every
//  slice (no palette applied) while the sibling treemap/bar showed full color —
//  the exact inconsistency the owner flagged. This pins that a plain donut (no
//  per-slice threshold color) distributes the categorical palette, so its slices
//  read as distinct hues and cannot regress to monochrome.
//
//  node env → chartPalette returns deterministic token fallbacks.

import { describe, it, expect } from 'vitest'
import type { ChartOutput } from '@statdash/charts'
import { build } from './donutGeometry'

function donutOutput(values: number[]): ChartOutput {
  return {
    type: 'donut',
    categories: values.map((_, i) => `cat-${i}`),
    series: [{
      name: 'GDP',
      color: '#6B7B8D',
      data: values.map(v => ({ value: v, formatted: String(v) })),
    }],
    axes: { x: {}, y: {} },
    stacked: false,
    horizontal: false,
    legend: { show: true },
    tooltip: { show: true },
    annotations: [],
  }
}

describe('donut — categorical palette', () => {
  it('distributes distinct hues across slices (no monochrome collapse)', () => {
    const { slices } = build(donutOutput([66877, 12841, 12135, 7323, 5420]), false)
    expect(slices).toHaveLength(5)
    const colors = slices.map(s => s.color)
    // Every slice a distinct hue — not one muted grey for all.
    expect(new Set(colors).size).toBe(5)
    expect(colors).not.toContain('#6B7B8D')
  })

  it('respects explicit per-slice semantic colors when the series supplies them', () => {
    const out: ChartOutput = {
      ...donutOutput([10, 20, 30]),
      series: [{
        name: 'status',
        color: '#6B7B8D',
        data: [
          { value: 10, formatted: '10', thresholdColor: '#1b7a43' },
          { value: 20, formatted: '20', thresholdColor: '#b3261e' },
          { value: 30, formatted: '30', thresholdColor: '#8a5a00' },
        ],
      }],
    }
    const { slices } = build(out, false)
    expect(slices.map(s => s.color)).toEqual(['#1b7a43', '#b3261e', '#8a5a00'])
  })
})
