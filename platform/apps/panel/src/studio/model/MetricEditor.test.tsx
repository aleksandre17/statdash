// ── MetricEditor — a11y, id-immutability, save-gating, pure output (M2.2) ──────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ManifestMetric } from '@statdash/contracts'
import type { CubeProfile } from '../../lib/cubeApi'

vi.mock('../../lib/cubeApi', async (orig) => {
  const actual = await orig<typeof import('../../lib/cubeApi')>()
  return {
    ...actual,
    cubeApi: { ...actual.cubeApi, datasets: vi.fn(async () => [{ code: 'stats', label: 'Stats' }]), profile: vi.fn(async () => PROFILE) },
  }
})

import { useCubeProfileStore } from '../../discovery/cubeProfile.store'
import { MetricEditor } from './MetricEditor'

const PROFILE: CubeProfile = {
  datasetCode: 'stats',
  measures: [{ code: 'B1GQ', label: { en: 'GDP', ka: 'მშპ' }, unit: { unit_code: 'GEL', symbol: '₾', label: { en: 'mln GEL', ka: 'მლნ ₾' }, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'measure' } }],
  dimensions: [{ code: 'ADJUSTMENT', conceptRole: null, isTime: false, members: [{ code: 'S', label: { en: 'SA' }, parentCode: null }] }],
  actualRegion: { available: false, combinations: null },
}

const EXISTING: ManifestMetric = { id: 'gdp_level', code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, dataSource: 'stats' }
const LOCALES = ['ka', 'en'] as const

beforeEach(() => {
  useCubeProfileStore.setState({ byCode: { stats: { status: 'ready', profile: PROFILE } } })
})

describe('MetricEditor — accessibility (Law 9)', () => {
  it('is a labelled form with a labelled, required id control', () => {
    render(<MetricEditor initial={null} existingIds={[]} locales={[...LOCALES]} locale="en" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('form', { name: 'Metric editor' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Metric id/)).toBeRequired()
  })
})

describe('MetricEditor — id immutability (FF-ID-IMMUTABLE)', () => {
  it('disables the id control when editing an existing metric', () => {
    render(<MetricEditor initial={EXISTING} existingIds={['gdp_level']} locales={[...LOCALES]} locale="en" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/Metric id/)).toBeDisabled()
  })
  it('allows editing the id when creating a new metric', () => {
    render(<MetricEditor initial={null} existingIds={[]} locales={[...LOCALES]} locale="en" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/Metric id/)).toBeEnabled()
  })
})

describe('MetricEditor — save gating + pure output', () => {
  it('disables Save for an incomplete new metric', () => {
    render(<MetricEditor initial={null} existingIds={[]} locales={[...LOCALES]} locale="en" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Create metric' })).toBeDisabled()
  })

  it('enables Save for a valid edit and emits a PURE ManifestMetric', () => {
    const onSave = vi.fn<(m: ManifestMetric) => void>()
    render(<MetricEditor initial={EXISTING} existingIds={['gdp_level']} locales={[...LOCALES]} locale="en" onSave={onSave} onCancel={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledTimes(1)
    const emitted = onSave.mock.calls[0][0]
    expect(emitted.id).toBe('gdp_level')            // id preserved (immutable)
    // Pure data — a function-free JSON round-trip (Law 2 / FF-METRIC-AUTHORING-SERIALIZABLE).
    expect(JSON.parse(JSON.stringify(emitted))).toEqual(emitted)
  })
})
