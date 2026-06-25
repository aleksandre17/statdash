// @vitest-environment node
//
// ── Fitness: ONE shared 'stats' store-builder, both apps register it (G3.0) ──
//
//  SSOT gate for the G3 live-data preview. The 'stats' store-builder used to be
//  duplicated in apps/geostat; it now lives ONCE in @statdash/plugins/datasources
//  so BOTH the geostat runner AND the panel Constructor boot the SAME builder
//  without either app importing the other (Law 3 / dependency arrow).
//
//  This test pins:
//    1. Before any boot, 'stats' is NOT registered (the registry is a clean seam).
//    2. registerStoreBuilders() — the shared boot fn both apps call — makes the
//       'stats' kind registered + reachable via buildStoreManifest's registry.
//    3. The registration is idempotent: a second call (e.g. runner + panel both
//       booting in one process, or StrictMode/HMR re-runs) keeps exactly one
//       'stats' kind — no divergence, no duplicate.
//    4. The builder is NOT invoked here (no network): registeredKinds() proves
//       reachability via the same _registry buildStoreManifest reads.
//
//  buildStoreManifest([]) is asserted to stay a safe no-op so the empty-store
//  preview mode (ADR G3 invariant) never trips the registry.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  registeredKinds,
  buildStoreManifest,
  getStoreCapabilities,
  getSourceMetadata,
  testSource,
} from '@statdash/react/engine'
import { registerStoreBuilders } from './index'

describe('shared stats store-builder (G3.0 SSOT)', () => {
  it("does not register 'stats' until the shared boot fn runs", () => {
    // Module-load side effects must be ZERO — registration is explicit (a boot
    // call), never a top-level import side effect. The runner and the panel each
    // decide when to register; importing the module must not register for them.
    expect(registeredKinds()).not.toContain('stats')
  })

  it("registerStoreBuilders() registers a reachable 'stats' kind", () => {
    registerStoreBuilders()
    expect(registeredKinds()).toContain('stats')
  })

  it('is idempotent — both apps booting it keeps exactly one stats kind', () => {
    registerStoreBuilders()
    registerStoreBuilders()
    const stats = registeredKinds().filter((k) => k === 'stats')
    expect(stats).toHaveLength(1)
  })

  it('buildStoreManifest([]) stays a safe no-op (empty-store preview mode)', async () => {
    await expect(buildStoreManifest([])).resolves.toEqual({})
  })
})

// ── M2 — stats authoring capabilities (getMetadata / testConnection) ──────────
//
//  The 'stats' kind's authoring capabilities go over the network (the cube is
//  live). We stub fetch with the exact { data } envelope the cube-profile +
//  datasets routes emit and assert the SourceMetadata mapping + test result.
describe("'stats' authoring capabilities — getMetadata / testConnection", () => {
  afterEach(() => vi.restoreAllMocks())

  function stubFetch(handler: (url: string) => unknown): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve({
        ok:   true,
        json: () => Promise.resolve({ data: handler(String(input)) }),
        headers: { get: () => null },
      } as unknown as Response),
    )
  }

  it('registers both authoring capabilities for the stats kind', () => {
    registerStoreBuilders()
    const caps = getStoreCapabilities('stats')
    expect(typeof caps.getMetadata).toBe('function')
    expect(typeof caps.testConnection).toBe('function')
  })

  it('getMetadata maps the cube-profile to dims/measures', async () => {
    registerStoreBuilders()
    stubFetch((url) => {
      if (url.includes('/api/cube/') && url.includes('/profile')) {
        return {
          datasetCode: 'NAT',
          dimensions:  [{ code: 'geo', conceptRole: 'REF_AREA' }, { code: 'sector', conceptRole: null }],
          measures:    [{ code: 'GDP', label: { en: 'Gross Domestic Product' } }],
        }
      }
      throw new Error(`unexpected url ${url}`)
    })

    const md = await getSourceMetadata({ id: 's', kind: 'stats', params: { datasetCode: 'NAT' } })
    expect(md?.kind).toBe('stats')
    expect(md?.dimensions.map((d) => d.code)).toEqual(['geo', 'sector'])
    expect(md?.measures[0]).toMatchObject({ code: 'GDP', label: 'Gross Domestic Product' })
  })

  it('testConnection reports ok when the dataset resolves', async () => {
    registerStoreBuilders()
    stubFetch((url) => {
      if (url.includes('/api/stats/datasets/')) {
        return { code: 'NAT', label: 'National Accounts', version: 'v1', preliminary: false, dimensions: [] }
      }
      throw new Error(`unexpected url ${url}`)
    })
    const res = await testSource({ id: 's', kind: 'stats', params: { datasetCode: 'NAT' } })
    expect(res?.ok).toBe(true)
  })

  it('testConnection reports not-ok with no datasetCode (pick a cube)', async () => {
    registerStoreBuilders()
    const res = await testSource({ id: '', kind: 'stats', params: {} })
    expect(res?.ok).toBe(false)
  })
})
