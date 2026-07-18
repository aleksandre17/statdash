// ── FilterStepForm — the draft-over-canonical regression net ──────────────────
//
//  Owner-caught (2026-07-18): "add condition" did NOTHING — the stateless form
//  derived rows from step.where while toStep dropped empty fields, so the new
//  empty row was projected away before it could render. The form now keeps a
//  local DRAFT (in-progress rows live in the UI; the canonical step only carries
//  complete conditions). These tests pin that contract.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterStepForm } from './FilterStepForm'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import type { TransformStep } from '@statdash/engine'

type FilterStep = Extract<TransformStep, { op: 'filter' }>
const empty: FilterStep = { op: 'filter', where: {} }

// A hand-built OFFER (the workbench derives this from the step's input rows): the
// governed columns + a column's distinct member values, governed-labeled.
const offer: StepInputOffer = {
  columns: [
    { field: 'geo',   label: 'გეოგრაფია', numeric: false },
    { field: 'value', label: 'შრომის ანაზღაურება', numeric: true },
  ],
  isNumeric: (f) => f === 'value',
  valuesFor: (f) =>
    f === 'geo'
      ? [{ value: 'GE', label: 'საქართველო' }, { value: 'AB', label: 'აფხაზეთი' }]
      : [],
  sampleRows: [],
}

describe('FilterStepForm — add condition renders a row (the owner-caught no-op)', () => {
  it('clicking "add condition" shows an editable empty row immediately', () => {
    render(<FilterStepForm step={empty} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /პირობის დამატება/ }))
    expect(screen.getByLabelText('სვეტი')).toBeTruthy()
  })

  it('the canonical step stays free of empty conditions while the draft row is in progress', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={empty} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /პირობის დამატება/ }))
    // an empty row must never pollute config (Law 2: config carries data, not UI state)
    expect(onChange).toHaveBeenCalledWith({ op: 'filter', where: {} })
  })

  it('completing the row emits the condition into where', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={empty} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /პირობის დამატება/ }))
    fireEvent.change(screen.getByLabelText('სვეტი'), { target: { value: 'geo' } })
    fireEvent.change(screen.getByLabelText(/მნიშვნელობა/), { target: { value: 'GE' } })
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: 'GE' } })
  })

  it('an external step replacement reseeds the draft (as-of switch / undo)', () => {
    const { rerender } = render(<FilterStepForm step={empty} onChange={vi.fn()} />)
    rerender(<FilterStepForm step={{ op: 'filter', where: { sector: '_T' } }} onChange={vi.fn()} />)
    expect((screen.getByLabelText('სვეტი') as HTMLInputElement).value).toBe('sector')
  })
})

