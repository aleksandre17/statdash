// ── GetGrainEditor — the read-level grain «წაკითხვის არე» gesture (card 0087 §3.2) ──
//
//  Pins the governed head's `where` coordinate through the OFFERED surface (pick the dim,
//  pick the member — never type). Grain-∅ browse is the default (disclosure starts closed).
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GetGrainEditor } from './GetGrainEditor'
import type { StepInputOffer } from '../pipeline-preview/stepInput'

const offer: StepInputOffer = {
  columns: [
    { field: 'year', label: 'წელი', numeric: true },
    { field: 'geo', label: 'გეოგრაფია', numeric: false },
  ],
  isNumeric: (f) => f === 'year',
  valuesFor: (f) =>
    f === 'year'
      ? [{ value: 2020, label: '2020' }, { value: 2021, label: '2021' }]
      : [{ value: 'GE', label: 'საქართველო' }],
  sampleRows: [],
}

describe('GetGrainEditor — pin a coordinate, OFFERED (never typed)', () => {
  it('starts collapsed — grain-∅ browse is the default (ADR-046 Addendum 2)', () => {
    render(<GetGrainEditor where={{}} onChange={vi.fn()} input={offer} locale="ka" />)
    expect((screen.getByTestId('get-grain-toggle') as HTMLElement).getAttribute('aria-expanded')).toBe('false')
  })

  it('hides entirely when there is no offer (nothing to pick — honest empty)', () => {
    const { container } = render(<GetGrainEditor where={{}} onChange={vi.fn()} locale="ka" />)
    expect(container.firstChild).toBeNull()
  })

  it('pinning a dimension to a member emits the `where` coordinate', () => {
    const onChange = vi.fn()
    render(<GetGrainEditor where={{}} onChange={onChange} input={offer} locale="ka" />)
    fireEvent.click(screen.getByTestId('get-grain-toggle'))
    fireEvent.click(screen.getByRole('button', { name: /პინის დამატება/ }))
    // Drive the MUI Select: open it, click the governed option (the portal gesture).
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'წელი' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '2020' }))
    expect(onChange).toHaveBeenLastCalledWith({ year: 2020 })
  })

  it('a stored pin renders as a count badge on the disclosure', () => {
    render(<GetGrainEditor where={{ year: 2020 }} onChange={vi.fn()} input={offer} locale="ka" />)
    expect(screen.getByTestId('get-grain-toggle').textContent).toContain('1')
  })

  it('removing the last pin clears the grain back to browse', () => {
    const onChange = vi.fn()
    render(<GetGrainEditor where={{ year: 2020 }} onChange={onChange} input={offer} locale="ka" />)
    fireEvent.click(screen.getByTestId('get-grain-toggle'))
    fireEvent.click(screen.getByRole('button', { name: /პინის წაშლა/ }))
    expect(onChange).toHaveBeenLastCalledWith({})
  })
})
