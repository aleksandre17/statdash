// ── DataDictionarySurface — the author-lens READ-ONLY data model view (AR-50 M5b) ─
//
//  Item behaviour: renders the governed catalog (metrics grouped by source + their
//  provenance, dimensions, sources) as a browsable READ-ONLY dictionary — no bind, no
//  edit, no query machinery. Search filters it; non-ready states degrade to
//  informative text (never a crash). A11y: a labelled region, section headings, lists.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { MetricDef } from '@statdash/engine'
import type { MetricCatalog } from '../../discovery/useMetricCatalog'
import type { CatalogDimension } from '../../discovery/semanticCatalogOptions'

// Read through the hook; mock it so status transitions are deterministic (mirrors the
// MetricPalette test — the live describeApp() load is covered by the store's own tests).
let mockCatalog: MetricCatalog = { status: 'idle' }
vi.mock('../../discovery/useMetricCatalog', () => ({ useMetricCatalog: () => mockCatalog }))

import { DataDictionarySurface } from './DataDictionarySurface'

const metrics: Record<string, MetricDef> = {
  'gdp.level':      { code: 'B1GQ',    label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, format: 'mln_gel', dataSource: 'stats', methodology: 'https://geostat.ge/methodology' },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { ka: 'მშპ · ზრდა', en: 'GDP · growth' }, dataSource: 'stats' },
  'pop.total':      { code: 'POP',     label: { ka: 'მოსახლეობა', en: 'Population' }, dataSource: 'demo' },
}
const dimensions: Record<string, CatalogDimension> = {
  time: { code: 'TIME_PERIOD', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' },
}

beforeEach(() => { mockCatalog = { status: 'ready', metrics, dimensions } })

describe('DataDictionarySurface — read-only browse', () => {
  it('renders a labelled region with governed metrics, dimensions and sources', () => {
    render(<DataDictionarySurface locale="en" />)
    expect(screen.getByRole('region', { name: 'Data dictionary' })).toBeInTheDocument()
    expect(screen.getByTestId('dict-metric-gdp.level')).toHaveTextContent('GDP')
    expect(screen.getByTestId('dict-metric-gdp.level')).toHaveTextContent('mln GEL')
    expect(screen.getByTestId('dict-dimension-time')).toHaveTextContent('Period')
    // Sources are the distinct dataSource groups, derived read-only.
    expect(screen.getByTestId('dict-source-stats')).toBeInTheDocument()
    expect(screen.getByTestId('dict-source-demo')).toBeInTheDocument()
  })

  it('surfaces each metric’s provenance (id, code, format, methodology link) read-only', () => {
    render(<DataDictionarySurface locale="en" />)
    const tile = screen.getByTestId('dict-metric-gdp.level')
    expect(tile).toHaveTextContent('B1GQ')      // underlying SDMX code
    expect(tile).toHaveTextContent('mln_gel')   // display format key
    expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute('href', 'https://geostat.ge/methodology')
  })

  it('search filters the dictionary by label / id / code', () => {
    render(<DataDictionarySurface locale="en" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the data model' }), { target: { value: 'popul' } })
    expect(screen.getByTestId('dict-metric-pop.total')).toBeInTheDocument()
    expect(screen.queryByTestId('dict-metric-gdp.level')).not.toBeInTheDocument()
  })

  it('offers NO bind / edit affordance — the tiles are not buttons (read-only discovery)', () => {
    render(<DataDictionarySurface locale="en" />)
    // A metric entry is a plain container, never an actionable <button> (contrast the
    // MetricPalette, whose tiles ARE buttons). The author cannot mutate anything here.
    expect(screen.getByTestId('dict-metric-gdp.level').tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button', { name: /New metric|Create|Edit metric/i })).toBeNull()
  })

  it('degrades to an informative hint (no crash) when the catalog errors', () => {
    mockCatalog = { status: 'error', message: 'boom' }
    render(<DataDictionarySurface locale="en" />)
    expect(screen.getByTestId('data-dictionary-status')).toHaveTextContent('boom')
    expect(screen.queryByTestId('dict-metric-gdp.level')).not.toBeInTheDocument()
  })
})
