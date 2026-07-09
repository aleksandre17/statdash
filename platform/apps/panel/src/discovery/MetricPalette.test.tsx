// ── MetricPalette — browsable governed catalog + bind affordance (AR-49 M0) ───
//
//  Item 9 surface behaviour: renders the governed catalog (grouped, bilingual
//  labels + units), search filters it, the click/keyboard path binds ONLY a
//  registered metric-id to the host target (governed — Law 2), and the non-ready
//  states degrade to informative text (never a crash). A11y: labelled region +
//  search, real <button> tiles, a polite status region.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { MetricDef } from '@statdash/engine'
import type { MetricCatalog } from './useMetricCatalog'
import type { CatalogDimension } from './semanticCatalogOptions'

// The palette reads the catalog through this hook; mock it so status transitions
// (ready | error) are deterministic (the live describeApp() load is covered by the
// store's own tests, and would otherwise flip a seeded non-ready state to ready).
let mockCatalog: MetricCatalog = { status: 'idle' }
vi.mock('./useMetricCatalog', () => ({ useMetricCatalog: () => mockCatalog }))

import { MetricPalette } from './MetricPalette'

const metrics: Record<string, MetricDef> = {
  'gdp.level':      { code: 'B1GQ',    label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, dataSource: 'stats' },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { ka: 'მშპ · ზრდა', en: 'GDP · growth' }, dataSource: 'stats' },
  'pop.total':      { code: 'POP',     label: { ka: 'მოსახლეობა', en: 'Population' }, dataSource: 'demo' },
}
const dimensions: Record<string, CatalogDimension> = {}

beforeEach(() => { mockCatalog = { status: 'ready', metrics, dimensions } })

describe('MetricPalette — browse', () => {
  it('renders a labelled region with the governed metrics (label + unit)', () => {
    render(<MetricPalette locale="ka" />)
    expect(screen.getByRole('region', { name: 'მეტრიკების პალიტრა' })).toBeInTheDocument()
    expect(screen.getByTestId('metric-tile-gdp.level')).toHaveTextContent('მშპ')
    expect(screen.getByTestId('metric-tile-gdp.level')).toHaveTextContent('მლნ ₾')
  })

  it('groups metrics by dataSource', () => {
    render(<MetricPalette locale="en" />)
    expect(screen.getByText('stats')).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
  })

  it('search filters the tiles by label', () => {
    render(<MetricPalette locale="en" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'მეტრიკის ძებნა' }), { target: { value: 'popul' } })
    expect(screen.getByTestId('metric-tile-pop.total')).toBeInTheDocument()
    expect(screen.queryByTestId('metric-tile-gdp.level')).not.toBeInTheDocument()
  })
})

describe('MetricPalette — bind affordance (governed, Law 2)', () => {
  it('binds ONLY a registered metric-id on click when a bindable block is selected', () => {
    const onBind = vi.fn<(id: string) => void>()
    render(<MetricPalette locale="ka" canBind onBind={onBind} />)
    fireEvent.click(screen.getByTestId('metric-tile-gdp.realGrowth'))
    expect(onBind).toHaveBeenCalledWith('gdp.realGrowth')
    // The emitted value is a registered id, never free text.
    expect(Object.keys(metrics)).toContain(onBind.mock.calls[0][0])
  })

  it('does not bind when no bindable block is selected (announces the hint)', () => {
    const onBind = vi.fn()
    render(<MetricPalette locale="ka" canBind={false} onBind={onBind} bindHint="აირჩიეთ ბლოკი" />)
    fireEvent.click(screen.getByTestId('metric-tile-gdp.level'))
    expect(onBind).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('აირჩიეთ ბლოკი')
  })

  it('every tile is a keyboard-operable button (a11y — drag is an enhancement)', () => {
    render(<MetricPalette locale="en" canBind onBind={vi.fn()} />)
    const tile = screen.getByTestId('metric-tile-gdp.level')
    expect(tile.tagName).toBe('BUTTON')
  })
})

describe('MetricPalette — graceful degradation', () => {
  it('shows an informative hint (no crash) when the catalog errors', () => {
    mockCatalog = { status: 'error', message: 'boom' }
    render(<MetricPalette locale="ka" />)
    expect(screen.getByTestId('metric-palette-status')).toHaveTextContent('boom')
    expect(screen.queryByTestId('metric-tile-gdp.level')).not.toBeInTheDocument()
  })
})
