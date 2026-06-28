// @vitest-environment node
//
// ── FF-METRIC-PROVENANCE-FLOWS — the LIVE end-to-end consumer assertion ───────
//
//  The semantic-layer delivery (commit 0c86578) gave registered MetricDefs a
//  real unit/methodology, and the engine seam `withMetricProvenance` exists to
//  surface them — but until the stats store-builder installed that decorator the
//  capability had NO live consumer (a Law-4 cathedral-without-a-congregation:
//  unit/methodology reached the engine REGISTRY but never a rendered badge).
//
//  The engine tier already unit-locks the decorator in isolation
//  (packages/core metric-binding.fitness.test.ts) and the delivery tier locks
//  the manifest→registry flow (apps/geostat metric-delivery.fitness.test.ts).
//  THIS suite locks the MISSING middle: a metric-id's delivered governance
//  reaches the MetadataPort of the ACTUAL store the shared 'stats' builder
//  produces — i.e. the exact `store.metadata?.provenance(code, ctx)` seam the
//  React badge layer (resolvePreliminary / the panel-title provenance
//  affordance) reads at render. Build the live store via buildStoreManifest, the
//  same path both the geostat runner and the Constructor preview use; assert the
//  congregation is real.
//
//  Network is stubbed at the one HTTP boundary (fetch). The builder reads dataset
//  meta + cube profile behind `.catch`, so a minimal stub is enough; nonTimeDims
//  is empty so NO classifier endpoints are hit.
//
//  Registry is process-global + last-write-wins; every fixture metric-id is
//  prefixed `ff:` so it can never collide with a raw SDMX code or a real catalog
//  id, and the underlying measure codes are `*_FF` so no real cube code is shadowed.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { buildStoreManifest } from '@statdash/react/engine'
import { registerMetric } from '@statdash/engine'
import type { SectionContext } from '@statdash/engine'
import { registerStoreBuilders } from './index'

const ctx: SectionContext = { dims: { time: 2024, geo: 'GE' } }

// Stub the one HTTP boundary. `preliminary` toggles the dataset-level signal so
// the precedence half (cube status WINS, metric unit FILLS) can be exercised.
function stubStatsFetch(opts: { preliminary?: boolean } = {}): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input)
    let body: unknown
    if (url.includes('/api/stats/datasets/')) {
      body = { code: 'NAT_FF', label: 'National Accounts', version: 'v2024', preliminary: !!opts.preliminary, dimensions: [] }
    } else if (url.includes('/api/cube/') && url.includes('/profile')) {
      body = { datasetCode: 'NAT_FF', dimensions: [], measures: [], timeCoverage: { periods: [] } }
    } else {
      body = []
    }
    return Promise.resolve({
      ok:      true,
      json:    () => Promise.resolve({ data: body }),
      headers: { get: () => null },
    } as unknown as Response)
  })
}

/** Build the LIVE 'stats' store the shared builder produces (CachedStore→ApiStore). */
async function buildStatsStore() {
  registerStoreBuilders()
  const stores = await buildStoreManifest([
    { id: 'accounts', kind: 'stats', url: 'http://x', params: { datasetCode: 'NAT_FF', nonTimeDims: [] } },
  ])
  return stores['accounts']
}

describe('FF-METRIC-PROVENANCE-FLOWS — delivered governance reaches the live store badge seam', () => {
  beforeEach(() => {
    // A SYNTHETIC metric carrying both unit + methodology (the real catalog omits
    // methodology — proven below — so this exercises the methodology half too).
    registerMetric('ff:gdp', {
      code:        'B1G_FF',
      label:       { ka: 'მშპ', en: 'GDP' },
      unit:        { ka: 'მლნ ლარი', en: 'Million Georgian Lari' },
      methodology: 'https://example.org/methodology/gdp',
    })
    // A REAL-SHAPED metric mirroring a delivered one (accounts.gdp → B1G, unit
    // Million GEL, NO methodology) so the assertion is anchored to the actual
    // semantic layer that shipped, not only to a synthetic fixture.
    registerMetric('ff:accounts.gdp', {
      code:  'B1G_REAL_FF',
      label: { ka: 'მთლიანი შიდა პროდუქტი საბაზრო ფასებში', en: 'Gross Domestic Product at market prices' },
      unit:  { ka: 'მლნ ლარი', en: 'Million Georgian Lari' },
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it("the built store's MetadataPort surfaces a delivered metric's unit + methodology by underlying code", async () => {
    stubStatsFetch()
    const store = await buildStatsStore()

    // The exact call the React badge layer makes: store.metadata?.provenance(measure, sectionCtx).
    const prov = store.metadata?.provenance('B1G_FF', ctx)
    expect(prov?.unit).toEqual({ ka: 'მლნ ლარი', en: 'Million Georgian Lari' })
    expect(prov?.methodology).toBe('https://example.org/methodology/gdp')
  })

  it("a real-shaped delivered metric (unit, no methodology) surfaces its unit through the live port", async () => {
    stubStatsFetch()
    const store = await buildStatsStore()

    const prov = store.metadata?.provenance('B1G_REAL_FF', ctx)
    expect(prov?.unit).toEqual({ ka: 'მლნ ლარი', en: 'Million Georgian Lari' })
    // methodology is absent in the delivered seed — must NOT be fabricated.
    expect(prov?.methodology).toBeUndefined()
  })

  it('composes with the dataset signal: cube `preliminary` status WINS, metric unit FILLS', async () => {
    stubStatsFetch({ preliminary: true })
    const store = await buildStatsStore()

    const prov = store.metadata?.provenance('B1G_FF', ctx)
    // Dataset-wide signal (drives the preliminary badge) is preserved…
    expect(prov?.status).toBe('p')
    expect(prov?.vintage).toBe('v2024')
    // …AND the metric default fills the unit the cube does not carry.
    expect(prov?.unit).toEqual({ ka: 'მლნ ლარი', en: 'Million Georgian Lari' })
  })

  it('Postel: a raw code with no registered metric and a non-preliminary cube yields no provenance (byte-identical)', async () => {
    stubStatsFetch({ preliminary: false })
    const store = await buildStatsStore()

    // No metric matches RAW_FF, and the cube is not preliminary ⇒ the port returns
    // undefined exactly as the pre-wiring status quo did (additive, no regression).
    expect(store.metadata?.provenance('RAW_FF', ctx)).toBeUndefined()
  })
})
