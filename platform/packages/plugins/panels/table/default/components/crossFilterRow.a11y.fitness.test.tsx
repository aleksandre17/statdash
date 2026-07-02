// @vitest-environment jsdom
//
// ── FF-XF-A11Y — cross-filter table row-select is keyboard-accessible ───────
//
//  A table row becomes a SELECTION control only when the node opts in (the shell
//  passes onRowSelect from a declared on[]). When it does, WCAG 2.1 AA demands the
//  affordance be keyboard-operable and its state exposed:
//    · focusable        — tabIndex 0
//    · activatable       — role button, Enter/Space fire the selection
//    · state             — aria-pressed reflects the current selection
//  When the node does NOT opt in, the table renders EXACTLY as before — no
//  tabindex, no role, no click affordance (no regression for read-only tables).
//

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent }          from '@testing-library/react'
import type { DataRow, ColumnDef }             from '@statdash/engine'
import { SimpleTable }                         from './SimpleTable'

afterEach(cleanup)

const ROWS: DataRow[] = [
  { id: 'R2', label: 'Region Two', value: 300 },
  { id: 'R3', label: 'Region Three', value: 200 },
]
const COLS: ColumnDef[] = [{ key: 'value', label: 'Value' }]

function base(extra: Record<string, unknown> = {}) {
  return render(
    <SimpleTable rows={ROWS} colLabel="Region" columns={COLS} indent={false} statusFlags={false} {...extra} />,
  )
}

describe('FF-XF-A11Y — opted-in row select', () => {
  it('data rows are focusable, role=button, and expose aria-pressed selection state', () => {
    const { container } = base({ onRowSelect: () => {}, selectedIds: ['R2'] })
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(2)
    for (const tr of rows) {
      expect(tr.getAttribute('tabindex')).toBe('0')
      expect(tr.getAttribute('role')).toBe('button')
    }
    // Selected row R2 → aria-pressed true; R3 → false.
    expect(rows[0].getAttribute('aria-pressed')).toBe('true')
    expect(rows[1].getAttribute('aria-pressed')).toBe('false')
  })

  it('Enter and Space activate the selection (keyboard-operable)', () => {
    const onRowSelect = vi.fn()
    const { container } = base({ onRowSelect })
    const firstRow = container.querySelector('tbody tr')!
    fireEvent.keyDown(firstRow, { key: 'Enter' })
    fireEvent.keyDown(firstRow, { key: ' ' })
    fireEvent.click(firstRow)
    expect(onRowSelect).toHaveBeenCalledTimes(3)
    expect(onRowSelect).toHaveBeenCalledWith(ROWS[0])
  })
})

describe('FF-XF-A11Y — read-only table (no on[]) has no interactive affordance', () => {
  it('renders no tabindex / role / aria-pressed when onRowSelect is absent', () => {
    const { container } = base()
    for (const tr of container.querySelectorAll('tbody tr')) {
      expect(tr.getAttribute('tabindex')).toBeNull()
      expect(tr.getAttribute('role')).toBeNull()
      expect(tr.getAttribute('aria-pressed')).toBeNull()
    }
  })
})
