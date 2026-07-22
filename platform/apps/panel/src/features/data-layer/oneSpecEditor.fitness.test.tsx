// ── FF-ONE-SPEC-EDITOR — ONE spec-editing surface (ADR-051 DU3) ───────────────────
//
//  DU3 collapses the TWO editors for one DataSpec into ONE. The three-pane DataWorkbench —
//  now carrying the generic `SpecBody` dispatch as its OWN co-located FALLBACK LANE for
//  kinds the panes can't yet shape — is the SOLE spec-editing surface. The legacy
//  `DataSpecEditor` is NO LONGER mounted as a second parallel editor beside the workbench
//  in either host (the "Raw editor (advanced)" / "Raw editor (steward)" accordions are
//  gone). This gate proves that structural relocation with a real render + a source scan:
//
//    A · the fallback lane lives INSIDE the workbench — a non-pipeline kind edits there,
//        editably (SpecBody dispatched a live control), and the three panes stay ABSENT.
//        A pipeline-shaped spec keeps the three panes and shows NO fallback lane.
//    B · neither host mounts `DataSpecEditor` as a SIBLING of the workbench, and — the DU3
//        core claim — a NON-PIPELINE spec edits through the SAME workbench fallback lane in
//        BOTH hosts (no host-dependent second surface) —
//        · DataModelingPanel: a workbench-shaped spec shows the three panes; AND a
//          non-pipeline selectedSpec ALSO takes over the panel through DataWorkbench (its
//          fallback lane) — NOT a separate DataSpecEditor branch.
//          (This closes the earlier blind spot: the Model floor used to fall through to a
//          still-present DataSpecEditor mount for non-pipeline kinds.)
//        · DataFacetField: the inspector facet references the workbench (THE DOOR) and no
//          longer imports/mounts `DataSpecEditor` at all — it opens the one surface.
//
//  NOTE (ADR-051 DU4 trust-recovery): the kind picker is RESTORED (R1), but INSIDE the one
//  surface — the workbench's `spec-type-picker`, never a second parallel DataSpecEditor. So
//  the invariant is "no SIBLING second editor / no DataSpecEditor import", proven structurally
//  (the old `workbench-raw-advanced` sibling stays absent; the facet imports no DataSpecEditor);
//  the type-switcher, where present, lives WITHIN the workbench container.
//
//  Per-kind EDITABILITY completeness is owned by FF-DATASPEC-AUTHORING-COMPLETE +
//  DataSpecEditor.test (every SPEC_CATALOG kind resolves to a live authoring surface);
//  THIS gate owns the "one surface, no sibling" invariant DU3 introduces.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { DataWorkbench } from './workbench/DataWorkbench'
import { SpecsBody } from '../../studio/specs/SpecsBody'
import { useConstructorStore } from '../../store/constructor.store'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../../studio/useRole'
import type { DataSourceDef, NamedDataSpec } from '../../types/constructor'

// The three-pane grid + the metric palette are mocked deterministic (their own states are
// tested in PipelineStepGrid / DataWorkbench). We assert the COMPOSITION, not their innards.
vi.mock('./pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: () => <div data-testid="mock-step-grid">grid</div>,
  PipelineStepGrid:     () => <div data-testid="mock-step-grid">grid</div>,
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <button data-testid="mock-metric-palette">pick</button>,
}))

// createDataSpec is the ONE persistence path — stubbed so no render touches the network.
vi.mock('../../store/api-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/api-actions')>()
  return { ...actual, createDataSpec: vi.fn(async () => ({ id: 'x' } as NamedDataSpec)) }
})

