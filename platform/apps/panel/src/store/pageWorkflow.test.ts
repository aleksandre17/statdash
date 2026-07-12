// ── pageWorkflow.test — the draft→publish workflow thunks against a mock API ──
//
//  No live API/DB here, so we mock the HTTP boundary (globalThis.fetch) and drive
//  the REAL api-action thunks + the REAL api client (envelope parsing, ApiError,
//  403 handling all exercised). Asserts the four product-critical flows:
//    1. save BLOCKS on a save-guard violation (issues recorded, no PUT fired)
//    2. save SUCCEEDS for a clean page (PUT fired, lifecycle reflected)
//    3. publish 403 → forbidden state (server FSM owns lifecycle; we reflect it)
//    4. open → hydrate → edit → save round-trip (config persisted losslessly)
//
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { nodeRegistry } from '@statdash/react/engine'
import { useConstructorStore } from './constructor.store'
import { openPage, savePage, publishPage, createPage } from './api-actions'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import type { CanvasNode, CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// ── Fetch mock harness ────────────────────────────────────────────────────────
//
//  Routes by METHOD + URL suffix; each test installs the responses it needs.
//  Records calls so we can assert which endpoint was hit with what payload.

interface RecordedCall { method: string; url: string; body: unknown }
let calls: RecordedCall[] = []
type Responder = (call: RecordedCall) => { status: number; data?: unknown; error?: string }
let responder: Responder

function mockFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    const call = { method, url: String(url), body }
    calls.push(call)
    const r = responder(call)
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => (r.error ? { error: r.error } : { data: r.data }),
    } as Response
  })
}

function resetStore(page: CanvasPage, activeLocales: string[] = []) {
  useConstructorStore.setState({
    pages: [page],
    activePageId: page.id,
    selection: null,
    lifecycle: {}, saveStatus: {}, publishStatus: {},
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
    site: { ...useConstructorStore.getState().site, defaultLocale: 'ka', activeLocales },
  })
}

const store = () => useConstructorStore.getState()

/** A clean, save-ready page: one section with a required title. */
function cleanPage(id = 'p1'): CanvasPage {
  const sec: CanvasNode = { id: 'sec-1', type: 'section', props: { title: 'GDP' }, childIds: [] }
  return { id, type: 'inner-page', title: { ka: 'მთავარი', en: 'Home' }, slug: 'home', nodeIds: ['sec-1'], nodes: { 'sec-1': sec } }
}

beforeEach(() => {
  calls = []
  responder = () => ({ status: 200, data: {} })
  vi.stubGlobal('fetch', mockFetch())
})
afterEach(() => { vi.unstubAllGlobals() })

describe('savePage — the save→guard gate', () => {
  it('BLOCKS save on a guard violation (incomplete locale) — records issues, fires NO PUT', async () => {
    // A hero with an incomplete LocaleString title (missing ka) — locale-complete fails.
    const hero: CanvasNode = {
      id: 'hero-1', type: 'hero',
      props: { ...(nodeRegistry.getDefaults('hero') ?? {}), title: { en: 'GDP' }, subtitle: { ka: 'ა', en: 'b' },
               cards: [{ id: 'c', title: { ka: 'ბ', en: 'b' }, color: '#000', img: '', pageBg: '' }] },
      childIds: [],
    }
    resetStore({ id: 'p1', type: 'inner-page', title: { ka: 'მთ', en: 'H' }, slug: 'home', nodeIds: ['hero-1'], nodes: { 'hero-1': hero } })

    const report = await savePage('p1')

    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.check === 'locale-complete' && i.nodeId === 'hero-1')).toBe(true)
    // The blocking issues are recorded on the store for inline UI rendering.
    expect(store().saveStatus['p1']?.issues.length).toBeGreaterThan(0)
    // CRITICAL: no PUT reached the server — the gate shifted the failure left.
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('SUCCEEDS for a clean page — fires the PUT with the serialized config + reflects lifecycle', async () => {
    resetStore(cleanPage())
    responder = (c) => c.method === 'PUT'
      ? { status: 200, data: { id: 'p1', version_number: 4 } }
      : { status: 200, data: {} }

    const report = await savePage('p1')

    expect(report.ok).toBe(true)
    const put = calls.find((c) => c.method === 'PUT')
    expect(put?.url).toContain('/api/config/pages/p1')
    // The PUT body carries the real NodePageConfig tree (the persisted artifact).
    expect((put?.body as { config: unknown }).config).toEqual(toNodePageConfig(cleanPage()))
    // Saving a new version reflects status:draft, the new version, not-yet-published.
    expect(store().lifecycle['p1']).toMatchObject({ status: 'draft', versionNumber: 4, latestPublished: false, dirty: false })
    expect(store().saveStatus['p1']?.saved).toBe(true)
  })
})

