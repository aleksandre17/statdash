// ── initFromApi.test — HYDRATE idempotency (StrictMode double-invoke) ──────────
//
//  React StrictMode double-invokes App's boot mount effect in dev. App.tsx's
//  "already hydrated" guard (`store.dataSources.length > 0`) is a SYNCHRONOUS
//  check racing an ASYNC initFromApi — both invocations pass the guard before
//  either has written to the store, so initFromApi can genuinely run twice
//  against the same server pages/sources/specs. Before this fix, the hydrate
//  loop appended every loaded page/source/spec via the blind-append
//  `addPage`/`addDataSource`/`addDataSpec`, so a double-invoke duplicated each
//  id in the store → duplicate React keys (page tablist / top-bar page Select;
//  and the Data-modeling panel's source + spec lists — live-reproduced on the
//  dev panel: 3 sources + 4 specs each rendered TWICE, 7 duplicate-key console
//  errors). initFromApi now hydrates via `setPages`/`setDataSources`/
//  `setDataSpecs` (an authoritative REPLACE, constructor.pages.ts
//  `setPagesPatch` + constructor.store.ts `setDataSources`/`setDataSpecs`), so
//  re-running it is a no-op on all three collections.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useConstructorStore } from './constructor.store'
import { initFromApi } from './api-actions'

const PAGE_LIST_ROW = { id: 'p1', slug: 'home', title: { ka: 'მთავარი', en: 'Home' }, status: 'draft', updated_at: '2026-01-01' }
const PAGE_DETAIL_ROW = {
  ...PAGE_LIST_ROW,
  config: { type: 'inner-page', id: 'p1', path: 'home', children: [] },
  data_specs: [],
  version_number: 1,
  is_published: false,
}
const SOURCE_ROW = { id: 's1', name: 'regional', type: 'rest', url: null, config: {}, status: 'connected' }
const SPEC_ROW = { id: 'sp1', name: 'tree', description: null, spec: { type: 'query', query: {}, encoding: {} }, source_id: null }

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response
}

/** Routes the five parallel initFromApi reads + the per-page GET, by URL suffix. */
function mockFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url)
    if (u.endsWith('/data-sources'))    return jsonResponse([SOURCE_ROW])
    if (u.endsWith('/data-specs'))      return jsonResponse([SPEC_ROW])
    if (u.endsWith('/site'))            return jsonResponse({ name: 'Site', defaultLocale: 'ka', activeLocales: ['ka'] })
    if (u.endsWith('/nav'))             return jsonResponse([])
    if (u.endsWith('/pages'))           return jsonResponse([PAGE_LIST_ROW])
    if (u.endsWith('/pages/p1'))        return jsonResponse(PAGE_DETAIL_ROW)
    return jsonResponse({})
  })
}

function resetStore() {
  useConstructorStore.setState({
    dataSources: [], dataSpecs: [], pages: [], activePageId: null,
    lifecycle: {}, saveStatus: {}, publishStatus: {},
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  })
}

beforeEach(() => {
  resetStore()
  vi.stubGlobal('fetch', mockFetch())
})
afterEach(() => { vi.unstubAllGlobals() })

describe('initFromApi — hydrate idempotency', () => {
  it('a CONCURRENT double-invoke (simulating StrictMode racing the boot guard) yields NO duplicate page/source/spec ids', async () => {
    const [ok1, ok2] = await Promise.all([initFromApi(), initFromApi()])
    expect(ok1).toBe(true)
    expect(ok2).toBe(true)

    const ids = useConstructorStore.getState().pages.map((p) => p.id)
    expect(ids).toEqual(['p1'])                  // exactly one copy, not two
    expect(new Set(ids).size).toBe(ids.length)   // generically: no duplicate id

    const sourceIds = useConstructorStore.getState().dataSources.map((d) => d.id)
    const specIds    = useConstructorStore.getState().dataSpecs.map((d) => d.id)
    expect(sourceIds).toEqual(['s1'])
    expect(specIds).toEqual(['sp1'])
  })

  it('a SEQUENTIAL second hydrate (re-init) also replaces rather than duplicates', async () => {
    await initFromApi()
    await initFromApi()

    const ids = useConstructorStore.getState().pages.map((p) => p.id)
    expect(ids).toEqual(['p1'])

    const sourceIds = useConstructorStore.getState().dataSources.map((d) => d.id)
    const specIds    = useConstructorStore.getState().dataSpecs.map((d) => d.id)
    expect(sourceIds).toEqual(['s1'])
    expect(specIds).toEqual(['sp1'])
  })

  it('a single hydrate still loads the page/source/spec (no regression on the happy path)', async () => {
    await initFromApi()

    const store = useConstructorStore.getState()
    expect(store.pages.map((p) => p.id)).toEqual(['p1'])
    expect(store.lifecycle['p1']).toMatchObject({ status: 'draft', versionNumber: 1, latestPublished: false, dirty: false })
    expect(store.activePageId).toBe('p1')
    expect(store.dataSources.map((d) => d.id)).toEqual(['s1'])
    expect(store.dataSpecs.map((d) => d.id)).toEqual(['sp1'])
  })
})
