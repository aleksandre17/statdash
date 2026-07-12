// ── Boot composition — the REAL App boot as ONE flow (the M0-class closer) ──────
//
//  The defect class that shipped M0 broken was proven-in-segments: three disjoint
//  tests each stubbed a different leg, so the COMPOSITION (main-style init → App
//  await → 'ready' → StudioShell → registry populated → palette shows real nouns)
//  was never exercised end to end. This test closes that gap.
//
//  It renders the REAL <App>, lets the REAL bootstrapCatalog() run against a mocked
//  fetch('/api/bootstrap') returning the governed catalog shape (mirrors
//  apps/api/provisioning/geostat.provisioning.json's metrics/dimensions), seeds a
//  page but NO data sources (the empty/new-site path — the exact case the old
//  module-eval coupling broke), and asserts a POPULATED MetricPalette appears INSIDE
//  a mounted StudioShell.
//
//  It ALSO proves boot ORDERING deterministically: the /api/bootstrap fetch is a
//  deferred promise, so while it is pending the App is parked in 'loading' (no
//  StudioShell, no palette). The catalog tiles appear ONLY after the fetch resolves.
//  If boot stopped awaiting bootstrapCatalog before 'ready' (or mounted the palette
//  during 'loading'), the palette's catalog store would load an EMPTY describeApp()
//  and cache it 'ready' — so the tile would never appear and this test goes RED.
//  (Empirically confirmed: dropping the await on bootstrapCatalog fails this test.)
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// initFromApi is stubbed to resolve true WITHOUT seeding mock data (so the store
// keeps the empty-site seed below and App skips its offline fallback). bootstrapCatalog
// is INTENTIONALLY NOT mocked — it is the composition under test.
vi.mock('../store/api-actions', async (orig) => ({
  ...(await orig<typeof import('../store/api-actions')>()),
  initFromApi: vi.fn(async () => true),
}))

import { App } from '../App'
import { useConstructorStore } from '../store/constructor.store'
import { useMetricCatalogStore } from '../discovery/metricCatalog.store'
import { setToken, logout } from '../lib/auth'
import type { CanvasNode, CanvasPage } from '../types/constructor'

