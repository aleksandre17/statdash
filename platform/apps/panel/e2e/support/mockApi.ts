// ── mockApi — a faithful governed-catalog API stub for the panel e2e boot proof ─
//
//  No Docker / api+db is available in this harness, so the real-browser boot proof
//  drives the panel against a Playwright route-interception stub of the exact HTTP
//  surface the boot path touches:
//
//    • GET /api/bootstrap            → the governed semantic catalog (bootstrapCatalog)
//    • GET /api/config/data-sources  ┐
//    • GET /api/config/data-specs    │  initFromApi()'s five parallel reads — each an
//    • GET /api/config/site          │  envelope `{ data }` (lib/api unwraps json.data)
//    • GET /api/config/nav           │
//    • GET /api/config/pages         ┘  → the page list
//    • GET /api/config/pages/:id     → the page detail (config = NodePageConfig tree)
//
//  The catalog is a REAL subset of apps/api/provisioning/geostat.provisioning.json's
//  governed metrics/dimensions (real ids/codes/bilingual labels/units) — the same
//  fixture the jsdom bootComposition.test uses, so the two proofs assert one truth.
//
//  Everything under /api that the panel might touch falls through to an empty-OK
//  envelope, so no request 404s the boot (fail-soft parity with the live api).
//
import type { Page, Route } from '@playwright/test'

// ── The governed catalog the mocked /api/bootstrap serves ──────────────────────
//  Faithful subset of geostat.provisioning.json site_config.metrics/.dimensions —
//  two dataSource groups (gdp + accounts) so the palette's grouping is exercised.
export const GOVERNED_CATALOG = {
  metrics: [
    { id: 'gdp.current',    code: 'gross-domestic-product-at-current-prices', label: { ka: 'მშპ მიმდინარე ფასებში', en: 'GDP at current prices' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel',  dataSource: 'gdp' },
    { id: 'gdp.perCapita',  code: 'gdp-per-capita-usd',                       label: { ka: 'მშპ ერთ სულზე',        en: 'GDP per capita' },      unit: { ka: '$',     en: '$' },      format: 'decimal1', dataSource: 'gdp' },
    { id: 'gdp.realGrowth', code: 'real-gdp-growth-rates',                    label: { ka: 'რეალური ზრდა',         en: 'Real growth' },                                          format: 'sign_pct', dataSource: 'gdp' },
    { id: 'accounts.gni',   code: 'gross-national-income',                    label: { ka: 'მთლიანი შემოსავალი',   en: 'Gross national income' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel',  dataSource: 'accounts' },
  ],
  dimensions: [
    { id: 'time',   code: 'time',   label: { ka: 'პერიოდი',   en: 'Period' },    conceptRole: 'time' },
    { id: 'geo',    code: 'geo',    label: { ka: 'გეოგრაფია', en: 'Geography' }, conceptRole: 'geo', defaultMember: 'GE' },
    { id: 'sector', code: 'sector', label: { ka: 'სექტორი',   en: 'Sector' },    conceptRole: 'sector' },
  ],
}

// The bind target — the id of the chart node the seed page carries (see PAGE_CONFIG).
export const CHART_NODE_ID = 'chart-gdp'
export const SEED_PAGE_ID = 'page-gdp'

// The seed page detail. `config` IS a NodePageConfig (engine NodeDef tree) — exactly
// the shape GET /api/config/pages/:id returns; fromApiPage → fromNodePageConfig
// hydrates it into the flat canvas store. A top-level `chart` node is the governed
// bind TARGET: its PropSchema declares `data.query.measure` as an enum-ref metrics
// field (packages/plugins/panels/chart), so selecting it makes the palette bindable.
// The chart renders its EMPTY/structural placeholder against the canvas static store
// (a box the overlay can frame + click) — the exact structural preview the canvas is
// built for (CanvasView), and a case only a REAL browser lays out with non-zero
// geometry (jsdom returns 0-rects, so this selection path is unprovable in vitest).
const PAGE_CONFIG = {
  type: 'inner-page',
  id: SEED_PAGE_ID,
  path: 'gdp',
  children: [
    { type: 'kpi-strip', id: 'kpi-gdp', title: { ka: 'ძირითადი მაჩვენებლები', en: 'Key indicators' } },
    { type: 'chart', id: CHART_NODE_ID, chartType: 'bar', label: { ka: 'მშპ დინამიკა', en: 'GDP dynamics' } },
  ],
}

const PAGE_LIST_ROW = {
  id: SEED_PAGE_ID,
  slug: 'gdp',
  title: { ka: 'მშპ', en: 'GDP' },
  status: 'draft',
  updated_at: '2026-07-09T00:00:00.000Z',
}

const PAGE_DETAIL_ROW = {
  ...PAGE_LIST_ROW,
  config: PAGE_CONFIG,
  data_specs: [],
  version_number: 1,
  is_published: false,
}

// Site is seeded English-first so the Studio chrome + governed labels render in
// English — the rail's "Data" button and the "GDP at current prices" tile label are
// then plain-English selectors (the palette resolves labels at the site's first
// active locale).
const SITE = {
  name: 'GeoStat Dashboard (e2e)',
  defaultLocale: 'en',
  activeLocales: ['en', 'ka'],
  logo: undefined,
  themeOverrides: {},
  dataSourceBindings: {},
  chrome: {},
}

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Install the governed-catalog API stub on a page. Call BEFORE `page.goto` so the
 * boot's first fetch is already intercepted. One handler switches on the request
 * path (unambiguous precedence — no route-ordering surprises).
 */
export async function mockPanelApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname

    if (p.endsWith('/api/bootstrap'))            return json(route, GOVERNED_CATALOG) // body-direct (ADR-0026)
    if (p.endsWith('/api/config/data-sources'))  return json(route, { data: [] })
    if (p.endsWith('/api/config/data-specs'))    return json(route, { data: [] })
    if (p.endsWith('/api/config/site'))          return json(route, { data: SITE })
    if (p.endsWith('/api/config/nav'))           return json(route, { data: [] })
    if (p.endsWith('/api/config/pages'))         return json(route, { data: [PAGE_LIST_ROW] })
    if (p.includes('/api/config/pages/'))        return json(route, { data: PAGE_DETAIL_ROW })

    // Fail-soft catch-all — never 404 the boot (mirrors the live api's tolerance).
    return json(route, { data: {} })
  })
}

/**
 * Seed the auth token BEFORE app scripts run, so isAuthenticated() is true and the
 * App boots straight past LoginForm into the async boot (initFromApi + bootstrapCatalog).
 * sessionStorage key mirrors lib/auth.ts (`geostat_panel_token`).
 */
export async function seedAuthToken(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('geostat_panel_token', 'e2e-token')
  })
}
