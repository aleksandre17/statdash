import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelSurface } from './ModelSurface'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../../store/constructor.store'
import type { NamedDataSpec } from '../../types/constructor'

// The Steward's Model surface (AR-49 M2.1) — Model mode is now REAL: it mounts the
// relocated DataModelingPanel (the raw source/spec/query/pivot modeler) as the
// Steward's "define" workspace over the SAME live canvas. This proves the capability
// the author's Data surface gave up (M2.1) is fully present here — the Strangler
// relocation, not a deletion. The panel is lazy, so we await its mount.

const SPEC: NamedDataSpec = {
  id: 'spec-1', name: 'GDP query',
  spec: { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } },
}

beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ dataSpecs: [SPEC], selectedNodeId: null })
})

describe('ModelSurface — the Steward\'s define workspace mounts the relocated modeler (AR-49 M2.1)', () => {
  it('renders the Steward context caption synchronously (before the heavy chunk resolves)', () => {
    render(<ModelSurface locale="en" />)
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('mounts the full DataModelingPanel (the relocated raw modeler — no capability lost)', async () => {
    render(<ModelSurface locale="ka" />)
    // The lazy modeler resolves and reads the store — its source browser + the seeded
    // spec appear, proving the machinery is fully functional in Model mode.
    // Generous timeout: Model mode's eager graph grew (M2.2 MetricCatalogManager),
    // so the FIRST dynamic import of the modeler subsystem transforms more up front.
    expect(await screen.findByText('მონაცემების წყაროები', {}, { timeout: 20000 })).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
  })
})
