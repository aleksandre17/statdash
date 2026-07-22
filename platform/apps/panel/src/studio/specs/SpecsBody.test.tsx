import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { SpecsBody } from './SpecsBody'
import { useConstructorStore } from '../../store/constructor.store'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../useRole'
import type { NamedDataSpec } from '../../types/constructor'
import type { DataSpec, MetricDef } from '@statdash/engine'

// The Specs floor (DU6-IA-1) — the extracted spec half of the retired DataModelingPanel.
// These tests prove it mounts the spec browser against the real store and routes EVERY
// selected spec through the ONE DataWorkbench surface (ADR-051 DU3 / FF-ONE-SPEC-EDITOR):
// a query/pipeline shapes on the three-pane GRID, any other kind edits in the workbench's
// co-located SpecBody fallback lane — no separate DataSpecEditor, no kind Select.

vi.mock('../../features/data-layer/pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: () => <div data-testid="mock-step-grid">grid</div>,
  PipelineStepGrid: () => <div data-testid="mock-step-grid">grid</div>,
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <button data-testid="mock-metric-palette">pick</button>,
}))

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
  }
})

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
  useConstructorStore.setState({ dataSources: [], dataSpecs: [QUERY_SPEC, ROWLIST_SPEC] })
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'steward' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

// A tiny probe surfacing the live router location — so a test can assert the URL was
// rewritten (the selection permalink / seed cleanup), not just what rendered.
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

// The floor reads its in-workspace cube seed off the workspace URL (ADR-051 DU2), so every
// render is wrapped in a router; `entries` seeds the URL for the browse-a-cube test.
function renderFloor(entries: string[] = ['/studio/data?dataFloor=specs']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <SpecsBody locale="ka" />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('SpecsBody — the Specs floor spec browser (DU6-IA-1)', () => {
  it('mounts the spec browser reading the store', () => {
    renderFloor()
    expect(screen.getByText('მონაცემების სპეც-ები')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
    expect(screen.getByText('Manual rows')).toBeInTheDocument()
  })

  it('selecting a NON-pipeline spec opens the ONE workbench surface via its fallback lane (ADR-051 DU3)', async () => {
    renderFloor()
    fireEvent.click(screen.getByText('Manual rows'))
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    const lane = await screen.findByTestId('workbench-fallback-lane')
    expect(lane).toBeInTheDocument()
    // The restored type-switcher (R1) lives INSIDE that lane — one surface, not a sibling.
    expect(lane).toContainElement(screen.getByTestId('spec-type-picker'))
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
  })

  it('selecting a query/pipeline spec opens the three-pane WORKBENCH grid, not the JSON fallback (0086 · 0099)', async () => {
    renderFloor()
    fireEvent.click(screen.getByText('GDP query'))
    const grid = await screen.findByTestId('workbench-grid')
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    expect(within(grid).getByTestId('mock-step-grid')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-back-to-list')).toBeInTheDocument()
    // The workbench is the SOLE editor — no parallel "Raw editor (advanced)" sibling.
    expect(screen.queryByTestId('workbench-raw-advanced')).toBeNull()
    expect(screen.getByTestId('workbench-advanced')).toContainElement(screen.getByTestId('spec-type-picker'))
  })

  it('an in-workspace cube seed (on the URL) seeds a steward pipeline cube and lands on the workbench GRID', async () => {
    renderFloor(['/studio/data?dataFloor=specs&cube=REGIONAL_GVA&cubeMeasures=gva.total&cubeStore=stats'])
    expect(await screen.findByTestId('workbench-grid')).toBeInTheDocument()
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    expect(screen.getByTestId('mock-step-grid')).toBeInTheDocument()

    const seeded = useConstructorStore.getState().dataSpecs.find((s) => s.id === 'seeded-1')!
    const spec = seeded.spec as Extract<DataSpec, { type: 'pipeline' }>
    expect(spec.type).toBe('pipeline')
    const head = spec.pipe[0] as { op: string; query?: { measure: unknown }; dataSource?: string }
    expect(head.op).toBe('source')
    expect(head.query).toEqual({ measure: 'gva.total' })
    expect(head.dataSource).toBe('stats')

    // F1 acceptance — the post-gesture URL is a reproducible permalink: the created spec
    // rides `spec=`, and the one-shot cube seed params are gone (consumed, never resurrected).
    await waitFor(() => {
      const search = screen.getByTestId('loc').textContent ?? ''
      expect(search).toContain('dataFloor=specs')
      expect(search).toContain('spec=seeded-1')
      expect(search).not.toContain('cube=')
      expect(search).not.toContain('cubeMeasures=')
      expect(search).not.toContain('cubeStore=')
    })
  })

  it('a deep-link `?dataFloor=specs&spec=<id>` renders the workbench takeover for that spec (F1 permalink)', async () => {
    renderFloor(['/studio/data?dataFloor=specs&spec=spec-q'])
    expect(await screen.findByTestId('modeling-workbench')).toBeInTheDocument()
    expect(screen.getByText('GDP query')).toBeInTheDocument()
  })

  it('an UNKNOWN `spec=` id (not in the store) renders the LIST, never a blank, and canonicalizes the bogus param away', async () => {
    renderFloor(['/studio/data?dataFloor=specs&spec=does-not-exist'])
    // Honest state: the list, not a blank workbench takeover.
    expect(screen.getByText('მონაცემების სპეც-ები')).toBeInTheDocument()
    expect(screen.queryByTestId('modeling-workbench')).toBeNull()
    await waitFor(() => {
      const search = screen.getByTestId('loc').textContent ?? ''
      expect(search).not.toContain('spec=')
      expect(search).toContain('dataFloor=specs')
    })
  })

  it('back-to-list removes `spec=` from the URL (deselect is a real navigation step)', async () => {
    renderFloor(['/studio/data?dataFloor=specs&spec=spec-q'])
    fireEvent.click(await screen.findByTestId('workbench-back-to-list'))
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent ?? '').not.toContain('spec=')
    })
    expect(screen.getByText('GDP query')).toBeInTheDocument()
    expect(screen.queryByTestId('modeling-workbench')).toBeNull()
  })
})
