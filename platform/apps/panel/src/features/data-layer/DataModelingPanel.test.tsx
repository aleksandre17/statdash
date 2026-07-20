import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DataModelingPanel } from './DataModelingPanel'
import { useConstructorStore } from '../../store/constructor.store'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../../studio/useRole'
import type { DataSourceDef, NamedDataSpec } from '../../types/constructor'
import type { DataSpec, MetricDef } from '@statdash/engine'

// The full data-modeling body (source/spec browser + editor), extracted from the
// wizard's DataStep so the Studio Data surface mounts the SAME component. These
// tests prove it mounts against the real store and routes EVERY selected spec through
// the ONE DataWorkbench surface (ADR-051 DU3): a query/pipeline shapes on the three-pane
// GRID (0086 · 0099 — never the raw-JSON JsonFallback), and any other kind edits in the
// workbench's co-located SpecBody fallback lane — no separate DataSpecEditor, no kind Select.

// The workbench's live grid + metric palette are mocked so the composition test is
// deterministic (their own states are tested in PipelineDataGrid / DataWorkbench).
vi.mock('./pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: () => <div data-testid="mock-step-grid">grid</div>,
  PipelineStepGrid: () => <div data-testid="mock-step-grid">grid</div>,
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <button data-testid="mock-metric-palette">pick</button>,
}))

// The API persistence path is mocked (no network in unit tests). createDataSpec adds
// to the store synchronously (the in-workspace cube seed writes through it); updateDataSpec
// writes the optimistic patch to the store synchronously (so "store reflects the edit"
// assertions hold) AND is a spy so an edit's DURABLE persistence can be asserted — the
// real action's debounced PUT + flush is covered in store/dataSpecPersist.test.ts.
vi.mock('../../store/api-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/api-actions')>()
  return {
    ...actual,
    createDataSpec: vi.fn(async (input: Omit<NamedDataSpec, 'id'>) => {
      const created: NamedDataSpec = { id: 'seeded-1', ...input }
      useConstructorStore.getState().addDataSpec(created)
      return created
    }),
    updateDataSpec: vi.fn((id: string, patch: Partial<NamedDataSpec>) => {
      useConstructorStore.getState().updateDataSpec(id, patch)
    }),
    flushDataSpecSaves: vi.fn(async () => {}),
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
// A NON-pipeline spec — edits through the workbench's co-located SpecBody fallback lane.
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
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

// The panel reads its in-workspace cube seed off the workspace URL (ADR-051 DU2), so every
// render is wrapped in a router; `entries` seeds the URL for the browse-a-cube test.
function renderPanel(entries: string[] = ['/studio/data?dataFloor=model']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <DataModelingPanel />
    </MemoryRouter>,
  )
}

describe('DataModelingPanel — relocated data authoring (AR-49 M1.3)', () => {
  it('mounts the source + spec browser reading the store', () => {
    renderPanel()
    expect(screen.getByText('მონაცემების წყაროები')).toBeInTheDocument()
    expect(screen.getByText('მონაცემების სპეც-ები')).toBeInTheDocument()
    expect(screen.getByText('SDMX source')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'დამატება' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
  })

  it('selecting a NON-pipeline spec opens the ONE workbench surface via its fallback lane — no kind Select (ADR-051 DU3)', async () => {
    renderPanel()
    fireEvent.click(screen.getByText('Manual rows'))
    // Same host takeover as a pipeline spec — the workbench, not a separate DataSpecEditor.
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    // The non-pipeline kind edits IN the workbench's co-located SpecBody fallback lane
    // (lazy-resolved), never a second sibling editor…
    expect(await screen.findByTestId('workbench-fallback-lane')).toBeInTheDocument()
    // …and the deleted kind <Select> type-switcher does NOT reappear (FF-ONE-SPEC-EDITOR).
    expect(screen.queryByRole('combobox', { name: 'სპეც-ის ტიპი' })).toBeNull()
    // The three SHAPING panes are absent — row-list is not (yet) pane-shaped.
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
  })

  it('editing a NON-pipeline spec in the fallback lane PERSISTS through the api-action updateDataSpec (durable, not store-only)', async () => {
    const { updateDataSpec } = await import('../../store/api-actions')
    renderPanel()
    fireEvent.click(screen.getByText('Manual rows'))
    const lane = await screen.findByTestId('workbench-fallback-lane')
    // row-list lands on the JSON fallback textarea (no rich editor booted) — an edit there
    // must reach the API-persisting updateDataSpec (PUT), not the store-only action (the
    // data-loss defect: fallback-lane edits were lost on reload).
    const box = within(lane).getByRole('textbox')
    fireEvent.change(box, { target: { value: '{"type":"row-list","rows":[{"a":1}]}' } })
    // The edit is optimistically reflected in the store…
    const saved = useConstructorStore.getState().dataSpecs.find((s) => s.id === 'spec-r')!.spec
    expect(saved.type).toBe('row-list')
    expect((saved as Extract<DataSpec, { type: 'row-list' }>).rows).toHaveLength(1)
    // …AND it went through the durable api-action with the edited spec (not store-only).
    expect(updateDataSpec).toHaveBeenCalledWith('spec-r', {
      spec: { type: 'row-list', rows: [{ a: 1 }] },
    })
  })

  it('selecting a source reveals the authoring panel with delete', () => {
    renderPanel()
    fireEvent.click(screen.getByText('SDMX source'))
    expect(screen.getByRole('button', { name: 'წაშლა' })).toBeInTheDocument()
  })
})

// ── 0099 — the one editor = the workbench GRID, never the raw-JSON landing ────────
describe('DataModelingPanel — a workbench-shaped spec lands on the GRID (0086 · 0099)', () => {
  it('selecting a query/pipeline spec opens the three-pane WORKBENCH grid, not the JSON fallback', async () => {
    renderPanel()
    fireEvent.click(screen.getByText('GDP query'))
    // The workbench (lazy) resolves — the PROMISED grid, not a raw-JSON textarea.
    const grid = await screen.findByTestId('workbench-grid')
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    expect(within(grid).getByTestId('mock-step-grid')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-back-to-list')).toBeInTheDocument()
    // ADR-051 DU3 — the workbench is the SOLE spec editor: the parallel "Raw editor
    // (advanced)" accordion is GONE, and NO second DataSpecEditor (its kind <Select>) sits
    // beside the workbench (FF-ONE-SPEC-EDITOR).
    expect(screen.queryByTestId('workbench-raw-advanced')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'სპეც-ის ტიპი' })).toBeNull()
  })

  it('an in-workspace cube seed (on the URL) seeds a steward pipeline cube and lands on the workbench GRID (not JsonFallback)', async () => {
    // ADR-051 DU2: the cube rides the workspace URL (`?cube=…&cubeMeasures=…&cubeStore=…`),
    // not a courier store. The panel reads it, seeds a fresh steward pipeline, and selects it.
    renderPanel(['/studio/data?dataFloor=model&cube=REGIONAL_GVA&cubeMeasures=gva.total&cubeStore=stats'])

    // The seed creates + selects the seeded spec → the workbench grid renders.
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
