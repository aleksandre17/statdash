// ── ByModeEditor — recursive per-ModeId sub-DataSpec authoring + round-trip [V2]
//
//  Proves the ADR V2 recursion mechanism: a `by-mode` DataSpec branches per
//  ModeId, and each branch's nested DataSpec is authored by REUSING the SAME
//  DataSpecEditor one level down (a DataSpec inside a DataSpec — the VisibilityBuilder
//  recursion shape). Adding / editing / removing a branch round-trips losslessly.
//
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { modeRegistry } from '@statdash/engine'
import type { DataSpec } from '@statdash/engine'
import { ByModeEditor } from './ByModeEditor'

type ByModeSpec = Extract<DataSpec, { type: 'by-mode' }>

// The add-branch picker reads the live modeRegistry — register the built-in modes.
beforeAll(() => {
  modeRegistry.register({ id: 'year',  label: 'Year' })
  modeRegistry.register({ id: 'range', label: 'Range' })
})

/** Pick an option in a MUI Select (open, then click the option). */
function selectMuiOption(combobox: HTMLElement, optionName: string) {
  fireEvent.mouseDown(combobox)
  const listbox = within(screen.getByRole('listbox'))
  fireEvent.click(listbox.getByText(optionName))
}

describe('ByModeEditor — recursive per-ModeId DataSpec authoring (V2)', () => {
  it('adds a mode branch with a default nested spec (picked from the registry)', () => {
    const onChange = vi.fn<(next: ByModeSpec) => void>()
    const value: ByModeSpec = { type: 'by-mode', modes: {} }
    render(<ByModeEditor value={value} onChange={onChange} />)

    selectMuiOption(screen.getByLabelText('mode to add'), 'year')
    fireEvent.click(screen.getByRole('button', { name: /ტოტის დამატება/ }))

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(Object.keys(next.modes)).toEqual(['year'])
    // The fresh branch is the simplest authorable spec.
    expect(next.modes.year).toEqual({ type: 'row-list', rows: [] })
  })

  it('recursively authors a branch: the nested DataSpecEditor edits the sub-spec', () => {
    const onChange = vi.fn<(next: ByModeSpec) => void>()
    // year → a timeseries branch; editing the nested `code` must round-trip up.
    const value: ByModeSpec = {
      type: 'by-mode',
      modes: { year: { type: 'timeseries', code: 'GDP', years: 'all' } },
    }
    render(<ByModeEditor value={value} onChange={onChange} />)

    // The nested DataSpecEditor for the `year` branch renders a TimeseriesEditor
    // with a `code` text field — edit it; the parent by-mode spec must update.
    const codeInput = screen.getByLabelText(/კოდი|Code/i) as HTMLInputElement
    fireEvent.change(codeInput, { target: { value: 'EXP' } })

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next.type).toBe('by-mode')
    expect(next.modes.year).toMatchObject({ type: 'timeseries', code: 'EXP', years: 'all' })
  })

  it('removes a branch → emits modes without that key (lossless of the others)', () => {
    const onChange = vi.fn<(next: ByModeSpec) => void>()
    const value: ByModeSpec = {
      type: 'by-mode',
      modes: {
        year:  { type: 'row-list', rows: [{ code: 'GDP' }] },
        range: { type: 'timeseries', code: 'GDP', years: 'all' },
      },
    }
    render(<ByModeEditor value={value} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /ტოტის წაშლა: year/ }))

    const next = onChange.mock.calls.at(-1)![0]
    expect(Object.keys(next.modes)).toEqual(['range'])
    expect(next.modes.range).toEqual({ type: 'timeseries', code: 'GDP', years: 'all' })
  })
})
