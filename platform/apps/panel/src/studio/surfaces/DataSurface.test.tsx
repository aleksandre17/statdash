import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataSurface } from './DataSurface'
import { useCanvasController } from '../useCanvasController'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../../store/constructor.store'
import type { NamedDataSpec } from '../../types/constructor'

// The Studio Data surface — the governed Metric Palette is the primary affordance;
// the full raw modeling (the SAME DataModelingPanel the wizard uses) is demoted
// under the "Advanced" disclosure, lazy-loaded on open. Proves both: palette-first,
// and the full editor reachable (no capability lost — the anti-cliff contract).

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

describe('DataSurface — metric-first, editors demoted (AR-49 M1.3)', () => {
  it('mounts the governed Metric Palette as the primary affordance', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText('ძებნა…')).toBeInTheDocument()
  })

  it('keeps the full raw modeling collapsed under Advanced by default', () => {
    render(<Harness />)
    expect(screen.getByText('დამატებითი მოდელირება')).toBeInTheDocument()
    // Collapsed → the heavy panel is NOT mounted (chunk stays out of the shell).
    expect(screen.queryByText('მონაცემების წყაროები')).not.toBeInTheDocument()
  })

  it('discloses the full DataModelingPanel on demand (no capability lost)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('დამატებითი მოდელირება'))
    // The lazy panel mounts and reads the store (the seeded spec appears).
    expect(await screen.findByText('მონაცემების წყაროები')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
  })
})
