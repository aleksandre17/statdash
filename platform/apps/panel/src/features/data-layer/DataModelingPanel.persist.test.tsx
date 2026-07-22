// ── DataModelingPanel.persist.test — the edit-persistence WIRING (data-loss fix) ──
//
//  Proves the Model-floor workbench's onChange funnels through the ONE `updateDataSpec`
//  (the draft path, C3) for BOTH shapes that share the ONE DataWorkbench (ADR-051 DU3):
//  a pipeline-shaped edit AND a fallback-lane edit. The durable PUT is now an EXPLICIT
//  publish (dataSpecPersist.test.ts) — the leave/unmount flush is retired with auto-save.
//  DataWorkbench is mocked to a deterministic onChange emitter (its real routing is
//  covered in DataModelingPanel.test.tsx / DataWorkbench.test.tsx). The durable PUT +
//  debounce + honest-error contract of the api-action itself lives in store/dataSpecPersist.test.ts.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DataModelingPanel } from './DataModelingPanel'
import { useConstructorStore } from '../../store/constructor.store'
import { useRoleStore } from '../../studio/useRole'
import type { NamedDataSpec } from '../../types/constructor'
import type { DataSpec } from '@statdash/engine'

const PIPELINE_EDIT: DataSpec = {
  type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' },
} as unknown as DataSpec
const ROWLIST_EDIT: DataSpec = { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec

// The ONE editor is mocked to a controlled onChange emitter: two buttons emit the two
// spec SHAPES the single onChange must both persist. (The panel lazy-imports it.)
vi.mock('./workbench/DataWorkbench', () => ({
  DataWorkbench: ({ onChange }: { onChange: (s: DataSpec) => void }) => (
    <div data-testid="mock-workbench">
      <button data-testid="emit-pipeline" onClick={() => onChange(PIPELINE_EDIT)}>pipe</button>
      <button data-testid="emit-rowlist" onClick={() => onChange(ROWLIST_EDIT)}>row</button>
    </div>
  ),
}))

// Spy the persistence actions — the assertion surface (no network in a unit test). The
// updateDataSpec spy still writes the optimistic patch so the controlled value stays live.
// Defined INSIDE the factory (vi.mock is hoisted above module scope); read back in the
// assertions via a dynamic import of the (mocked) module.
vi.mock('../../store/api-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/api-actions')>()
  return {
    ...actual,
    updateDataSpec: vi.fn((id: string, patch: Partial<NamedDataSpec>) => {
      useConstructorStore.getState().updateDataSpec(id, patch)
    }),
  }
})

const PIPELINE_SPEC: NamedDataSpec = {
  id: 'spec-q', name: 'GDP query',
  spec: { type: 'pipeline', pipe: [{ op: 'source', metrics: [] }], encoding: { label: 'label' } } as unknown as DataSpec,
}
const ROWLIST_SPEC: NamedDataSpec = {
  id: 'spec-r', name: 'Manual rows', spec: { type: 'row-list', rows: [] } as unknown as DataSpec,
}

beforeEach(() => {
  vi.clearAllMocks()
  useConstructorStore.setState({ dataSources: [], dataSpecs: [PIPELINE_SPEC, ROWLIST_SPEC] })
  useRoleStore.setState({ role: 'steward' })
})

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/studio/data?dataFloor=model']}>
      <DataModelingPanel />
    </MemoryRouter>,
  )
}

describe('DataModelingPanel — edit persistence wiring (both shapes → durable api-action)', () => {
  it('a PIPELINE-shaped edit persists through the API updateDataSpec (not store-only)', async () => {
    const { updateDataSpec } = await import('../../store/api-actions')
    renderPanel()
    fireEvent.click(screen.getByText('GDP query'))
    fireEvent.click(await screen.findByTestId('emit-pipeline'))
    expect(updateDataSpec).toHaveBeenCalledWith('spec-q', { spec: PIPELINE_EDIT })
  })

  it('a FALLBACK-LANE (non-pipeline) edit persists through the SAME API updateDataSpec', async () => {
    const { updateDataSpec } = await import('../../store/api-actions')
    renderPanel()
    fireEvent.click(screen.getByText('Manual rows'))
    fireEvent.click(await screen.findByTestId('emit-rowlist'))
    expect(updateDataSpec).toHaveBeenCalledWith('spec-r', { spec: ROWLIST_EDIT })
  })
})
