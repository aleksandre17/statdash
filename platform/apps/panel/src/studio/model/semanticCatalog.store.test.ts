// ── semanticCatalog.store — the editable working-copy tests (M2.2) ─────────────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ManifestMetric } from '@statdash/contracts'

const fetchCatalogManifest = vi.fn()
vi.mock('../../store/bootstrapCatalog', () => ({ fetchCatalogManifest: () => fetchCatalogManifest() }))

import { useSemanticCatalogStore } from './semanticCatalog.store'

const M = (id: string): ManifestMetric => ({ id, code: id.toUpperCase(), label: { en: id } })

beforeEach(() => {
  useSemanticCatalogStore.setState({ status: 'idle', metrics: [], dimensions: [], dirty: false, message: undefined })
  fetchCatalogManifest.mockReset()
})

describe('semanticCatalog.store — hydration (idempotent, fail-soft)', () => {
  it('ensure() hydrates the editable copy from the bootstrap channel', async () => {
    fetchCatalogManifest.mockResolvedValue({ metrics: [M('gdp_level')], dimensions: [] })
    useSemanticCatalogStore.getState().ensure()
    await vi.waitFor(() => expect(useSemanticCatalogStore.getState().status).toBe('ready'))
    expect(useSemanticCatalogStore.getState().metrics.map((m) => m.id)).toEqual(['gdp_level'])
    expect(useSemanticCatalogStore.getState().dirty).toBe(false)
  })

  it('ensure() is a no-op once ready (one fetch)', async () => {
    fetchCatalogManifest.mockResolvedValue({ metrics: [], dimensions: [] })
    useSemanticCatalogStore.getState().ensure()
    await vi.waitFor(() => expect(useSemanticCatalogStore.getState().status).toBe('ready'))
    useSemanticCatalogStore.getState().ensure()
    expect(fetchCatalogManifest).toHaveBeenCalledTimes(1)
  })

  it('a fetch fault degrades to error with an empty-but-usable working set (never a crash)', async () => {
    fetchCatalogManifest.mockRejectedValue(new Error('offline'))
    useSemanticCatalogStore.getState().ensure()
    await vi.waitFor(() => expect(useSemanticCatalogStore.getState().status).toBe('error'))
    expect(useSemanticCatalogStore.getState().metrics).toEqual([])
  })
})

describe('semanticCatalog.store — editing (create + edit converge on upsert)', () => {
  it('upsertMetric appends a new metric and marks dirty', () => {
    useSemanticCatalogStore.getState().upsertMetric(M('gdp_level'))
    expect(useSemanticCatalogStore.getState().metrics.map((m) => m.id)).toEqual(['gdp_level'])
    expect(useSemanticCatalogStore.getState().dirty).toBe(true)
  })

  it('upsertMetric replaces an existing metric by id in place (order preserved)', () => {
    useSemanticCatalogStore.setState({ metrics: [M('a'), M('b')], status: 'ready' })
    useSemanticCatalogStore.getState().upsertMetric({ id: 'a', code: 'X', label: { en: 'A2' } })
    const ids = useSemanticCatalogStore.getState().metrics.map((m) => m.id)
    expect(ids).toEqual(['a', 'b'])
    expect(useSemanticCatalogStore.getState().metrics[0].label).toEqual({ en: 'A2' })
  })

  it('removeMetric drops by id; markSaved clears dirty', () => {
    useSemanticCatalogStore.setState({ metrics: [M('a'), M('b')] })
    useSemanticCatalogStore.getState().removeMetric('a')
    expect(useSemanticCatalogStore.getState().metrics.map((m) => m.id)).toEqual(['b'])
    useSemanticCatalogStore.getState().markSaved()
    expect(useSemanticCatalogStore.getState().dirty).toBe(false)
  })
})
