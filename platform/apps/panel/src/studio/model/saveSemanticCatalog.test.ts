// ── saveSemanticCatalog — persistence payload + the LIVE-refresh loop (M2.2) ────
//
//  Proves the spec §5 round-trip WITHOUT a reload: (1) the PUT carries exactly
//  { metrics, dimensions } (targeted key-upsert, saveSite untouched); (2) on success
//  the engine registry is re-registered and the palette read is invalidated, so
//  describeApp() — the source the Author's MetricPalette reads — reflects the new
//  metric immediately. This is the "author it as steward → it is in the palette" loop.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ManifestMetric } from '@statdash/contracts'

// Partial-mock the api client: real ApiError, mocked site.update.
const siteUpdate = vi.hoisted(() => vi.fn(async (b: unknown) => b))
vi.mock('../../lib/api', async (orig) => {
  const actual = await orig<typeof import('../../lib/api')>()
  return { ...actual, configApi: { ...actual.configApi, site: { ...actual.configApi.site, update: siteUpdate } } }
})

import { ApiError } from '../../lib/api'
import { describeApp } from '@statdash/react/engine'
import { useSemanticCatalogStore } from './semanticCatalog.store'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { saveSemanticCatalog } from './saveSemanticCatalog'

const GDP: ManifestMetric = {
  id: 'gdp_level', code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' },
  unit: { ka: 'მლნ ₾', en: 'mln GEL' }, format: 'mln_gel', dataSource: 'stats',
}

beforeEach(() => {
  siteUpdate.mockClear()
  useSemanticCatalogStore.setState({ status: 'ready', metrics: [GDP], dimensions: [], dirty: true })
  useMetricCatalogStore.getState().invalidate()
})

describe('saveSemanticCatalog — persistence payload (ISP: distinct from saveSite)', () => {
  it('PUTs exactly { metrics, dimensions } from the working copy', async () => {
    const res = await saveSemanticCatalog()
    expect(res.ok).toBe(true)
    expect(siteUpdate).toHaveBeenCalledTimes(1)
    expect(siteUpdate).toHaveBeenCalledWith({ metrics: [GDP], dimensions: [] })
    // No identity/theme keys leaked into the catalog save.
    const payload = siteUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['dimensions', 'metrics'])
  })

  it('marks the working copy clean after a successful PUT', async () => {
    await saveSemanticCatalog()
    expect(useSemanticCatalogStore.getState().dirty).toBe(false)
  })
})

describe('saveSemanticCatalog — the LIVE loop (author sees it, no reload)', () => {
  it('re-registers the catalog + invalidates the palette so describeApp reflects it', async () => {
    await saveSemanticCatalog()

    // The palette read was invalidated (forces a fresh describeApp read).
    expect(useMetricCatalogStore.getState().catalog.status).toBe('idle')

    // describeApp() — the exact source MetricPalette reads — now carries the metric,
    // refined byte-identically to a provisioned one (label/code/unit/format).
    const registered = describeApp().metrics['gdp_level']
    expect(registered).toBeDefined()
    expect(registered.code).toBe('B1GQ')
    expect(registered.unit).toEqual({ ka: 'მლნ ₾', en: 'mln GEL' })
    expect(registered.format).toBe('mln_gel')

    // Re-loading the palette store surfaces it (what the Author's palette renders).
    useMetricCatalogStore.getState().load()
    const catalog = useMetricCatalogStore.getState().catalog
    expect(catalog.status).toBe('ready')
    if (catalog.status === 'ready') expect(catalog.metrics['gdp_level']).toBeDefined()
  })
})

describe('saveSemanticCatalog — fail-soft', () => {
  it('surfaces a 403 as forbidden (needs a catalog-authoring token) without throwing', async () => {
    siteUpdate.mockRejectedValueOnce(new ApiError(403, 'nope'))
    const res = await saveSemanticCatalog()
    expect(res).toMatchObject({ ok: false, forbidden: true })
  })

  it('surfaces a generic fault as an inline error (no throw)', async () => {
    siteUpdate.mockRejectedValueOnce(new Error('offline'))
    const res = await saveSemanticCatalog()
    expect(res.ok).toBe(false)
    expect(res.error).toBe('offline')
  })
})
