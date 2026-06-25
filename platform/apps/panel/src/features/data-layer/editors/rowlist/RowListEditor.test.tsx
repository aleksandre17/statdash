// ── RowListEditor / RowSpecEditor — schema-driven row authoring + round-trip [V2]
//
//  Proves the ADR mechanism for a `row-list` DataSpec: each RowSpec is authored
//  through the SAME generic Inspector (its PropSchema carried in the engine
//  rowspec-schema registry), and the list add / edit / remove round-trips a
//  lossless RowSpec[] — no bespoke per-field form, no second form engine.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getRowSpecSchema } from '@statdash/engine'
import type { DataSpec, RowSpec } from '@statdash/engine'
import { RowListEditor } from './RowListEditor'
import { RowSpecEditor } from './RowSpecEditor'

type RowListSpec = Extract<DataSpec, { type: 'row-list' }>

describe('RowSpecEditor — schema-driven RowSpec authoring (V2)', () => {
  it('renders the RowSpec PropSchema through the generic Inspector', () => {
    expect(getRowSpecSchema()).toBeTruthy()
    const row: RowSpec = { code: 'GDP' }
    render(<RowSpecEditor uid="r0" row={row} onChange={() => {}} />)
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // The schema declares code/label/color/negate/isTotal/pctOf → deterministic ids.
    expect(document.getElementById('insp-code')).not.toBeNull()
    expect(document.getElementById('insp-color')).not.toBeNull()
    expect(document.getElementById('insp-pctOf')).not.toBeNull()
    expect(screen.queryByText(/No property schema/i)).toBeNull()
  })

  it('round-trips a scalar edit (color) preserving the rest of the RowSpec', () => {
    const onChange = vi.fn<(next: RowSpec) => void>()
    const row: RowSpec = { code: 'GDP', isTotal: true }
    render(<RowSpecEditor uid="r0" row={row} onChange={onChange} />)

    const color = document.getElementById('insp-color') as HTMLElement
    fireEvent.change(color, { target: { value: '#ff0000' } })

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({ code: 'GDP', isTotal: true, color: '#ff0000' })
  })
})

describe('RowListEditor — add / edit / remove a RowSpec[] (V2)', () => {
  it('adds a row → emits a new spec with one (empty-code) RowSpec', () => {
    const onChange = vi.fn<(next: RowListSpec) => void>()
    const value: RowListSpec = { type: 'row-list', rows: [] }
    render(<RowListEditor value={value} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /სტრიქონის დამატება/ }))

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next.type).toBe('row-list')
    expect(next.rows).toHaveLength(1)
    expect(next.rows[0]).toEqual({ code: '' })
  })

  it('edits a row via its nested Inspector → round-trips the list losslessly', () => {
    const onChange = vi.fn<(next: RowListSpec) => void>()
    const value: RowListSpec = {
      type: 'row-list',
      rows: [{ code: 'GDP', label: 'Gross' }, { code: 'EXP' }],
    }
    render(<RowListEditor value={value} onChange={onChange} />)

    // Two row cards → two `insp-color` controls; edit the FIRST row's color.
    const colorInputs = document.querySelectorAll('#insp-color')
    expect(colorInputs.length).toBe(2)
    fireEvent.change(colorInputs[0] as HTMLElement, { target: { value: '#123456' } })

    const next = onChange.mock.calls.at(-1)![0]
    expect(next.rows).toHaveLength(2)
    // First row gained the color; everything else is preserved (lossless).
    expect(next.rows[0]).toMatchObject({ code: 'GDP', label: 'Gross', color: '#123456' })
    expect(next.rows[1]).toEqual({ code: 'EXP' })
  })

  it('removes a row → emits the list without it', () => {
    const onChange = vi.fn<(next: RowListSpec) => void>()
    const value: RowListSpec = {
      type: 'row-list',
      rows: [{ code: 'GDP' }, { code: 'EXP' }],
    }
    render(<RowListEditor value={value} onChange={onChange} />)

    fireEvent.click(screen.getAllByRole('button', { name: /სტრიქონის წაშლა/ })[0])

    const next = onChange.mock.calls.at(-1)![0]
    expect(next.rows).toEqual([{ code: 'EXP' }])
  })
})