describe('savePage — locale-completeness honors the site ACTIVE set (Q-5 SSOT)', () => {
  // The save-guard's locale set is derived from the SAME SSOT the Inspector uses
  // (resolveActiveLocales(site.activeLocales, defaultLocale)) — NOT defaultLocale
  // alone. So a config missing a NON-default active locale must be rejected, the
  // case that silently passed when the guard saw only the default locale.

  /** A hero whose title is complete in the DEFAULT locale (ka) but missing en. */
  function defaultOnlyHeroPage(): CanvasPage {
    const hero: CanvasNode = {
      id: 'hero-1', type: 'hero',
      props: { ...(nodeRegistry.getDefaults('hero') ?? {}),
               title: { ka: 'მთავარი' }, subtitle: { ka: 'ა', en: 'b' },
               cards: [{ id: 'c', title: { ka: 'ბ', en: 'b' }, color: '#000', img: '', pageBg: '' }] },
      childIds: [],
    }
    return { id: 'p1', type: 'inner-page', title: { ka: 'მთ', en: 'H' }, slug: 'home', nodeIds: ['hero-1'], nodes: { 'hero-1': hero } }
  }

  it('REJECTS a config missing a NON-default active locale (en) when site.activeLocales = [ka,en]', async () => {
    resetStore(defaultOnlyHeroPage(), ['ka', 'en'])

    const report = await savePage('p1')

    expect(report.ok).toBe(false)
    const issue = report.issues.find((i) => i.check === 'locale-complete' && i.nodeId === 'hero-1')
    expect(issue?.field).toBe('title')
    expect(issue?.message).toContain('en')        // the non-default active locale
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)  // no write reached the server
  })

  it('PASSES the same page when the only active locale is the default (single-locale site)', async () => {
    // With activeLocales = [ka], the default-only title is complete → no locale issue.
    resetStore(defaultOnlyHeroPage(), ['ka'])
    responder = (c) => c.method === 'PUT'
      ? { status: 200, data: { id: 'p1', version_number: 2 } }
      : { status: 200, data: {} }

    const report = await savePage('p1')

    expect(report.issues.some((i) => i.check === 'locale-complete')).toBe(false)
  })

  it('falls back gracefully to the platform set [ka,en] when activeLocales is empty', async () => {
    // Empty activeLocales (mock-data / legacy payload) → resolveActiveLocales
    // degrades to default-first [ka,en], so en is still required.
    resetStore(defaultOnlyHeroPage(), [])

    const report = await savePage('p1')

    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.check === 'locale-complete' && i.field === 'title')).toBe(true)
  })
})

