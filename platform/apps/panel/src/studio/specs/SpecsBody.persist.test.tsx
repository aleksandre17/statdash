import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SpecsBody } from './SpecsBody'
import { useConstructorStore } from '../../store/constructor.store'
import { useRoleStore } from '../useRole'
import type { NamedDataSpec } from '../../types/constructor'
import type { DataSpec } from '@statdash/engine'

// The Specs-floor workbench's onChange funnels through the ONE `updateDataSpec` (the draft
// path, C3) for BOTH shapes that share the ONE DataWorkbench (ADR-051 DU3): a pipeline-shaped
// edit AND a fallback-lane edit. DataWorkbench is mocked to a deterministic onChange emitter.

const PIPELINE_EDIT: DataSpec = {
  type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' },
} as unknown as DataSpec
const ROWLIST_EDIT: DataSpec = { type: 'row-list', rows: [{ a: 1 }] } as unknown as DataSpec

vi.mock('../../features/data-layer/workbench/DataWorkbench', () => ({
  DataWorkbench: ({ onChange }: { onChange: (s: DataSpec) => void }) => (
    <div data-testid="mock-workbench">
      <button data-testid="emit-pipeline" onClick={() => onChange(PIPELINE_EDIT)}>pipe</button>
      <button data-testid="emit-rowlist" onClick={() => onChange(ROWLIST_EDIT)}>row</button>
    </div>
  ),
}))

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

function renderFloor() {
  return render(
    <MemoryRouter initialEntries={['/studio/data?dataFloor=specs']}>
      <SpecsBody locale="ka" />
    </MemoryRouter>,
  )
}

describe('SpecsBody — edit persistence wiring (both shapes → durable api-action)', () => {
  it('a PIPELINE-shaped edit persists through the API updateDataSpec (not store-only)', async () => {
    const { updateDataSpec } = await import('../../store/api-actions')
    renderFloor()
    fireEvent.click(screen.getByText('GDP query'))
    fireEvent.click(await screen.findByTestId('emit-pipeline'))
    expect(updateDataSpec).toHaveBeenCalledWith('spec-q', { spec: PIPELINE_EDIT })
  })

  it('a FALLBACK-LANE (non-pipeline) edit persists through the SAME API updateDataSpec', async () => {
    const { updateDataSpec } = await import('../../store/api-actions')
    renderFloor()
    fireEvent.click(screen.getByText('Manual rows'))
    fireEvent.click(await screen.findByTestId('emit-rowlist'))
    expect(updateDataSpec).toHaveBeenCalledWith('spec-r', { spec: ROWLIST_EDIT })
  })
})
