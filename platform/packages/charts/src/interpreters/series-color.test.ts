// ── seriesColorByIndex — interpreter decision (DEFECT#1 root) ─────────────────
//
//  The neutral ChartOutput cannot hold a themed `var(--chart-color-N)` (Law 1/4),
//  so the interpreter can't pick the concrete hue. Instead it DECIDES — as the
//  information expert that knows whether each series carried a semantic colour —
//  whether the render layer should paint series by categorical index. This locks
//  that decision so a multi-series comparison never silently collapses to one grey.
//

import { describe, it, expect } from 'vitest'
import type { DataRow, SectionContext } from '@statdash/engine'
import { interpretChart } from '../interpret'
import '../interpreters'   // side-effect: registers the built-in interpreters onto chartRegistry
import type { ChartDef } from '../types'

const CTX = {} as SectionContext
const def = (over: Partial<ChartDef> = {}): ChartDef =>
  ({ type: 'bar', label: 'GDP', ...over })

function row(series: string, label: string, value: number, color?: string): DataRow {
  return { id: `${series}:${label}`, label, value, series, ...(color ? { color } : {}) } as DataRow
}

describe('seriesColorByIndex', () => {
  it('SET when >1 series and NONE carries an explicit colour (the region comparison case)', () => {
    const rows = [
      row('Imereti', 'Agriculture', 10), row('Imereti', 'Industry', 20),
      row('Shida Kartli', 'Agriculture', 15), row('Shida Kartli', 'Industry', 25),
    ]
    const out = interpretChart(def(), rows, CTX)
    expect(out.series).toHaveLength(2)
    expect(out.seriesColorByIndex).toBe(true)
  })

  it('NOT set for a single series (one colour is already unambiguous)', () => {
    const rows = [row('GDP', 'A', 10), row('GDP', 'B', 20)]
    const out = interpretChart(def(), rows, CTX)
    expect(out.series).toHaveLength(1)
    expect(out.seriesColorByIndex).toBeUndefined()
  })

  it('NOT set when a series carries an explicit semantic colour (that meaning must win)', () => {
    const rows = [
      row('Up',   'A', 10, '#1b9e77'), row('Up',   'B', 20, '#1b9e77'),
      row('Down', 'A', -5, '#d81b60'), row('Down', 'B', -8, '#d81b60'),
    ]
    const out = interpretChart(def(), rows, CTX)
    expect(out.seriesColorByIndex).toBeUndefined()
  })
})
