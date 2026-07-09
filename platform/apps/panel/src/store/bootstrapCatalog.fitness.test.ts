// ── FF-PANEL-CATALOG-BOOT-PARITY — the authoring boot primes the SAME channels ──
//
//  Gap A regression guard. The MetricPalette + governed enum-ref controls read the
//  catalog from the engine's process-global registry via describeApp(). That
//  registry is ONLY populated by a boot that registers the manifest's metrics AND
//  dimensions — the geostat runner does this in bootstrapSite(); the panel did not,
//  so a live palette showed its empty state despite 2675 green tests (every test
//  registered the catalog manually, masking the missing boot path).
//
//  This asserts the panel's OWN boot path (bootstrapCatalog) — not a manual
//  per-test registerMetrics — lands BOTH channels in describeApp(). Reverting the
//  fix (removing either registerManifest* call, or the whole registration) turns
//  this RED. Parity with the runner: it registers metrics + dimensions, so must we.
//
import { describe, it, expect, afterEach, vi } from 'vitest'
import { describeApp } from '@statdash/react/engine'
import { bootstrapCatalog } from './bootstrapCatalog'

// Unique fixture ids so the assertions are robust to any catalog other tests in the
// same worker registered into the shared process-global registry.
const MANIFEST = {
  metrics: [
    { id: 'parity.gdp', code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, dataSource: 'stats' },
  ],
  dimensions: [
    { id: 'parity.region', code: 'REGION', label: { ka: 'რეგიონი', en: 'Region' }, conceptRole: 'geo' },
  ],
}

const stubFetch = (impl: () => Promise<unknown>) =>
  vi.stubGlobal('fetch', vi.fn(impl) as unknown as typeof fetch)

describe('FF-PANEL-CATALOG-BOOT-PARITY', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('registers BOTH the metric and dimension channels so describeApp() is populated', async () => {
    stubFetch(async () => ({ ok: true, json: async () => MANIFEST }))

    const ok = await bootstrapCatalog()
    expect(ok).toBe(true)

    const app = describeApp()
    // Metric channel — Gap A core: the palette's source is populated by the boot.
    expect(app.metrics['parity.gdp']).toBeDefined()
    expect(app.metrics['parity.gdp'].code).toBe('B1GQ')
    // Dimension channel — parity with geostat bootstrapSite() (Law 1: dimensions are
    // equal citizens; reverting registerManifestDimensions must go RED here too).
    expect(app.dimensions['parity.region']).toBeDefined()
    expect(app.dimensions['parity.region'].code).toBe('REGION')
  })

  it('reads the catalog from GET /api/bootstrap (the shared delivery channel)', async () => {
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => MANIFEST }))
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)
    await bootstrapCatalog()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/bootstrap')
  })

  it('honours a { data } envelope (Postel — tolerant of a future shape change)', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ data: {
      metrics: [{ id: 'parity.env', code: 'X', label: { ka: 'ე', en: 'e' } }],
    } }) }))
    await bootstrapCatalog()
    expect(describeApp().metrics['parity.env']).toBeDefined()
  })

  it('is fail-soft when /api/bootstrap is unreachable (returns false, never throws)', async () => {
    stubFetch(async () => { throw new Error('network down') })
    await expect(bootstrapCatalog()).resolves.toBe(false)
  })

  it('is fail-soft on a non-OK response (returns false)', async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await expect(bootstrapCatalog()).resolves.toBe(false)
  })
})
