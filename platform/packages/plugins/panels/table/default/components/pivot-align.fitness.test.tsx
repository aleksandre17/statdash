// @vitest-environment jsdom
//
// ── FF-PIVOT-HEADER-ALIGN — a pivot column's HEADER sits above its DIGITS ──────
//
//  THE owner-reported defect, encoded as a red test. On /ka/accounts the SNA
//  "National Accounts" table is a PivotTable (series R/U present) with a single
//  `value` column and NO explicit `align`. The header hardcoded `r` (right) while
//  the body keyed on `col.align` — so with align UNSET the header rendered
//  RIGHT-aligned and the data LEFT-aligned: the "რესურსები"/"გამოყენება" labels
//  sat right of their numbers.
//
//  Root cause → standard → fix:
//    · root cause : header and body derived alignment from DIFFERENT sources.
//    · standard   : a column's alignment is ONE decision (SSOT) applied identically
//                   to its header and its body cells; pivot value cells are numeric
//                   → right-aligned by default (IMF/Eurostat), `align:'l'` opts out.
//    · fix        : `alignClass(col)` in PivotTable, used by header th AND body td.
//
//  This is a rendered-DOM (classList) assertion — jsdom has no layout engine, but
//  it has the DOM, and alignment here IS a class truth (`.r` ⇒ text-align:right).
//  We assert PARITY: for every data column, header th class === body td alignment.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                 from '@testing-library/react'
import type { DataRow, ColumnDef }         from '@statdash/engine'
import { PivotTable }                      from './PivotTable'

afterEach(cleanup)

const hasR = (el: Element | null | undefined) =>
  !!el && el.classList.contains('r')

// SNA-shaped rows: two series (Resources / Uses), one numeric `value` column,
// NO `align` on the column — the exact live config that regressed.
const snaRows: DataRow[] = [
  { id: 'p1-R', label: 'P1 Output',      series: 'რესურსები', value: 178837 },
  { id: 'p1-U', label: 'P1 Output',      series: 'გამოყენება', value: 74239  },
  { id: 'b1-R', label: 'B1G Value added', series: 'რესურსები', value: 60123  },
  { id: 'b1-U', label: 'B1G Value added', series: 'გამოყენება', value: 40100  },
] as unknown as DataRow[]

const snaCols: ColumnDef[] = [{ key: 'value', label: 'GEL mn', format: 'mln_gel' }]

describe('FF-PIVOT-HEADER-ALIGN — single-column pivot header aligns to its digits', () => {
  it('numeric column (no explicit align) is RIGHT-aligned in BOTH header and body', () => {
    const { container } = render(
      <PivotTable rows={snaRows} colLabel="Account" columns={snaCols} />,
    )
    // Flat header: [row-label th, series₁ th, series₂ th]
    const headTh = Array.from(container.querySelectorAll('thead th'))
    expect(headTh.length).toBe(1 + 2) // colLabel + 2 series
    const seriesHeaders = headTh.slice(1)
    // Every series header is right-aligned (numeric default)…
    seriesHeaders.forEach((th) => expect(hasR(th)).toBe(true))

    // …and its body cells match (SSOT parity — the actual bug was a MISMATCH).
    const bodyCells = Array.from(container.querySelectorAll('tbody td'))
    expect(bodyCells.length).toBeGreaterThan(0)
    bodyCells.forEach((td) => {
      expect(td.classList.contains('t-num')).toBe(true)
      expect(hasR(td)).toBe(true) // same alignment as the header above it
    })
  })

  it('align:"l" opts a column back to LEFT for header AND body, in lockstep', () => {
    const leftCols: ColumnDef[] = [{ key: 'value', label: 'GEL mn', align: 'l' }]
    const { container } = render(
      <PivotTable rows={snaRows} colLabel="Account" columns={leftCols} />,
    )
    const seriesHeaders = Array.from(container.querySelectorAll('thead th')).slice(1)
    seriesHeaders.forEach((th) => expect(hasR(th)).toBe(false))
    Array.from(container.querySelectorAll('tbody td')).forEach((td) =>
      expect(hasR(td)).toBe(false),
    )
  })

  it('multi-column pivot: each sub-header shares its body column alignment', () => {
    const multiRows: DataRow[] = [
      { id: 'a-R', label: 'A', series: 'რესურსები', value: 10, pct: 1 },
      { id: 'a-U', label: 'A', series: 'გამოყენება', value: 20, pct: 2 },
    ] as unknown as DataRow[]
    const multiCols: ColumnDef[] = [
      { key: 'value', label: 'Val' },            // default → right
      { key: 'pct',   label: 'Share', align: 'l' }, // opted left
    ]
    const { container } = render(
      <PivotTable rows={multiRows} colLabel="X" columns={multiCols} />,
    )
    const subHeaders = Array.from(container.querySelectorAll('thead tr:nth-child(2) th'))
    // series₁[val,pct] series₂[val,pct] → val right, pct left, repeated
    expect(hasR(subHeaders[0])).toBe(true)  // value
    expect(hasR(subHeaders[1])).toBe(false) // pct (align:l)
    // Body row cells follow the same pattern.
    const firstRowCells = Array.from(
      container.querySelectorAll('tbody tr:first-child td'),
    )
    expect(hasR(firstRowCells[0])).toBe(true)  // value
    expect(hasR(firstRowCells[1])).toBe(false) // pct
  })
})
