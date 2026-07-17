// ── VerbPalette component tests (W-P3 · ADR-046 · SPEC §3.1) ──────────────────────
//
//  The "+add step" surface: the trigger opens a 7-verb palette; picking a verb inserts
//  its default op via the passed `onAdd`; the `get` head is disabled (already the first
//  step). The verb GROUPING is the registry projection (tested in verbPalette.test.ts);
//  here we prove the wiring + accessibility affordances.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Side-effect: populate the op registry so the projection is non-empty.
import '@statdash/engine'
import { VerbPalette } from './VerbPalette'

describe('VerbPalette — the 7-verb "+add step" palette', () => {
  it('opens to reveal all 7 verb cards', () => {
    render(<VerbPalette onAdd={() => {}} />)
    fireEvent.click(screen.getByTestId('add-step-trigger'))
    for (const cat of ['get', 'filter', 'aggregate', 'derive', 'reshape', 'combine', 'sort']) {
      expect(screen.getByTestId(`verb-card-${cat}`)).toBeInTheDocument()
    }
  })

  it('picking a verb inserts its DEFAULT op via onAdd (Filter→filter, Derive→derive)', () => {
    const onAdd = vi.fn()
    render(<VerbPalette onAdd={onAdd} />)
    fireEvent.click(screen.getByTestId('add-step-trigger'))
    fireEvent.click(screen.getByTestId('verb-insert-filter'))
    expect(onAdd).toHaveBeenCalledWith('filter')

    fireEvent.click(screen.getByTestId('add-step-trigger'))
    fireEvent.click(screen.getByTestId('verb-insert-derive'))
    expect(onAdd).toHaveBeenCalledWith('derive')
  })

  it('the `get` head verb is disabled (the source is already the first step)', () => {
    render(<VerbPalette onAdd={() => {}} />)
    fireEvent.click(screen.getByTestId('add-step-trigger'))
    expect(screen.getByTestId('verb-insert-get')).toBeDisabled()
  })

  it('progressive disclosure: Aggregate reveals its concrete ops on expand', () => {
    const onAdd = vi.fn()
    render(<VerbPalette onAdd={onAdd} />)
    fireEvent.click(screen.getByTestId('add-step-trigger'))
    fireEvent.click(screen.getByTestId('verb-more-aggregate'))
    fireEvent.click(screen.getByTestId('verb-op-rollup'))
    expect(onAdd).toHaveBeenCalledWith('rollup')
  })
})
