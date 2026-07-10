// ── authorRender.e2e — the Constructor MVP fitness (author → render loop) ────
//
//  THE canonical Constructor MVP fitness, proven with ZERO code change: author a
//  page entirely through the panel's authoring surface (store actions + the
//  Inspector's patchProp write path), gate it through the save-guard's four
//  checks, serialize it via toNodePageConfig, then RENDER that exact
//  NodePageConfig through the SAME engine renderer the live runner uses
//  (NodePageRenderer from @statdash/react/engine) — and assert the authored
//  content renders identically.
//
//  This closes the loop the ADR names: "author + publish a page the runner
//  renders identically." If any step needed a code change, the loop would not be
//  Constructor-ready. It does not — the same registry, adapter, guard and
//  renderer serve both authoring and delivery.
//
//  Mirrors the live render path (CanvasView): MemoryRouter → SiteProvider
//  (staticStore, no fetch) → NodePageRenderer.
//
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SiteProvider } from '@statdash/react'
import { NodePageRenderer, nodeRegistry } from '@statdash/react/engine'
import { staticStore } from '@statdash/engine'
import type { NodePageConfig } from '@statdash/react/engine'

import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { toNodePageConfig, fromNodePageConfig } from '../canvas/canvasPageAdapter'
import { validatePageForSave, stableStringify } from './saveGuard'
import type { CanvasNode, CanvasPage } from '../types/constructor'

// The renderer + guard read the real registries — register the live shells.
beforeAll(() => { setupCanvasRegistry() })
afterEach(cleanup)

const LOCALES = ['ka', 'en'] as const
const I18N = { locales: ['ka', 'en'], defaultLocale: 'ka', fallbackLocale: 'ka' }
// The inner-page root renders the app chrome, whose shells read useChromeConfig.
// The live runner provides this from the site config; the test provides the same
// minimal brand base so the render path is identical (no code change to the loop).
const CHROME_CONFIG = { logoUrl: '', logoAlt: { ka: '', en: '' } }

// ── Authoring helpers — drive the SAME store the panel UI drives ─────────────

const store = () => useConstructorStore.getState()

/** Reset the store to a single empty page and select it (panel session start). */
function startSession(): string {
  const pageId = 'e2e-page'
  useConstructorStore.setState({
    pages: [{ id: pageId, type: 'inner-page', title: { ka: 'მთავარი', en: 'Home' }, slug: 'home', nodeIds: [], nodes: {} }],
    activePageId: pageId,
    selectedNodeId: null,
    chromeSelection: null,
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  })
  return pageId
}

/** Add a node via the registry defaults — exactly PageStep.handleDrop. */
function addNode(pageId: string, type: string, id: string): void {
  const props = { ...(nodeRegistry.getDefaults(type) ?? {}) }
  const node: CanvasNode = { id, type, props, childIds: [] }
  store().addNode(pageId, node)
  store().selectNode(id)
}

/** Set one prop on the selected node — exactly the Inspector's patchProp path. */
function patchProp(pageId: string, nodeId: string, field: string, value: unknown): void {
  const node = activePage().nodes[nodeId]
  store().updateNode(pageId, nodeId, { props: { ...node.props, [field]: value } })
}

const activePage = (): CanvasPage =>
  store().pages.find((p) => p.id === store().activePageId)!

// ── Render helper — the live runner's render path ────────────────────────────

function renderPage(cfg: NodePageConfig) {
  return render(
    <MemoryRouter>
      <SiteProvider stores={{ default: staticStore }} nav={[]} pages={{}} i18n={I18N} chromeConfig={CHROME_CONFIG}>
        <NodePageRenderer page={cfg} />
      </SiteProvider>
    </MemoryRouter>,
  )
}