describe('publishPage — admin-gated server FSM', () => {
  it('reflects FORBIDDEN on a 403 (non-admin) — never reimplements lifecycle client-side', async () => {
    resetStore(cleanPage())
    responder = (c) => c.method === 'POST' && c.url.endsWith('/publish')
      ? { status: 403, error: 'admin role required to publish' }
      : { status: 200, data: {} }

    const res = await publishPage('p1')

    expect(res).toEqual({ ok: false, forbidden: true })
    expect(store().publishStatus['p1']?.forbidden).toBe(true)
    // The page status was NOT flipped to published — server FSM owns it.
    expect(store().lifecycle['p1']?.status).not.toBe('published')
  })

  it('reflects PUBLISHED on success (admin) from the server response', async () => {
    resetStore(cleanPage())
    store().reflectLifecycle('p1', { status: 'draft', versionNumber: 1, latestPublished: false, dirty: false })
    responder = (c) => c.method === 'POST' && c.url.endsWith('/publish')
      ? { status: 200, data: { id: 'p1', published_version_id: 'v1' } }
      : { status: 200, data: {} }

    const res = await publishPage('p1')

    expect(res).toEqual({ ok: true, forbidden: false })
    expect(store().lifecycle['p1']).toMatchObject({ status: 'published', latestPublished: true })
    expect(store().publishStatus['p1']?.forbidden).toBe(false)
  })
})

describe('open → hydrate → edit → save round-trip', () => {
  it('opens a page from GET /:id, hydrates the canvas, then saves the edited config', async () => {
    // The server returns a persisted config tree (one section).
    const persisted = toNodePageConfig(cleanPage('p9'))
    resetStore({ id: 'placeholder', type: 'inner-page', title: { ka: 'x', en: 'x' }, slug: 'x', nodeIds: [], nodes: {} })

    responder = (c) => {
      if (c.method === 'GET' && c.url.endsWith('/pages/p9')) {
        return { status: 200, data: { id: 'p9', slug: 'home', title: { ka: 'მთავარი', en: 'Home' },
                 status: 'published', config: persisted, data_specs: [], version_number: 7, is_published: true } }
      }
      if (c.method === 'PUT') return { status: 200, data: { id: 'p9', version_number: 8 } }
      return { status: 200, data: {} }
    }

    // ── OPEN — hydrate the flat store from the persisted tree + reflect FSM ──
    const opened = await openPage('p9')
    expect(opened).not.toBeNull()
    expect(store().activePageId).toBe('p9')
    expect(store().lifecycle['p9']).toMatchObject({ status: 'published', versionNumber: 7, latestPublished: true })
    // The section hydrated losslessly (round-trip identity over the node graph).
    const hydrated = store().pages.find((p) => p.id === 'p9')!
    expect(Object.values(hydrated.nodes).some((n) => n.type === 'section')).toBe(true)

    // ── EDIT — change the section title via the same store write path ────────
    const secId = Object.values(hydrated.nodes).find((n) => n.type === 'section')!.id
    store().updateNode('p9', secId, { props: { title: 'National Accounts' } })

    // ── SAVE — guarded PUT persists the edited tree; lifecycle re-reflected ──
    const report = await savePage('p9')
    expect(report.ok).toBe(true)
    const put = calls.find((c) => c.method === 'PUT')
    const savedConfig = (put?.body as { config: { children: { title: string }[] } }).config
    expect(savedConfig.children[0].title).toBe('National Accounts')
    // A fresh save supersedes the published version → back to an unpublished draft.
    expect(store().lifecycle['p9']).toMatchObject({ status: 'draft', versionNumber: 8, latestPublished: false })
  })
})

describe('createPage — new page flow', () => {
  it('POSTs a new page and reflects a clean draft at version 1', async () => {
    resetStore({ id: 'x', type: 'inner-page', title: { ka: 'x', en: 'x' }, slug: 'x', nodeIds: [], nodes: {} })
    responder = (c) => c.method === 'POST' && c.url.endsWith('/pages')
      ? { status: 201, data: { id: 'new-1' } }
      : { status: 200, data: {} }

    const page = await createPage({ type: 'inner-page', title: { ka: 'ახალი', en: 'New' }, slug: 'new', nodeIds: [], nodes: {} })

    expect(page.id).toBe('new-1')
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/pages'))).toBe(true)
    expect(store().lifecycle['new-1']).toMatchObject({ status: 'draft', versionNumber: 1, latestPublished: false, dirty: false })
  })
})