// ── The governed catalog the mocked /api/bootstrap serves ──────────────────────
//  A faithful subset of apps/api/provisioning/geostat.provisioning.json's site_config
//  `metrics`/`dimensions` — real ids/codes/bilingual labels/units, two dataSource
//  groups (gdp + accounts) so the palette's grouping is exercised too.
const GOVERNED_CATALOG = {
  metrics: [
    { id: 'gdp.current',    code: 'gross-domestic-product-at-current-prices', label: { ka: 'მშპ მიმდინარე ფასებში', en: 'GDP at current prices' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel', dataSource: 'gdp' },
    { id: 'gdp.perCapita',  code: 'gdp-per-capita-usd',                       label: { ka: 'მშპ ერთ სულზე', en: 'GDP per capita' }, unit: { ka: '$', en: '$' }, format: 'decimal1', dataSource: 'gdp' },
    { id: 'gdp.realGrowth', code: 'real-gdp-growth-rates',                    label: { ka: 'რეალური ზრდა', en: 'Real growth' }, format: 'sign_pct', dataSource: 'gdp' },
    { id: 'accounts.gni',   code: 'gross-national-income',                    label: { ka: 'მშემოსავალი', en: 'Gross national income' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel', dataSource: 'accounts' },
  ],
  dimensions: [
    { id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' },     conceptRole: 'time' },
    { id: 'geo',  code: 'geo',  label: { ka: 'გეოგრაფია', en: 'Geography' }, conceptRole: 'geo', defaultMember: 'GE' },
    { id: 'sector', code: 'sector', label: { ka: 'სექტორი', en: 'Sector' }, conceptRole: 'sector' },
  ],
}

// A minimal page holding ONE metric-bindable node (a chart — its top-level
// `data.query.measure` is an `enum-ref` over `metrics`, so isMetricBindable is true).
// SPEC S5 re-homed metric binding from a peer rail surface to a CONTEXTUAL section of
// the right Inspector: the MetricPalette mounts when a data-bound element is SELECTED,
// so the composition proof selects this node (below) to surface it.
const BINDABLE_NODE: CanvasNode = { id: 'c1', type: 'chart', props: {}, childIds: [] }
const SEED_PAGE: CanvasPage = {
  id: 'p1', type: 'inner-page', title: { ka: 'ტესტი', en: 'Test' }, slug: 'test',
  nodeIds: [BINDABLE_NODE.id], nodes: { [BINDABLE_NODE.id]: BINDABLE_NODE },
}

// Deferred /api/bootstrap response — resolved by the test to drive the ordering proof.
let resolveBootstrap: (r: unknown) => void
let pendingBootstrap: Promise<unknown>

beforeEach(() => {
  pendingBootstrap = new Promise((res) => { resolveBootstrap = res })
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
    String(input).includes('/api/bootstrap')
      ? pendingBootstrap
      : Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as unknown as typeof fetch)

  // Land on the default Compose surface (Add) — the MetricPalette is no longer a peer
  // surface; it mounts in the right Inspector once the bindable node is selected (below).
  window.history.replaceState(null, '', '/studio/insert')

  // Empty-site seed: a page (with the bindable node) + English locale, and NO data
  // sources (so App boots the real bootstrapCatalog path, not the offline fallback).
  // Select the node so the Inspector's contextual Data section mounts the MetricPalette.
  useConstructorStore.setState({
    dataSources: [], selection: { nodeId: BINDABLE_NODE.id },
  })
  const store = useConstructorStore.getState()
  store.updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  store.addPage(SEED_PAGE)
  store.setActivePage(SEED_PAGE.id)

  // Force the catalog store to re-read describeApp() after this boot registers the
  // catalog (it caches 'ready' once — mirror the real invalidate-after-boot).
  useMetricCatalogStore.getState().invalidate()

  setToken('test-token') // isAuthenticated() → true, so App boots past LoginForm
})

afterEach(() => {
  logout()
  vi.unstubAllGlobals()
})

describe('panel boot composition — real App → real bootstrapCatalog → populated palette', () => {
  it('parks in loading until the catalog resolves, then shows real governed tiles in the Studio', async () => {
    render(<App />)

    // Initial frame: the App parks in 'loading' (token present) before boot resolves.
    expect(await screen.findByLabelText('Loading constructor')).toBeInTheDocument()

    // ── Ordering proof (deterministic) ────────────────────────────────────────
    //  Synchronize on the SAME registry dynamic import App awaits (module dedup:
    //  both promises resolve together) and drain the microtask queue, so the OTHER
    //  boot legs (mocked initFromApi + registryBoot) have fully settled. At this
    //  sampled instant the /api/bootstrap fetch is STILL pending (we hold it).
    //  • Correct ordering: 'ready' is gated behind bootstrapCatalog → the App is
    //    STILL in 'loading' (the assertion below holds).
    //  • Broken ordering (boot stops awaiting bootstrapCatalog): 'ready' fires here
    //    on initFromApi+registryBoot alone → 'Loading constructor' is gone (replaced
    //    by the StudioShell suspense fallback) → this assertion FAILS. Empirically
    //    confirmed: fire-and-forgetting bootstrapCatalog turns this test RED here.
    await act(async () => {
      await import('../canvas/setupCanvasRegistry')
      for (let i = 0; i < 8; i++) await Promise.resolve()
    })
    expect(screen.getByLabelText('Loading constructor')).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()

    // Now the delivery manifest arrives — boot registers the governed catalog and
    // the App transitions to 'ready'.
    await act(async () => {
      resolveBootstrap({ ok: true, json: async () => GOVERNED_CATALOG })
      await pendingBootstrap
    })

    // ── The composition end-to-end: StudioShell mounts (its lazy chunk transforms
    //    the whole subsystem graph on first import — generous timeout), and the REAL
    //    MetricPalette in the Inspector's contextual Data section (the selected bindable
    //    node) renders the REAL governed nouns from the boot-populated describeApp()
    //    registry. ──
    const tile = await screen.findByTestId('metric-tile-gdp.current', {}, { timeout: 20000 })
    expect(tile).toBeInTheDocument()
    expect(tile).toHaveTextContent('GDP at current prices') // en label — site locale seeded 'en'

    // Proof it is the GOVERNED catalog, not a stub: a second real metric from the
    // other dataSource group is present too.
    expect(screen.getByTestId('metric-tile-accounts.gni')).toBeInTheDocument()

    // And the composition mounted the actual StudioShell (banner landmark), not the
    // palette in isolation — this is the whole-flow assertion the segmented tests skip.
    expect(screen.getByRole('banner')).toBeInTheDocument()
  }, 30000) // generous per-test timeout: the lazy StudioShell + canvas transform the
            // whole subsystem graph on first import (heavier under full-suite contention).
})
