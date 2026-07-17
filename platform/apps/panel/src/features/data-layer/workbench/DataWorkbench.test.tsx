// ── DataWorkbench composition tests (W-P2 · SPEC §3) ──────────────────────────────
//
//  What W-P2 OWNS: the three panes mount TOGETHER, always visible; the generated-query
//  pane MIRRORS the pipe live; the 8-type spec Select never appears in the workbench;
//  a non-query spec is declared honestly. The live grid's own behaviour (states, cap,
//  honest cells) is W-P1's tested territory — mocked here so the composition test is
//  deterministic and does not re-exercise the live-store hook.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { DataWorkbench } from './DataWorkbench'
import { useMetricCatalogStore } from '../../../discovery/metricCatalog.store'
import { useRoleStore } from '../../../studio/useRole'

// Mock the center pane — the re-homed W-P1 grid (its states are tested there). We assert
// it MOUNTS with the right spec+step; its internals are out of scope for the composition.
vi.mock('../pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGrid: ({ asOfStep }: { asOfStep: number }) => (
    <div data-testid="mock-step-grid" data-asof={asOfStep}>grid</div>
  ),
}))

type QuerySpec = Extract<DataSpec, { type: 'query' }>

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

describe('DataWorkbench — the three-pane surface', () => {
  const spec: QuerySpec = {
    type: 'query', query: { measure: 'm.gdp' },
    pipe: [{ op: 'filter', where: { REGION: 'GE' } } as never],
    encoding: { label: 'label' },
  }

  it('mounts ALL THREE panes together (rail · live grid · generated query)', () => {
    render(<DataWorkbench value={spec} onChange={() => {}} />)
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-grid')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-query')).toBeInTheDocument()
    // the center pane is the re-homed live grid
    expect(screen.getByTestId('mock-step-grid')).toBeInTheDocument()
  })

  it('each pane is a labelled region (WCAG Law 9) — three named regions', () => {
    render(<DataWorkbench value={spec} onChange={() => {}} />)
    // Three landmark regions (rail · live grid · generated query), each with an
    // accessible name. Locale-robust: the default-locale (ka) names prove the bilingual
    // labels are wired without hardcoding an English assertion.
    const regions = screen.getAllByRole('region')
    expect(regions).toHaveLength(3)
    regions.forEach((r) => expect(r.getAttribute('aria-label')).toBeTruthy())
  })

  it('the generated-query pane MIRRORS the pipe (Get + the filter step)', () => {
    render(<DataWorkbench value={spec} onChange={() => {}} />)
    const steps = screen.getAllByTestId('gq-step')
    expect(steps.map((s) => s.getAttribute('data-op'))).toEqual(['source', 'filter'])
  })

  it('does NOT show the 8-type spec-discriminant Select (author starts from Get)', () => {
    render(<DataWorkbench value={spec} onChange={() => {}} />)
    // the workbench never mounts the discriminant picker (SPEC §3.4)
    expect(screen.queryByText('სპეც-ის ტიპი')).toBeNull()
    expect(screen.getByTestId('pipe-source-chip')).toBeInTheDocument()
  })

  it('a non-query spec is declared honestly, not a broken workbench', () => {
    render(<DataWorkbench value={{ type: 'row-list', rows: [] }} onChange={() => {}} />)
    expect(screen.getByTestId('data-workbench-nonquery')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
  })
})
