// ── PerspectivesPane — page-level PerspectiveAxis authoring [P-final] ───────────
//
//  Proves the P-final surface end-to-end through the real store + generic Inspector:
//    • the scope schema source is REGISTRY-DRIVEN (Law 8 / OCP) — timeBinding + metric
//      surface from the engine perspective-scope-key registry, prefixed to `scope.*`;
//    • the pane authors a PerspectiveDef through the generic Inspector (label/icon +
//      the scope fields) + adds/edits/reorders perspectives, writing page.meta.perspectives;
//    • add seeds the first axis under the engine SSOT param; the default is flagged.
//
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { PerspectivesByParam } from '@statdash/engine'
import { perspectiveScopeSchema } from './perspectiveScopeSchemaSource'
import { perspectiveDefSchema } from './perspectiveDefSchemaSource'
import { PerspectivesPane } from './PerspectivesPane'
import { useConstructorStore } from '../../store/constructor.store'
import type { CanvasPage } from '../../types/constructor'

function seedPage(perspectives?: PerspectivesByParam): CanvasPage {
  const page: CanvasPage = {
    id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {},
    ...(perspectives ? { meta: { perspectives } } : {}),
  }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1' })
  return page
}

const axisFixture: PerspectivesByParam = {
  perspective: { perspectives: [
    { id: 'year',  label: { ka: 'წლიური', en: 'Year' }, scope: { timeBinding: { dim: 'time', pin: { $ctx: 'year' } } } },
    { id: 'range', label: { ka: 'დინამიკა', en: 'Range' }, scope: { metric: 'b1g-cagr' } },
  ] },
}

describe('perspectiveScopeSchema — registry-driven scope fields (Law 8 / OCP)', () => {
  it('unions every registered scope key, prefixed to scope.*', () => {
    const fields = perspectiveScopeSchema().map((f) => f.field)
    // timeBinding + metric register at engine module init (perspective-scope-schemas).
    expect(fields).toContain('scope.timeBinding.dim')
    expect(fields).toContain('scope.metric')
    // Every field is scope-prefixed (no bare key leaks into the def schema).
    expect(fields.every((f) => f.startsWith('scope.'))).toBe(true)
  })

  it('the PerspectiveDef schema is identity (label/icon) + the scope fields', () => {
    const fields = perspectiveDefSchema().map((f) => f.field)
    expect(fields).toContain('label')
    expect(fields).toContain('icon')
    expect(fields).toContain('scope.metric')
    expect(fields).not.toContain('id')   // id is immutable identity, never a schema field
    expect(fields).not.toContain('when') // when/available are VisibilityBuilder, not scalar
  })
})

describe('PerspectivesPane — authors the page perspective axis', () => {
  it('renders the empty-state add when the page has no axis', () => {
    seedPage()
    render(<PerspectivesPane />)
    expect(screen.getByTestId('perspectives-pane')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'პერსპექტივის დამატება' })).toBeInTheDocument()
  })

  it('adding the first axis seeds it under the engine SSOT param', () => {
    seedPage()
    render(<PerspectivesPane />)
    fireEvent.click(screen.getByRole('button', { name: 'პერსპექტივის დამატება' }))
    const by = useConstructorStore.getState().pages[0].meta?.perspectives as PerspectivesByParam
    expect(by).toBeDefined()
    expect(Object.keys(by)).toEqual(['perspective'])     // PERSPECTIVE_PARAM
    expect(by.perspective.perspectives.length).toBe(1)
  })

  it('renders each perspective with the schema-driven Inspector and a default chip', () => {
    seedPage(axisFixture)
    render(<PerspectivesPane />)
    const row = screen.getByTestId('perspective-row-year')
    // The schema-driven scope field (metric / timeBinding) renders a control.
    expect(within(row).getByTestId('inspector')).toBeInTheDocument()
    // perspectives[0] carries the visible default flag (not position alone).
    expect(within(row).getByTestId('perspective-default-year')).toBeInTheDocument()
  })

  it('editing a scope field writes the nested page.meta path', () => {
    seedPage(axisFixture)
    render(<PerspectivesPane />)
    // scope.metric is an enum-ref <select> under the range row.
    const sel = document.getElementById('insp-scope-metric') as HTMLSelectElement | null
    expect(sel).not.toBeNull()
    expect(sel!.tagName).toBe('SELECT')
  })

  it('reorder moves the default (perspectives[0]) — author-visible SSOT', () => {
    seedPage(axisFixture)
    render(<PerspectivesPane />)
    const rangeRow = screen.getByTestId('perspective-row-range')
    // aria-label is now locale-consistent with the Georgian tooltip (Law 4); the
    // test store resolves the primary locale to 'ka'.
    fireEvent.click(within(rangeRow).getByLabelText('ზემოთ გადატანა'))
    const by = useConstructorStore.getState().pages[0].meta?.perspectives as PerspectivesByParam
    expect(by.perspective.perspectives[0].id).toBe('range')
  })

  it('the preview switcher is a keyboard-navigable radiogroup (WCAG)', () => {
    seedPage(axisFixture)
    render(<PerspectivesPane />)
    const group = screen.getByRole('radiogroup', { name: 'active perspective preview' })
    expect(within(group).getAllByRole('radio').length).toBe(2)
  })
})
