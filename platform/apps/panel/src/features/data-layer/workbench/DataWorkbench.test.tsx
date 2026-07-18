// ── DataWorkbench composition tests (W-P2/W-P5b · SPEC §3) ────────────────────────
//
//  What the workbench OWNS: the three panes mount TOGETHER, always visible; the surface
//  speaks the ONE `pipeline` spine and accepts BOTH a legacy `query` (via its desugared
//  view) AND a native `pipeline`; every write EMITS `pipeline` (the ⛔ emission flip); the
//  8-type discriminant Select never appears; a non-shaped spec is declared honestly. The
//  live grid + the metric palette are mocked so the composition test is deterministic.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { DataWorkbench } from './DataWorkbench'
import { useMetricCatalogStore } from '../../../discovery/metricCatalog.store'
import { useRoleStore } from '../../../studio/useRole'

// Mock the center pane — the re-homed grid (its states are tested in PipelineDataGrid).
// The workbench renders the VIEW form (the source read is lifted into DataWorkbench).
vi.mock('../pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: ({ asOfStep }: { asOfStep: number }) => (
    <div data-testid="mock-step-grid" data-asof={asOfStep}>grid</div>
  ),
}))

// Mock the Get-head metric palette — it drives the store/discovery surfaces we don't
// exercise here. We assert only that picking a metric flows through onChange as a spine.
vi.mock('../../../discovery/MetricPalette', () => ({
  MetricPalette: ({ onBind }: { onBind?: (id: string) => void }) => (
    <button data-testid="mock-metric-palette" onClick={() => onBind?.('m.gdp')}>pick m.gdp</button>
  ),
}))

const metrics: Record<string, MetricDef> = {
  'm.gdp': { label: { en: 'Gross Domestic Product', ka: 'მშპ' } } as never,
}
const dimensions = { region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' } } } as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'author' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

// A LEGACY query spec — accepted via its desugared view (a steward source head + tail).
const querySpec: Extract<DataSpec, { type: 'query' }> = {
  type: 'query', query: { measure: 'm.gdp' },
  pipe: [{ op: 'filter', where: { REGION: 'GE' } } as never],
  encoding: { label: 'label' },
}

// A NATIVE pipeline spec — a governed source head + filter tail (the emission-flip shape).
const pipelineSpec: DataSpec = {
  type: 'pipeline',
  pipe: [{ op: 'source', metrics: ['m.gdp'] }, { op: 'filter', where: { REGION: 'GE' } } as never],
  encoding: { label: 'label' },
}

describe('DataWorkbench — the three-pane surface (spine-shaped)', () => {
  it('mounts ALL THREE panes together (rail · live grid · generated query)', () => {
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-grid')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-query')).toBeInTheDocument()
    expect(screen.getByTestId('mock-step-grid')).toBeInTheDocument()
  })

  it('each pane is a labelled region (WCAG Law 9) — three named regions', () => {
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    const regions = screen.getAllByRole('region')
    expect(regions).toHaveLength(3)
    regions.forEach((r) => expect(r.getAttribute('aria-label')).toBeTruthy())
  })

  it('ACCEPTS a legacy query via its desugared view — Get + the filter step', () => {
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    const steps = screen.getAllByTestId('gq-step')
    expect(steps.map((s) => s.getAttribute('data-op'))).toEqual(['source', 'filter'])
  })

  it('ACCEPTS a native pipeline spec through the SAME code path', () => {
    render(<DataWorkbench value={pipelineSpec} onChange={() => {}} />)
    const steps = screen.getAllByTestId('gq-step')
    expect(steps.map((s) => s.getAttribute('data-op'))).toEqual(['source', 'filter'])
  })

  it('EMITS a `pipeline` spec when the Get head binds a metric (the ⛔ emission flip)', () => {
    const onChange = vi.fn()
    // The browse-first unbound seed (an empty governed head) — what DataFacetField hands
    // the workbench for a fresh element. The Get metric picker is live over it.
    const fresh: DataSpec = { type: 'pipeline', pipe: [{ op: 'source', metrics: [] }], encoding: { label: 'label' } }
    render(<DataWorkbench value={fresh} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('mock-metric-palette'))
    const next = onChange.mock.calls[0][0] as DataSpec
    expect(next.type).toBe('pipeline')
    const head = (next as Extract<DataSpec, { type: 'pipeline' }>).pipe[0]
    expect(head.op).toBe('source')
    expect(head).toHaveProperty('metrics', ['m.gdp'])
  })

  it('does NOT show the 8-type spec-discriminant Select (author starts from Get)', () => {
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    expect(screen.queryByText('სპეც-ის ტიპი')).toBeNull()
    expect(screen.getByTestId('pipe-source-chip')).toBeInTheDocument()
  })

  it('a non-shaped spec is declared honestly, not a broken workbench', () => {
    render(<DataWorkbench value={{ type: 'row-list', rows: [] }} onChange={() => {}} />)
    expect(screen.getByTestId('data-workbench-nonquery')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
  })
})

// ── 0084 — the steward raw-cube entry + the promotion loop, plane-gated ──────────
describe('DataWorkbench — the two-audience canon (0084)', () => {
  it('AUTHOR lens: NO raw-cube tab, NO promotion affordance (FF-AUTHOR-NO-QUERY)', () => {
    useRoleStore.setState({ role: 'author' })
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    expect(screen.queryByTestId('get-tab-cubes')).toBeNull()
    expect(screen.queryByTestId('promote-metric')).toBeNull()
  })

  it('STEWARD lens: the raw-cube tab is offered', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    expect(screen.getByTestId('get-tab-cubes')).toBeInTheDocument()
  })

  it('STEWARD lens: a bound RAW/steward head offers «მეტრიკად დაწინაურება»', () => {
    // A legacy query desugars to a STEWARD source(query) head — promotable.
    useRoleStore.setState({ role: 'steward' })
    render(<DataWorkbench value={querySpec} onChange={() => {}} />)
    expect(screen.getByTestId('promote-metric')).toBeInTheDocument()
  })

  it('STEWARD lens: a GOVERNED head is already promoted — no promote affordance', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<DataWorkbench value={pipelineSpec} onChange={() => {}} />)
    expect(screen.queryByTestId('promote-metric')).toBeNull()
  })
})
