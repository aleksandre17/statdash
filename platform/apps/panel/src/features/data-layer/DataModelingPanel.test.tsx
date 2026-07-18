import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { DataModelingPanel } from './DataModelingPanel'
import { useConstructorStore } from '../../store/constructor.store'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../../studio/useRole'
import { useSourcesHandoff } from '../../store/sourcesHandoff'
import type { DataSourceDef, NamedDataSpec } from '../../types/constructor'
import type { DataSpec, MetricDef } from '@statdash/engine'

// The full data-modeling body (source/spec browser + editor), extracted from the
// wizard's DataStep so the Studio Data surface mounts the SAME component. These
// tests prove it mounts against the real store, routes a workbench-shaped spec to
// the WORKBENCH GRID (0086 · 0099 — one editor, never the raw-JSON JsonFallback), and
// keeps the DataSpecEditor for non-workbench spec kinds.

// The workbench's live grid + metric palette are mocked so the composition test is
// deterministic (their own states are tested in PipelineDataGrid / DataWorkbench).
vi.mock('./pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: () => <div data-testid="mock-step-grid">grid</div>,
  PipelineStepGrid: () => <div data-testid="mock-step-grid">grid</div>,
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <button data-testid="mock-metric-palette">pick</button>,
}))

// createDataSpec is the ONE persistence path — the Sources handoff seeds through it.
// Mock it to add the spec to the store synchronously (no network), returning the entity.
vi.mock('../../store/api-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/api-actions')>()
  return {
    ...actual,
    createDataSpec: vi.fn(async (input: Omit<NamedDataSpec, 'id'>) => {
      const created: NamedDataSpec = { id: 'seeded-1', ...input }
      useConstructorStore.getState().addDataSpec(created)
      return created
    }),
  }
})

const SOURCE: DataSourceDef = {
  id: 'src-1', name: 'SDMX source', type: 'sdmx-json', config: {}, status: 'connected',
}
// A workbench-shaped LEGACY query spec — shaped on the workbench (via its desugared view).
const QUERY_SPEC: NamedDataSpec = {
  id: 'spec-q', name: 'GDP query',
  spec: { type: 'query', query: { measure: ['m.gdp'] }, pipe: [], encoding: { label: 'label' } },
}
// A NON-workbench spec — keeps the DataSpecEditor two-column form.
const ROWLIST_SPEC: NamedDataSpec = {
  id: 'spec-r', name: 'Manual rows', spec: { type: 'row-list', rows: [] },
}

const metrics: Record<string, MetricDef> = {
  'm.gdp': { label: { en: 'Gross Domestic Product', ka: 'მშპ' } } as never,
}
const dimensions = { region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' } } } as never

beforeEach(() => {
  useConstructorStore.setState({ dataSources: [SOURCE], dataSpecs: [QUERY_SPEC, ROWLIST_SPEC] })
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'steward' })
  useSourcesHandoff.setState({ pendingCube: null })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

describe('DataModelingPanel — relocated data authoring (AR-49 M1.3)', () => {
  it('mounts the source + spec browser reading the store', () => {
    render(<DataModelingPanel />)
    expect(screen.getByText('მონაცემების წყაროები')).toBeInTheDocument()
    expect(screen.getByText('მონაცემების სპეც-ები')).toBeInTheDocument()
    expect(screen.getByText('SDMX source')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'დამატება' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
  })

  it('selecting a NON-workbench spec reveals the real DataSpecEditor', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('Manual rows'))
    // The DataSpecEditor's type picker — proof the SAME editor mounted, not a stub.
    expect(screen.getByRole('combobox', { name: 'სპეც-ის ტიპი' })).toBeInTheDocument()
    expect(screen.queryByTestId('modeling-workbench')).toBeNull()
  })

  it('editing a NON-workbench spec writes through the same store action (updateDataSpec)', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('Manual rows'))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'სპეც-ის ტიპი' }))
    const listbox = screen.getByRole('listbox')
    fireEvent.click(within(listbox).getByText(/\(timeseries\)/))
    expect(useConstructorStore.getState().dataSpecs.find((s) => s.id === 'spec-r')!.spec.type).toBe('timeseries')
  })

  it('selecting a source reveals the authoring panel with delete', () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('SDMX source'))
    expect(screen.getByRole('button', { name: 'წაშლა' })).toBeInTheDocument()
  })
})

// ── 0099 — the one editor = the workbench GRID, never the raw-JSON landing ────────
describe('DataModelingPanel — a workbench-shaped spec lands on the GRID (0086 · 0099)', () => {
  it('selecting a query/pipeline spec opens the three-pane WORKBENCH grid, not the JSON fallback', async () => {
    render(<DataModelingPanel />)
    fireEvent.click(screen.getByText('GDP query'))
    // The workbench (lazy) resolves — the PROMISED grid, not a raw-JSON textarea.
    const grid = await screen.findByTestId('workbench-grid')
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    expect(within(grid).getByTestId('mock-step-grid')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-back-to-list')).toBeInTheDocument()
    // Raw-JSON survives ONLY as a collapsed steward disclosure (plane law) — never the landing.
    const advanced = screen.getByTestId('workbench-raw-advanced')
    expect(within(advanced).getByRole('button').getAttribute('aria-expanded')).toBe('false')
  })

  it('the Sources handoff seeds a steward pipeline cube and lands on the workbench GRID (not JsonFallback)', async () => {
    useSourcesHandoff.setState({
      pendingCube: { datasetCode: 'REGIONAL_GVA', measures: ['gva.total'], dataSource: 'stats' },
    })
    render(<DataModelingPanel />)

    // The handoff creates + selects the seeded spec → the workbench grid renders.
    expect(await screen.findByTestId('workbench-grid')).toBeInTheDocument()
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    expect(screen.getByTestId('mock-step-grid')).toBeInTheDocument()

    // The seeded spec is the `pipeline` spine with a STEWARD raw head that DECLARES its
    // own store home (0089) — the shape the workbench browses, not a raw-JSON blob.
    const seeded = useConstructorStore.getState().dataSpecs.find((s) => s.id === 'seeded-1')!
    const spec = seeded.spec as Extract<DataSpec, { type: 'pipeline' }>
    expect(spec.type).toBe('pipeline')
    const head = spec.pipe[0] as { op: string; query?: { measure: unknown }; dataSource?: string }
    expect(head.op).toBe('source')
    expect(head.query).toEqual({ measure: 'gva.total' })
    expect(head.dataSource).toBe('stats')
  })
})
