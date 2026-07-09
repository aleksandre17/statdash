// ── MetricCatalogManager — list + delete-guard governance (M2.2, spec §6.4) ────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ManifestMetric } from '@statdash/contracts'

// Control the blast-radius index + the save round-trip deterministically.
const computeMetricImpact = vi.hoisted(() => vi.fn())
const saveSemanticCatalog = vi.hoisted(() => vi.fn(async () => ({ ok: true })))
vi.mock('./metricImpact', () => ({ computeMetricImpact }))
vi.mock('./saveSemanticCatalog', () => ({ saveSemanticCatalog }))
vi.mock('../../store/constructor.selectors', () => ({ usePages: () => [] }))

import { useSemanticCatalogStore } from './semanticCatalog.store'
import { MetricCatalogManager } from './MetricCatalogManager'

const GDP: ManifestMetric = { id: 'gdp_level', code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' } }
const LOCALES = ['ka', 'en'] as const

beforeEach(() => {
  computeMetricImpact.mockReset()
  saveSemanticCatalog.mockClear()
  useSemanticCatalogStore.setState({ status: 'ready', metrics: [GDP], dimensions: [], dirty: false })
})

describe('MetricCatalogManager — list', () => {
  it('renders the governed metrics with edit/delete affordances', () => {
    computeMetricImpact.mockReturnValue({ blocks: 0, pages: [] })
    render(<MetricCatalogManager locale="en" locales={[...LOCALES]} />)
    expect(screen.getByRole('region', { name: 'Governed metric catalog' })).toBeInTheDocument()
    expect(screen.getByText('GDP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit gdp_level' })).toBeInTheDocument()
  })
})

describe('MetricCatalogManager — delete-guard (referenced metric protected)', () => {
  it('BLOCKS deleting a referenced metric and names the consumers (no save)', () => {
    computeMetricImpact.mockReturnValue({ blocks: 2, pages: [{ id: 'p1', title: 'Overview' }] })
    render(<MetricCatalogManager locale="en" locales={[...LOCALES]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete gdp_level' }))
    expect(screen.getByText(/Cannot delete "gdp_level"/)).toHaveTextContent('Overview')
    expect(saveSemanticCatalog).not.toHaveBeenCalled()
  })

  it('ALLOWS deleting an unreferenced metric (save runs)', async () => {
    computeMetricImpact.mockReturnValue({ blocks: 0, pages: [] })
    render(<MetricCatalogManager locale="en" locales={[...LOCALES]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete gdp_level' }))
    await waitFor(() => expect(saveSemanticCatalog).toHaveBeenCalledTimes(1))
    expect(useSemanticCatalogStore.getState().metrics).toEqual([])
  })
})
