// ── FF-NO-CRAMMED-DOCK (filters · live) — the FIRST REAL page-scope escalation (SL-5) ─
//
//  Proves the reported cram — the whole filters pipeline stacked fully-expanded in the
//  page dock — is now unrepresentable, escalated OUT to a focus-view through the SAME
//  DIP port SL-4 built (self-bound variant):
//    • WITH an escalation host + a POPULATED pipeline → the dock shows only a compact
//      AFFORDANCE (the body is NOT stacked in the dock); clicking it fires `escalate`
//      with a SELF-BOUND request whose `render()` mounts the full authoring body;
//    • the escalated body is LIVE — mounted straight from the store (no captured value),
//      so it edits real config in the focus-view;
//    • FAIL-SOFT — with NO host the drawer renders its body inline exactly as before
//      (zero regression), and an EMPTY pipeline never escalates (a light in-dock stub).
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FilterSchemaInput } from '@statdash/engine'
import { useConstructorStore } from '../../store/constructor.store'
import { FiltersDrawer } from './FiltersDrawer'
import { FocusEscalationContext, type FocusEscalation, type FocusEscalationRequest } from '../../inspector/focusEscalation'
import type { CanvasPage, PageMeta } from '../../types/constructor'

function seed(filterSchema?: FilterSchemaInput) {
  const page: CanvasPage = {
    id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg',
    nodeIds: [], nodes: {}, meta: (filterSchema ? { filterSchema } : {}) as PageMeta,
  }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1', selection: null })
}

const ONE_BAR: FilterSchemaInput = {
  bars: { bar1: { position: 'sticky', filters: { region: { type: 'hidden', default: '' } } } },
} as unknown as FilterSchemaInput

function withHost(host: FocusEscalation | null, ui: React.ReactNode) {
  return <FocusEscalationContext.Provider value={host}>{ui}</FocusEscalationContext.Provider>
}

beforeEach(() => {
  useConstructorStore.setState({ pages: [], activePageId: null, selection: null })
})

describe('FF-NO-CRAMMED-DOCK (filters) — a populated pipeline ESCALATES, never stacks in-dock', () => {
  it('with a host, the dock shows a compact affordance — NOT the expanded body', () => {
    seed(ONE_BAR)
    render(withHost({ escalate: vi.fn() }, <FiltersDrawer locale="en" />))
    // The compact affordance is present…
    expect(screen.getByTestId('filters-affordance')).toBeInTheDocument()
    // …and the full authoring body is NOT stacked in the dock.
    expect(screen.queryByTestId('filters-drawer')).toBeNull()
  })

  it('clicking the affordance fires a SELF-BOUND escalate whose render() mounts the live body', () => {
    seed(ONE_BAR)
    let captured: FocusEscalationRequest | undefined
    render(withHost({ escalate: (r) => { captured = r } }, <FiltersDrawer locale="en" />))

    fireEvent.click(screen.getByRole('button', { name: 'Configure Filters' }))

    expect(captured).toBeDefined()
    const req = captured!
    expect(req.source).toBe('self-bound')
    expect(req.title.en).toBe('Filters')
    // The escalated body renders the FULL authoring surface, live from the store.
    if (req.source !== 'self-bound') throw new Error('expected self-bound escalation')
    render(req.render())
    expect(screen.getByTestId('filters-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('filter-bar-bar1')).toBeInTheDocument()
  })
})

describe('FF-NO-CRAMMED-DOCK (filters) — fail-soft (no regression)', () => {
  it('with NO host, the drawer renders its body inline exactly as before', () => {
    seed(ONE_BAR)
    render(withHost(null, <FiltersDrawer locale="en" />))
    expect(screen.getByTestId('filters-drawer')).toBeInTheDocument()
    expect(screen.queryByTestId('filters-affordance')).toBeNull()
  })

  it('an EMPTY pipeline never escalates — a light in-dock stub even with a host', () => {
    seed(undefined) // no filterSchema at all
    render(withHost({ escalate: vi.fn() }, <FiltersDrawer locale="en" />))
    expect(screen.queryByTestId('filters-affordance')).toBeNull()
    // The body's "no bars yet" stub renders inline (no focus-view for nothing-to-author).
    expect(screen.queryByTestId('filters-drawer')).toBeNull()
  })
})