describe('FilterStepForm — OFFER-driven (P-OFFER): pick, never type', () => {
  it('an offered column shows GOVERNED value checkboxes, not a free-text box', () => {
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={vi.fn()} input={offer} />)
    // The column resolved to its GOVERNED label (never the raw key `geo`).
    expect(screen.getByText('გეოგრაფია')).toBeTruthy()
    // The value is an Excel AutoFilter checkbox list of governed member labels …
    expect(screen.getByRole('checkbox', { name: 'საქართველო' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'აფხაზეთი' })).toBeTruthy()
    // … and the pre-checked stored value is reflected.
    expect((screen.getByRole('checkbox', { name: 'საქართველო' }) as HTMLInputElement).checked).toBe(true)
    // … NOT the free-text value box.
    expect(screen.queryByLabelText(/მნიშვნელობა/)).toBeNull()
  })

  it('picking members emits a SCALAR (one) then an IN-array (many) — engine where semantics', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={onChange} input={offer} />)
    // check a second member → IN-array
    fireEvent.click(screen.getByRole('checkbox', { name: 'აფხაზეთი' }))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: ['GE', 'AB'] } })
    // uncheck the first → back to a scalar
    fireEvent.click(screen.getByRole('checkbox', { name: 'საქართველო' }))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: 'AB' } })
  })

  it('unchecking every member drops the condition (Excel: nothing chosen ⇒ no filter)', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={onChange} input={offer} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'საქართველო' }))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: {} })
  })

  it('FALLBACK: no offer → free-text column + value (never a dead control, Law 11)', () => {
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={vi.fn()} />)
    expect((screen.getByLabelText('სვეტი') as HTMLInputElement).value).toBe('geo')
    expect(screen.getByLabelText(/მნიშვნელობა/)).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

// ── FF-FILTER-PARITY (gesture half) — the three OFFERED modes emit the engine shapes ──
//  Each old-editor filtering capability ($ctx follow · $ne except · $ne+$ctx combined) is
//  authorable through the workbench filter form (pick, never type). The core half proves
//  those shapes RESOLVE byte-identically to the store predicate (filter-parity.fitness).
describe('FilterStepForm — FULL PARITY modes (card 0087 §3)', () => {
  it('«მიჰყევი გვერდის არჩევანს» (follow) emits {$ctx: <dim>} — the field=parameter class', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={onChange} input={offer} />)
    fireEvent.click(screen.getByTestId('filter-mode-follow'))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: { $ctx: 'geo' } } })
    // a stored $ctx renders as its MODE, not free text (no more fallback for refs)
    expect(screen.getByTestId('filter-follow-note')).toBeTruthy()
    expect(screen.queryByLabelText(/მნიშვნელობა/)).toBeNull()
  })

  it('a stored {$ctx} value seeds FOLLOW mode (renders as the mode, never raw JSON)', () => {
    render(
      <FilterStepForm
        step={{ op: 'filter', where: { geo: { $ctx: 'geo' } } } as FilterStep}
        onChange={vi.fn()}
        input={offer}
      />,
    )
    expect(screen.getByTestId('filter-follow-note')).toBeTruthy()
    expect(screen.queryByLabelText(/მნიშვნელობა/)).toBeNull()
  })

  it('«ყველა, გარდა…» (except) emits {$ne: v} — keep everything except one member', () => {
    const onChange = vi.fn()
    render(<FilterStepForm step={{ op: 'filter', where: { geo: 'GE' } }} onChange={onChange} input={offer} />)
    fireEvent.click(screen.getByTestId('filter-mode-except'))
    // single-select exclusion list: check the member to exclude
    fireEvent.click(screen.getByRole('checkbox', { name: 'აფხაზეთი' }))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: { $ne: 'AB' } } })
  })

  it('except + "also follow page selection" emits {$ne, $ctx} — NeCtxRef (combined)', () => {
    const onChange = vi.fn()
    render(
      <FilterStepForm
        step={{ op: 'filter', where: { geo: { $ne: 'AB' } } } as FilterStep}
        onChange={onChange}
        input={offer}
      />,
    )
    fireEvent.click(screen.getByTestId('filter-except-follow'))
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: { geo: { $ne: 'AB', $ctx: 'geo' } } })
  })

  it('a stored NeCtxRef seeds except mode with follow checked', () => {
    render(
      <FilterStepForm
        step={{ op: 'filter', where: { geo: { $ne: 'AB', $ctx: 'geo' } } } as FilterStep}
        onChange={vi.fn()}
        input={offer}
      />,
    )
    expect((screen.getByTestId('filter-except-follow').querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('switching back to specific from a ref mode clears to an empty pick', () => {
    const onChange = vi.fn()
    render(
      <FilterStepForm
        step={{ op: 'filter', where: { geo: { $ctx: 'geo' } } } as FilterStep}
        onChange={onChange}
        input={offer}
      />,
    )
    fireEvent.click(screen.getByTestId('filter-mode-specific'))
    // an empty specific pick is no condition (Excel: nothing chosen)
    expect(onChange).toHaveBeenLastCalledWith({ op: 'filter', where: {} })
  })
})
