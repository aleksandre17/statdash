import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataSurface } from './DataSurface'
import { useCanvasController } from '../useCanvasController'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../../store/constructor.store'
import type { NamedDataSpec } from '../../types/constructor'

// The Studio Data surface (AR-49 M2.1) — the author lens now shows ONLY the governed
// Metric Palette. The raw source/spec/query modeler has RELOCATED behind the Steward
// role (Model mode / ModelSurface); no query/pivot/cube editor is reachable from the
// author's Data surface anymore (FF-AUTHOR-NO-QUERY). Nothing is lost — the machinery
// moved audience, it was not deleted (proven by ModelSurface.test).

const SPEC: NamedDataSpec = {
  id: 'spec-1', name: 'GDP query',
  spec: { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } },
}

// Minimal harness — the real canvas controller (reads the store, no network).
function Harness() {
  const controller = useCanvasController()
  return <DataSurface controller={controller} locale="ka" />
}

beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ dataSpecs: [SPEC], selectedNodeId: null })
})

describe('DataSurface — governed Metric Palette only, no query editor (AR-49 M2.1)', () => {
  it('mounts the governed Metric Palette as the author\'s data affordance', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText('ძებნა…')).toBeInTheDocument()
  })

  it('no longer exposes the "Advanced" disclosure (relocated to Model mode)', () => {
    render(<Harness />)
    expect(screen.queryByText('დამატებითი მოდელირება')).not.toBeInTheDocument()
  })

  it('exposes NO raw source/spec/query modeling machinery on the author lens (FF-AUTHOR-NO-QUERY)', () => {
    render(<Harness />)
    // The DataModelingPanel's browser headings must be unreachable from here — even
    // the seeded spec name must not leak (the modeler is not mounted at all).
    expect(screen.queryByText('მონაცემების წყაროები')).not.toBeInTheDocument()
    expect(screen.queryByText('GDP query')).not.toBeInTheDocument()
  })
})
