// ── PipelineDataGrid component tests (W-P1 · SPEC §3.2 / §3.5) ─────────────────
//
//  The declared states of the WCAG live grid: loading DISTINCT from empty (async
//  trap #10), honest '—' for no-data (never a fake 0 — Law 11), governed headers,
//  a caption naming the step, and the honest capped-count note.
//
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { EngineRow } from '@statdash/engine'
import { PipelineDataGrid } from './PipelineDataGrid'

const identity = (f: string) => f
const base = {
  total: 0, capped: false, columns: [] as string[],
  columnLabel: identity, caption: 'Get: GDP', locale: 'en',
}

describe('PipelineDataGrid — declared states', () => {
  it('loading is a DISTINCT busy state, not the empty affordance', () => {
    render(<PipelineDataGrid {...base} status="loading" rows={[]} />)
    const note = screen.getByTestId('pipeline-grid-loading')
    expect(note).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('pipeline-grid-empty')).toBeNull()
    expect(screen.queryByTestId('pipeline-grid')).toBeNull()
  })

  it('ok + zero rows → the honest empty note (distinct from loading)', () => {
    render(<PipelineDataGrid {...base} status="ok" rows={[]} />)
    expect(screen.getByTestId('pipeline-grid-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-grid-loading')).toBeNull()
  })

  it('unbound → the browse hint (pick a metric)', () => {
    render(<PipelineDataGrid {...base} status="unbound" rows={[]} />)
    expect(screen.getByTestId('pipeline-grid-unbound')).toBeInTheDocument()
  })

  it('unavailable → the honest live-unavailable note', () => {
    render(<PipelineDataGrid {...base} status="unavailable" rows={[]} />)
    expect(screen.getByTestId('pipeline-grid-unavailable')).toBeInTheDocument()
  })
})

describe('PipelineDataGrid — the data table (honest, governed, WCAG)', () => {
  const rows: EngineRow[] = [
    { time: 2020, geo: 'GE', value: 0 },       // a genuine 0 — must render "0"
    { time: 2020, geo: 'AB', value: null as never }, // no-data — must render "—"
  ]
  const columns = ['time', 'geo', 'value']
  const govern = (f: string) =>
    f === 'value' ? 'Gross Domestic Product' : f === 'geo' ? 'Region' : f

  it('renders a table with a caption naming the current step', () => {
    render(
      <PipelineDataGrid
        {...base} status="ok" rows={rows} total={2} columns={columns}
        columnLabel={govern} caption="Step 1: filter"
      />,
    )
    const table = screen.getByTestId('pipeline-grid').querySelector('table')!
    expect(table.querySelector('caption')?.textContent).toBe('Step 1: filter')
  })

  it('column headers speak GOVERNED nouns (scope=col), never raw codes', () => {
    render(
      <PipelineDataGrid
        {...base} status="ok" rows={rows} total={2} columns={columns} columnLabel={govern}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual(['time', 'Region', 'Gross Domestic Product'])
    headers.forEach((h) => expect(h).toHaveAttribute('scope', 'col'))
  })

  it('a genuine 0 renders "0"; a null renders the honest "—", never a fake 0', () => {
    render(
      <PipelineDataGrid
        {...base} status="ok" rows={rows} total={2} columns={columns} columnLabel={govern}
      />,
    )
    const bodyRows = screen.getByTestId('pipeline-grid').querySelectorAll('tbody tr')
    expect(within(bodyRows[0] as HTMLElement).getByText('0')).toBeInTheDocument()
    const noData = (bodyRows[1] as HTMLElement).querySelector('[data-cell-state="no-data"]')!
    expect(noData.textContent).toBe('—')
  })

  it('an over-cap read shows the honest "showing N of M" note', () => {
    render(
      <PipelineDataGrid
        {...base} status="ok" rows={rows} total={4812} capped columns={columns} columnLabel={govern}
      />,
    )
    expect(screen.getByTestId('pipeline-grid-count').textContent).toBe('Showing 2 of 4812 rows')
  })
})
