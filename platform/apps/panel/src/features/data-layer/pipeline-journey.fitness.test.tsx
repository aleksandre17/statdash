// ── FF-JOURNEY-PIPE — the pipeline authoring journey, EXECUTABLE (ADR-046 · SPEC §4) ─
//
//  The ⛔ co-gate (with FF-PIPELINE-EQUIV) on the W-P5 default-emission flip + the tag-
//  editor demotion: the old tag editors demote ONLY when this is green. W-P0 registered
//  it as `it.todo`; W-P5b makes it EXECUTABLE — the J-PIPE journey walked through the
//  REAL workbench components resolving REAL data off a real engine store (not mocked),
//  so the four SPEC §4 beats are proven, not asserted by hand:
//
//    1. author picks a governed metric  → the emission is a `pipeline` spine (never a
//                                          raw `query`); a governed `source.metrics` head.
//    2. sees the browse grid            → the source head resolves REAL rows through the
//                                          engine (E1 browse-first, E5 one derivation path).
//    3. adds Filter (+ steps)           → the live per-step grid reflects the step OUTPUT
//                                          (real applyPipeline — fewer rows after a filter).
//    4. sees the generated query        → the declarative pipeline, GOVERNED nouns only
//                                          (FF-AUTHOR-NO-QUERY), and binding stays `pipeline`.
//
//  The LIVE walk (:3013, real MetricPalette + real cube, incl. a governed growth VALUE)
//  is the companion proof captured to work/authoring-truth/wp5b/ — this gate is the
//  deterministic, CI-executable form.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DataSpec, Observation, SourceStep } from '@statdash/engine'
import { ExternalStore } from '@statdash/engine'
import { PipelineStepGrid } from './pipeline-preview/PipelineStepGrid'
import { GeneratedQueryPane } from './workbench/GeneratedQueryPane'
import { AS_OF_SOURCE } from './pipeline-preview/pipelinePreview'
import { toWorkbenchModel } from './workbench/workbenchModel'
import { bindMeasureToSpec } from '../../inspector/controls/dataFacetModel'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../../studio/useRole'

// A real, SYNC engine store — the source head resolves against it through interpretSpec
// (the ONE derivation path), so the grid shows REAL rows, not a fixture.
const OBS: Observation[] = [
  { measure: 'B1G', value: 100, time: 2020, geo: 'GE', label: 'GDP' },
  { measure: 'B1G', value: 200, time: 2020, geo: 'AB', label: 'GDP' },
]
const store = new ExternalStore(OBS)

// Mock ONLY the store source — every other hook (catalog, role, locale, profile) runs
// for real. The grid + generated-query pane are the REAL components.
vi.mock('../../canvas/useLivePreviewStores', () => ({
  useLivePreviewStores: () => ({ stores: { default: store }, status: 'live' }),
}))

const metrics = { 'B1G': { label: { en: 'Gross Domestic Product', ka: 'მშპ' } } } as never
const dimensions = { geo: { code: 'geo', label: { en: 'Region', ka: 'რეგიონი' } } } as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'author' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

function bodyRowCount(): number {
  return screen.getByTestId('pipeline-grid').querySelectorAll('tbody tr').length
}

describe('FF-JOURNEY-PIPE — pipeline authoring journey, executable (ADR-046 §4)', () => {
  it('1. picking a governed metric emits a `pipeline` spine (never a raw query)', () => {
    const next = bindMeasureToSpec(undefined, 'B1G')
    expect(next.type).toBe('pipeline')
    const head = (next as Extract<DataSpec, { type: 'pipeline' }>).pipe[0]
    expect(head.op).toBe('source')
    expect(head).toHaveProperty('metrics', ['B1G'])
  })

  it('2. the source head resolves the BROWSE grid — real rows through the engine (E1/E5)', () => {
    // A steward source head over the store — the browse-all shape yields the raw grid.
    const head: SourceStep = { op: 'source', query: { measure: 'B1G' } }
    const model = toWorkbenchModel({ type: 'pipeline', pipe: [head], encoding: { label: 'label' } })!
    render(<PipelineStepGrid model={model} asOfStep={AS_OF_SOURCE} />)
    expect(bodyRowCount()).toBe(2) // both observations browse-visible before any step
  })

  it('3. adding a Filter step changes the live grid — the step OUTPUT (real applyPipeline)', () => {
    const head: SourceStep = { op: 'source', query: { measure: 'B1G' } }
    const withFilter = toWorkbenchModel({
      type: 'pipeline',
      pipe: [head, { op: 'filter', where: { geo: 'GE' } } as never],
      encoding: { label: 'label' },
    })!
    // Selecting the filter step (index 0 of the tail) shows its output — GE only.
    render(<PipelineStepGrid model={withFilter} asOfStep={0} />)
    expect(bodyRowCount()).toBe(1) // the filter removed AB — the grid reflects it
    expect(screen.getByTestId('pipeline-grid').querySelector('caption')?.textContent)
      .toContain('filter')
  })

  it('4. the generated-query pane shows the declarative pipeline, GOVERNED nouns only', () => {
    const head: SourceStep = { op: 'source', metrics: ['B1G'], where: { geo: 'GE' } }
    const model = toWorkbenchModel({
      type: 'pipeline',
      pipe: [head, { op: 'sort', by: 'value', dir: 'asc' } as never],
      encoding: { label: 'label' },
    })!
    render(<GeneratedQueryPane model={model} locale="en" />)
    const region = screen.getByTestId('generated-query')
    // governed nouns present …
    expect(region.textContent).toContain('Gross Domestic Product')
    expect(region.textContent).toContain('Region')
    // … and NO raw code / member value in the author plane (FF-AUTHOR-NO-QUERY)
    expect(region.textContent).not.toContain('B1G')
    expect(region.textContent).not.toContain('geo')
    // the pipe is mirrored: Get + the sort step
    expect(screen.getAllByTestId('gq-step').map((s) => s.getAttribute('data-op')))
      .toEqual(['source', 'sort'])
  })

  it('binding stays a `pipeline` when re-binding an existing spine (multi-series append)', () => {
    const first = bindMeasureToSpec(undefined, 'B1G')
    const second = bindMeasureToSpec(first, 'B1GQ')
    expect(second.type).toBe('pipeline')
    const head = (second as Extract<DataSpec, { type: 'pipeline' }>).pipe[0]
    expect(head).toHaveProperty('metrics', ['B1G', 'B1GQ'])
  })
})
