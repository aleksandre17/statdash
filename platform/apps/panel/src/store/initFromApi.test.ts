// ── initFromApi.test — HYDRATE idempotency (StrictMode double-invoke) ──────────
//
//  React StrictMode double-invokes App's boot mount effect in dev. App.tsx's
//  "already hydrated" guard (`store.dataSources.length > 0`) is a SYNCHRONOUS
//  check racing an ASYNC initFromApi — both invocations pass the guard before
//  either has written to the store, so initFromApi can genuinely run twice
//  against the same server pages. Before this fix, the hydrate loop appended
//  every loaded page via the blind-append `addPage`, so a double-invoke
//  duplicated each page id in the store → duplicate React keys in the page
//  tablist / top-bar page Select (prod-harmless — a single invoke — but a real
//  non-idempotent-hydrate defect). initFromApi now hydrates via `setPages` (an
//  authoritative REPLACE, constructor.pages.ts `setPagesPatch`), so re-running
//  it is a no-op on the pages collection.
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

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response
}

/** Routes the five parallel initFromApi reads + the per-page GET, by URL suffix. */
function mockFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url)
    if (u.endsWith('/data-sources'))    return jsonResponse([])
    if (u.endsWith('/data-specs'))      return jsonResponse([])
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
  it('a CONCURRENT double-invoke (simulating StrictMode racing the boot guard) yields NO duplicate page ids', async () => {
    const [ok1, ok2] = await Promise.all([initFromApi(), initFromApi()])
    expect(ok1).toBe(true)
    expect(ok2).toBe(true)

    const ids = useConstructorStore.getState().pages.map((p) => p.id)
    expect(ids).toEqual(['p1'])                  // exactly one copy, not two
    expect(new Set(ids).size).toBe(ids.length)   // generically: no duplicate id
  })

  it('a SEQUENTIAL second hydrate (re-init) also replaces rather than duplicates', async () => {
    await initFromApi()
    await initFromApi()

    const ids = useConstructorStore.getState().pages.map((p) => p.id)
    expect(ids).toEqual(['p1'])
  })

  it('a single hydrate still loads the page (no regression on the happy path)', async () => {
    await initFromApi()

    const store = useConstructorStore.getState()
    expect(store.pages.map((p) => p.id)).toEqual(['p1'])
    expect(store.lifecycle['p1']).toMatchObject({ status: 'draft', versionNumber: 1, latestPublished: false, dirty: false })
    expect(store.activePageId).toBe('p1')
  })
})