// The inspector facet source (Vite ?raw) — scanned to prove it mounts no DataSpecEditor.
const FACET_SRC = import.meta.glob(['../../inspector/controls/DataFacetField.tsx'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const metrics: Record<string, MetricDef> = { 'm.gdp': { label: { en: 'GDP', ka: 'მშპ' } } as never }
const dimensions = { region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' } } } as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'steward' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

describe('FF-ONE-SPEC-EDITOR — the workbench (+ its fallback lane) is the SOLE spec editor (ADR-051 DU3)', () => {
  // ── A · the co-located fallback lane lives INSIDE the workbench ────────────────────
  it('a NON-pipeline kind edits INSIDE the workbench via the co-located SpecBody fallback lane', () => {
    render(<DataWorkbench value={{ type: 'row-list', rows: [] }} onChange={() => {}} />)
    // The fallback lane is a region INSIDE the workbench's non-query container — not a
    // sibling surface, not a broken/blank pane.
    const container = screen.getByTestId('data-workbench-nonquery')
    const lane = within(container).getByTestId('workbench-fallback-lane')
    // …and it is EDITABLE — SpecBody dispatched a live control (with no rich editor booted,
    // row-list lands on the JSON fallback textarea: still an editing surface, never a dead room).
    expect(within(lane).getByRole('textbox')).toBeInTheDocument()
    // The three SHAPING panes are absent — this kind is not (yet) pane-shaped.
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
    expect(screen.queryByTestId('workbench-grid')).toBeNull()
  })

  it('a PIPELINE-shaped spec keeps the three panes and shows NO fallback lane', () => {
    const pipeline: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' },
    }
    render(<DataWorkbench value={pipeline} onChange={() => {}} />)
    expect(screen.queryByTestId('workbench-fallback-lane')).toBeNull()
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-grid')).toBeInTheDocument()
  })

  // ── B · neither host mounts DataSpecEditor as a SIBLING of the workbench ───────────
  it('HOST SpecsBody — a workbench-shaped spec shows the workbench with NO sibling raw editor', async () => {
    const SOURCE: DataSourceDef = { id: 'src-1', name: 'SDMX', type: 'sdmx-json', config: {}, status: 'connected' }
    const QUERY: NamedDataSpec = {
      id: 'spec-q', name: 'GDP query',
      spec: { type: 'query', query: { measure: ['m.gdp'] }, pipe: [], encoding: { label: 'label' } },
    }
    useConstructorStore.setState({ dataSources: [SOURCE], dataSpecs: [QUERY] })
    render(
      <MemoryRouter initialEntries={['/studio/data?dataFloor=specs']}>
        <SpecsBody locale="ka" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('GDP query'))
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    // The three panes confirm this is the workbench (lazy-resolved) …
    expect(await screen.findByTestId('workbench-rail')).toBeInTheDocument()
    // The old parallel "Raw editor (advanced)" SIBLING accordion is gone — the workbench is
    // the sole editor here (no second DataSpecEditor mount beside it).
    expect(screen.queryByTestId('workbench-raw-advanced')).toBeNull()
    // The type picker is RESTORED (R1) but lives INSIDE the one surface — the workbench's
    // Advanced/raw panel — never as a sibling.
    const advanced = screen.getByTestId('workbench-advanced')
    expect(advanced).toContainElement(screen.getByTestId('spec-type-picker'))
  })

  it('HOST SpecsBody — a NON-PIPELINE spec ALSO edits through the workbench fallback lane, NO DataSpecEditor branch, NO kind <Select>', async () => {
    // The DU3 core claim, at the exact place it used to break: a non-pipeline selectedSpec
    // in the Specs floor. It must take over the floor through DataWorkbench (the SAME
    // fallback lane the inspector door opens) — never fall through to a separate
    // DataSpecEditor mount with its kind Select.
    const SOURCE: DataSourceDef = { id: 'src-1', name: 'SDMX', type: 'sdmx-json', config: {}, status: 'connected' }
    const ROWLIST: NamedDataSpec = { id: 'spec-r', name: 'Manual rows', spec: { type: 'row-list', rows: [] } }
    useConstructorStore.setState({ dataSources: [SOURCE], dataSpecs: [ROWLIST] })
    render(
      <MemoryRouter initialEntries={['/studio/data?dataFloor=specs']}>
        <SpecsBody locale="ka" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('Manual rows'))
    // Same host takeover as a pipeline spec — the workbench, not a second editor.
    expect(screen.getByTestId('modeling-workbench')).toBeInTheDocument()
    // Edits IN the workbench's co-located fallback lane (lazy-resolved) — the ONE surface.
    const lane = await screen.findByTestId('workbench-fallback-lane')
    expect(within(lane).getByRole('textbox')).toBeInTheDocument()
    // The three SHAPING panes stay absent for a non-pipeline kind…
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
    expect(screen.queryByTestId('workbench-grid')).toBeNull()
    // …and the restored type-switcher (R1) lives INSIDE this workbench's fallback lane —
    // one surface, not a resurrected sibling DataSpecEditor.
    expect(lane).toContainElement(screen.getByTestId('spec-type-picker'))
  })

  it('HOST DataFacetField — the inspector facet opens the WORKBENCH and mounts NO DataSpecEditor', () => {
    const src = Object.values(FACET_SRC)[0] ?? ''
    expect(src.length).toBeGreaterThan(200)          // the scan is real, not vacuous
    expect(/\bDataWorkbench\b/.test(src)).toBe(true)  // THE DOOR opens the one surface
    expect(/\bDataSpecEditor\b/.test(src)).toBe(false) // …and no second parallel editor
  })

  it('BITES — the facet scan is not vacuous (a planted DataSpecEditor reference WOULD trip it)', () => {
    expect(/\bDataSpecEditor\b/.test("import { DataSpecEditor } from '../../features/data-layer/DataSpecEditor'")).toBe(true)
  })
})
