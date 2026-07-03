// ── Treemap contribution-role markers (income decomposition, img_15) ─────────
//
//  A treemap that carries a total row (isTotal) is an additive DECOMPOSITION:
//  total = Σ components. The interpreter tags each category with its role glyph —
//  `(=)` on the total, `(-)` on a negative (subtract) component, `(+)` on an
//  additive one — the same prefix convention ContributionInterpreter uses. The
//  adapter parses this into a per-tile corner marker. Driven purely by the row's
//  role (isTotal + value sign), NEVER by a hardcoded measure/tile identity (Law 1).
//  A FLAT categorical treemap (no total) keeps plain labels — no spurious markers.
//

import { describe, it, expect } from 'vitest'
import type { DataRow, SectionContext } from '@statdash/engine'
import { interpretChart } from '../interpret'
import '../interpreters'   // side-effect: registers the built-in interpreters
import type { ChartDef } from '../types'

const CTX = {} as SectionContext
const def = (over: Partial<ChartDef> = {}): ChartDef =>
  ({ type: 'treemap', label: 'Income', ...over })

function row(label: string, value: number, opts: Partial<DataRow> = {}): DataRow {
  return { id: label, label, value, ...opts } as DataRow
}

describe('treemap contribution-role markers', () => {
  it('tags the total (=) and additive components (+) when a total row is present', () => {
    // GDP by income approach: GDP = operating surplus + compensation + mixed income + net taxes.
    const rows = [
      row('GDP at market prices', 80, { isTotal: true }),
      row('Gross operating surplus', 30),
      row('Compensation of employees', 28),
      row('Gross mixed income', 12),
      row('Net taxes on production', 10),
    ]
    const out = interpretChart(def(), rows, CTX)

    // total anchors first (squarify), then components by value desc.
    expect(out.categories[0]).toBe('(=) GDP at market prices')
    expect(out.categories.slice(1)).toEqual([
      '(+) Gross operating surplus',
      '(+) Compensation of employees',
      '(+) Gross mixed income',
      '(+) Net taxes on production',
    ])
  })

  it('tags a negative (subtract) component with (-) — role from value sign, agnostic', () => {
    const rows = [
      row('GDP', 100, { isTotal: true }),
      row('Consumption', 70),
      row('Imports', -20),
    ]
    const out = interpretChart(def(), rows, CTX)
    expect(out.categories).toContain('(=) GDP')
    expect(out.categories).toContain('(+) Consumption')
    expect(out.categories).toContain('(-) Imports')
  })

  it('leaves a flat categorical treemap (no total) unmarked — no spurious glyphs', () => {
    const rows = [row('Agriculture', 10), row('Industry', 20), row('Services', 30)]
    const out = interpretChart(def(), rows, CTX)
    for (const c of out.categories) expect(c).not.toMatch(/^\([=+-]\) /)
    expect(out.categories).toEqual(['Agriculture', 'Industry', 'Services'])
  })
})
