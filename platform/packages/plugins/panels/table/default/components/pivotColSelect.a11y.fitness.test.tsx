// @vitest-environment jsdom
//
// ── FF-XF-PIVOT-A11Y — cross-filter on the pivot's SERIES/column axis ────────
//
//  Root of the owner's defect: once a region is selected the composition table
//  gains `series` (region) → DataTable routes to PivotTable, which previously had
//  NO row/series select support and DataTable never forwarded onRowSelect to it.
//  The table went inert — you could not add a 2nd/3rd region nor deselect.
//
//  This gate locks the fix: the PivotTable's SELECTABLE axis is the SERIES/column
//  (the region in the rotated State-B composition), NOT the sector row. A region
//  column header is a keyboard-operable selection control (WCAG 2.1 AA) whose
//  gesture emits a REPRESENTATIVE row of that series — the same datum shape the
//  shared `on[]` handler reads (`fromField:id`), so region multi-select works
//  identically whether the composition is a SimpleTable (State A) or a pivot
//  (State B). Absent onRowSelect ⇒ an inert header (no read-only regression).
//

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent }          from '@testing-library/react'
import type { DataRow, ColumnDef }             from '@statdash/engine'
import { PivotTable }                          from './PivotTable'

afterEach(cleanup)

// State-B composition shape: rows = sectors, series = regions (id carries the
// region code — enc.id='geo', so the pivot cell's id is the region identity).
const ROWS: DataRow[] = [
  { id: 'R2', label: 'Agriculture', series: 'Tbilisi', value: 10 },
  { id: 'R2', label: 'Industry',    series: 'Tbilisi', value: 20 },
  { id: 'R5', label: 'Agriculture', series: 'Imereti', value: 5 },
  { id: 'R5', label: 'Industry',    series: 'Imereti', value: 8 },
]
const ONE_COL:  ColumnDef[] = [{ key: 'value', label: 'GEL mn' }]
const TWO_COLS: ColumnDef[] = [{ key: 'value', label: 'GEL mn' }, { key: 'pct', label: 'Share' }]

function base(columns: ColumnDef[], extra: Record<string, unknown> = {}) {
  return render(
    <PivotTable rows={ROWS} colLabel="Sector" columns={columns} {...extra} />,
  )
}

describe('FF-XF-PIVOT-A11Y — opted-in series/column select', () => {
  for (const [name, cols] of [['flat pivot', ONE_COL], ['grouped pivot', TWO_COLS]] as const) {
    it(`${name}: region column headers are focusable, role=button, expose aria-pressed`, () => {
      const { container } = base(cols, { onRowSelect: () => {}, selectedIds: ['R2'] })
      const selectable = [...container.querySelectorAll('thead th[role="button"]')]
      // Exactly one selectable header per SERIES (region), never the sector rows.
      expect(selectable).toHaveLength(2)
      for (const th of selectable) expect(th.getAttribute('tabindex')).toBe('0')
      // Tbilisi (rep id R2) selected → aria-pressed true; Imereti (R5) → false.
      const tbilisi = selectable.find((th) => th.textContent === 'Tbilisi')!
      const imereti = selectable.find((th) => th.textContent === 'Imereti')!
      expect(tbilisi.getAttribute('aria-pressed')).toBe('true')
      expect(imereti.getAttribute('aria-pressed')).toBe('false')
    })

    it(`${name}: click + Enter + Space emit the series' representative row (region identity)`, () => {
      const onRowSelect = vi.fn()
      const { container } = base(cols, { onRowSelect })
      const tbilisi = [...container.querySelectorAll('thead th[role="button"]')]
        .find((th) => th.textContent === 'Tbilisi')!
      fireEvent.click(tbilisi)
      fireEvent.keyDown(tbilisi, { key: 'Enter' })
      fireEvent.keyDown(tbilisi, { key: ' ' })
      expect(onRowSelect).toHaveBeenCalledTimes(3)
      // The emitted datum carries the region code on `id` (what fromField:id reads).
      expect(onRowSelect.mock.calls[0][0].id).toBe('R2')
    })
  }
})

describe('FF-XF-PIVOT-A11Y — read-only pivot (no on[]) has no interactive affordance', () => {
  it('renders no role/tabindex/aria-pressed on any header when onRowSelect is absent', () => {
    const { container } = base(TWO_COLS)
    for (const th of container.querySelectorAll('thead th')) {
      expect(th.getAttribute('role')).toBeNull()
      expect(th.getAttribute('tabindex')).toBeNull()
      expect(th.getAttribute('aria-pressed')).toBeNull()
    }
  })
})
