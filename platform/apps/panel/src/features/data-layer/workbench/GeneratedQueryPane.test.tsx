// ── GeneratedQueryPane tests (W-P2 · SPEC §3.3 / §3.4 / §9 E4) ─────────────────────
//
//  The plane law, live: the AUTHOR sees a governed declarative rendering and NO wire
//  truth; the STEWARD additionally sees the raw DataSpec JSON + lowered ObsQuery. The
//  governed-vs-raw invariant is asserted against a seeded governed catalog.
//
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { GeneratedQueryPane } from './GeneratedQueryPane'
import { useMetricCatalogStore } from '../../../discovery/metricCatalog.store'
import { useRoleStore } from '../../../studio/useRole'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

const RAW_MEMBER = 'GE'
const spec: QuerySpec = {
  type:  'query',
  query: { measure: 'm.gdp', filter: { REGION: RAW_MEMBER } },
  pipe:  [{ op: 'filter', where: { REGION: RAW_MEMBER } } as never],
  encoding: { label: 'label' },
}

// Seed the governed catalog so the resolver maps value→governed label, REGION→'Region'.
const metrics: Record<string, MetricDef> = {
  'm.gdp': { label: { en: 'Gross Domestic Product', ka: 'მშპ' } } as never,
}
const dimensions = {
  region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' } },
} as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'author' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
  useRoleStore.setState({ role: 'author' })
})

describe('GeneratedQueryPane — the AUTHOR plane (governed, no wire truth)', () => {
  it('renders each step of the pipe (mirrors the pipe: Get + filter)', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    const steps = screen.getAllByTestId('gq-step')
    expect(steps).toHaveLength(2)
    expect(steps[0]).toHaveAttribute('data-op', 'source')
    expect(steps[1]).toHaveAttribute('data-op', 'filter')
  })

  it('speaks GOVERNED nouns — the metric + dim by their labels, never raw codes', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    const region = screen.getByTestId('generated-query')
    expect(region.textContent).toContain('Gross Domestic Product')
    expect(region.textContent).toContain('Region')
    // never a raw member value / raw dim code in the AUTHOR plane (FF-AUTHOR-NO-QUERY)
    expect(region.textContent).not.toContain(RAW_MEMBER)
    expect(region.textContent).not.toContain('REGION')
    expect(region.textContent).not.toContain('m.gdp')
  })

  it('shows NO wire truth to the author (no steward JSON / ObsQuery blocks)', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    expect(screen.queryByTestId('gq-steward')).toBeNull()
    expect(screen.queryByTestId('gq-json')).toBeNull()
    expect(screen.queryByTestId('gq-obsquery')).toBeNull()
  })

  it('is a labelled region (WCAG Law 9)', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    expect(screen.getByRole('region', { name: 'Generated query' })).toBeInTheDocument()
  })
})

describe('GeneratedQueryPane — the STEWARD plane (adds the wire truth)', () => {
  beforeEach(() => { useRoleStore.setState({ role: 'steward' }) })

  it('adds the raw DataSpec JSON + lowered ObsQuery (the raw codes appear HERE)', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    expect(screen.getByTestId('gq-steward')).toBeInTheDocument()
    // the raw member the author never saw is present in the steward JSON
    expect(screen.getByTestId('gq-json').textContent).toContain(RAW_MEMBER)
    expect(screen.getByTestId('gq-obsquery')).toBeInTheDocument()
  })

  it('the author-plane steps STILL speak governed nouns (steward is additive, not a swap)', () => {
    render(<GeneratedQueryPane spec={spec} locale="en" />)
    expect(screen.getAllByTestId('gq-step')[0].textContent).toContain('Gross Domestic Product')
  })
})
