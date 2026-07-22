import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModelSurface } from './ModelSurface'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../../store/constructor.store'
import type { NamedDataSpec } from '../../types/constructor'

// The Steward's Model surface (AR-49 M2.1 · DU6-IA-1) — the governed semantic model:
// the Data-Flow map (orientation) + the metric catalog (define). DU6-IA-1 RETIRED the
// raw modeler (DataModelingPanel) that used to squat below the catalog — its spec half
// moved to the Specs floor, its raw-source CRUD to the Sources floor. This surface no
// longer hosts the source browser / spec workbench (the owner's «ერთად შეტენილი» undone).

const SPEC: NamedDataSpec = {
  id: 'spec-1', name: 'GDP query',
  spec: { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } },
}

beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ dataSpecs: [SPEC], selection: null })
})

function renderSurface(locale: 'en' | 'ka') {
  return render(
    <MemoryRouter initialEntries={['/studio/data?dataFloor=model']}>
      <ModelSurface locale={locale} />
    </MemoryRouter>,
  )
}

describe('ModelSurface — the Steward\'s define workspace (governed model only, DU6-IA-1)', () => {
  it('renders the Steward context caption synchronously', () => {
    renderSurface('en')
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('moves focus into the opened workspace region on mount (WCAG 2.1 AA · 2.4.3)', () => {
    renderSurface('en')
    const region = screen.getByRole('group', { name: 'Data model workspace' })
    expect(region).toHaveFocus()
  })

  it('no longer hosts the retired raw modeler (no source browser / spec workbench squatting here)', () => {
    renderSurface('ka')
    // The old DataModelingPanel's source-browser header is gone from this surface.
    expect(screen.queryByText('მონაცემების წყაროები')).toBeNull()
    expect(screen.queryByTestId('modeling-workbench')).toBeNull()
  })
})
