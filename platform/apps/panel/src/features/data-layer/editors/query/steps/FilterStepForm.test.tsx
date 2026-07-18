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
import type { TransformStep } from '@statdash/engine'

type FilterStep = Extract<TransformStep, { op: 'filter' }>
const empty: FilterStep = { op: 'filter', where: {} }

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
