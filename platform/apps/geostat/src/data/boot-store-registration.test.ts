// ── boot ordering regression: store-builders registered BEFORE bootstrap ──────
//
//  REGRESSION GUARD (the code-split shipped without this).
//
//  App.tsx runs bootstrapSite() in a useEffect on first mount; bootstrapSite →
//  fetchStores → fetchStoreManifest → buildStoreManifest dispatches every
//  datasource to its registered StoreBuilder and THROWS on an unregistered kind
//  ('No StoreBuilder registered for kind 'stats'…'). The store-builder registry
//  is therefore a dependency CONSUMED at bootstrap, and must be populated by the
//  EAGER boot path (main.tsx → bootRegistrations()) BEFORE App mounts.
//
//  The bundle-split regression moved registerStoreBuilders() into the LAZY
//  ./app/RendererSurface chunk (via setupRegistrations), which React loads only
//  AFTER bootstrap resolves — so the builders were registered too late, every
//  store failed to build, and all charts/tables/maps rendered empty.
//
//  This test reproduces the boot ORDERING WITHOUT loading the lazy renderer
//  chunk (it never imports setupRegistrations / RendererSurface — the very thing
//  that is too late). It asserts that the eager boot seam alone registers the
//  'stats' builder so a type:'rest' datasource builds a real store.
//
//  PRE-FIX it fails: bootRegistrations didn't exist and registerStoreBuilders
//  lived only inside the lazy setupRegistrations, so the 'stats' kind is
//  unregistered on the eager path and buildStoreManifest throws. POST-FIX it
//  passes: bootRegistrations() (what main.tsx now calls pre-render) registers it.
//
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bootRegistrations } from '../bootRegistrations'
import { buildStoreManifest, registeredKinds } from '@statdash/react/engine'
import type { DatasourceInstanceConfig } from '@statdash/engine'

// One type:'rest' (→ kind:'stats') datasource, exactly as fetch-store-manifest
// maps a config.data_source row via toSourceDescriptor. classifier fetch is
// stubbed so the builder runs offline (it does a build-time classifier read).
const STATS_DESCRIPTOR: DatasourceInstanceConfig = {
  id:     'accounts',
  kind:   'stats',
  url:    'http://stats.test',
  params: { datasetCode: 'accounts', nonTimeDims: [] },
}

describe('boot ordering — store-builders registered before bootstrap consumes them', () => {
  beforeEach(() => {
    // The 'stats' builder does a build-time classifier + dataset-meta read and
    // (for nonTimeDims:[]) issues no classifier calls; the dataset-meta read is
    // .catch()-guarded. Stub fetch so any network the builder touches resolves
    // empty rather than hitting a real endpoint — we are testing REGISTRATION
    // ordering, not the wire.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('the eager boot seam registers the stats/static/href builders', () => {
    bootRegistrations()
    // The kinds a type:'rest'/'static'/'sdmx-json' row maps to must all exist.
    expect(registeredKinds()).toEqual(expect.arrayContaining(['stats', 'static', 'href']))
  })

  it('buildStoreManifest succeeds for a kind:stats datasource after the eager boot path', async () => {
    bootRegistrations()

    // This is the exact call bootstrapSite makes (via fetchStoreManifest); it
    // THREW on the regressed ordering because 'stats' was registered only in the
    // lazy chunk. After the eager registration it builds a real DataStore.
    const stores = await buildStoreManifest([STATS_DESCRIPTOR])

    expect(Object.keys(stores)).toEqual(['accounts'])
    expect(stores['accounts']).toBeDefined()
    // A DataStore exposes a query/resolve surface — assert it is a live object,
    // not a thrown-past empty map.
    expect(typeof stores['accounts']).toBe('object')
  })
})