describe('Constructor MVP fitness — author → render loop (zero code change)', () => {
  beforeEach(() => { startSession() })

  it('authors a page, passes the save-guard, and the runner renders it identically', () => {
    const pageId = store().activePageId!

    // ── 1. AUTHOR (store + Inspector write path) ────────────────────────────
    // A section (required title) + a hero with a LocaleString title + cards.
    addNode(pageId, 'section', 'sec-1')
    patchProp(pageId, 'sec-1', 'title', 'National Accounts')

    addNode(pageId, 'hero', 'hero-1')
    // The Inspector's LocaleField emits a COMPLETE LocaleString record. The hero
    // defaults seed an empty subtitle ({ka:'',en:''}) — an incomplete localized
    // value the guard rightly flags, so the author fills it (i18n shift-left).
    patchProp(pageId, 'hero-1', 'title', { ka: 'მთლიანი შიდა პროდუქტი', en: 'Gross Domestic Product' })
    patchProp(pageId, 'hero-1', 'subtitle', { ka: 'ეროვნული ანგარიშები', en: 'National Accounts' })
    patchProp(pageId, 'hero-1', 'cards', [
      { id: 'c1', title: { ka: 'ბარათი', en: 'Card' }, color: '#005a9c', img: '', pageBg: '' },
    ])

    const page = activePage()

    // ── 2. SAVE-GUARD — the four checks must all pass ───────────────────────
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])

    // LocaleString completeness explicitly asserted (the authored title covers
    // every active locale — V13/V14 gold completeness, shifted left).
    const heroTitle = page.nodes['hero-1'].props.title as Record<string, string>
    expect(heroTitle.ka).toBeTruthy()
    expect(heroTitle.en).toBeTruthy()

    // ── 3. SERIALIZE — exactly the config the runner is handed ──────────────
    const cfg = toNodePageConfig(page)

    // ── 4. RENDER through the live engine renderer ──────────────────────────
    renderPage(cfg)

    // ── 5. ASSERT the authored content rendered (default-locale = ka) ───────
    expect(screen.getByText('National Accounts')).toBeInTheDocument()        // section title
    expect(screen.getByText('მთლიანი შიდა პროდუქტი')).toBeInTheDocument()    // hero title (ka)
  })

  it('round-trips losslessly: fromNodePageConfig ∘ toNodePageConfig ≡ page', () => {
    const pageId = store().activePageId!
    addNode(pageId, 'section', 'sec-1')
    patchProp(pageId, 'sec-1', 'title', 'GDP')
    addNode(pageId, 'hero', 'hero-1')
    patchProp(pageId, 'hero-1', 'title', { ka: 'გ', en: 'g' })
    patchProp(pageId, 'hero-1', 'cards', [{ id: 'c1', title: { ka: 'ბ', en: 'b' }, color: '#000', img: '', pageBg: '' }])

    const page = activePage()
    const cfg  = toNodePageConfig(page)
    const back = fromNodePageConfig(cfg, page.title)

    // The flat store survives the tree round-trip (the adapter's fitness invariant).
    expect(stableStringify(back)).toBe(stableStringify(page))
    // And re-projecting the rehydrated page yields the identical config.
    expect(stableStringify(toNodePageConfig(back))).toBe(stableStringify(cfg))
  })

  it('BLOCKS save on an incomplete locale (i18n shift-left) — the loop refuses to publish', () => {
    const pageId = store().activePageId!
    addNode(pageId, 'hero', 'hero-1')
    // Author an INCOMPLETE LocaleString — missing the ka translation.
    patchProp(pageId, 'hero-1', 'title', { en: 'Gross Domestic Product' })
    patchProp(pageId, 'hero-1', 'cards', [{ id: 'c1', title: { ka: 'ბ', en: 'b' }, color: '#000', img: '', pageBg: '' }])

    const report = validatePageForSave(activePage(), { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(false)
    const issue = report.issues.find((i) => i.check === 'locale-complete' && i.nodeId === 'hero-1')
    expect(issue?.field).toBe('title')
    expect(issue?.message).toContain('ka')
  })
})
