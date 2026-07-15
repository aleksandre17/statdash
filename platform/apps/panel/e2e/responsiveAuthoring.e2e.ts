// ── responsiveAuthoring.e2e — per-breakpoint authoring proven in the REAL bundle ──
//
//  The jsdom-can't-catch half of the responsive proof: the fitness suite proves the
//  AUTHORING model (the unified value-authoring wrapper writes value[bp] honestly);
//  THIS proves the running app, boot-to-paint in Chromium, reflows a grid PER BREAKPOINT
//  via the EXISTING container-query cascade:
//    1. a grid authored `columns: { default: 4, md: 1 }` renders MULTIPLE columns at a
//       wide preview and ONE column when the author selects the `md` breakpoint (the
//       Builder.io/Framer switcher constrains the canvas → layout.css `@container` fires);
//    2. selecting the grid shows the ONE unified value-authoring control in its
//       per-breakpoint (responsive) mode — the live authoring affordance.
//
import { test, expect, type Page, type Route } from '@playwright/test'

// A wide viewport so the grid's container is comfortably ABOVE the md (768px) band at the
// base breakpoint — the reflow is then a clean many→one when md is selected (which caps
// the preview to 768px). Overrides the config's default 1440×900 for this file.
test.use({ viewport: { width: 2560, height: 1400 } })

const GOVERNED = {
  metrics:    [{ id: 'gdp.current', code: 'gdp-cp', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ', en: 'mn' }, format: 'mln_gel', dataSource: 'gdp' }],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

const PAGE_ID = 'page-grid'
// A grid authored with a RESPONSIVE columns value (pure DATA, Law 2): 4 columns at the
// base, collapsing to 1 at md. Four text children so the column count is visible.
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'grid',
  children: [
    {
      type: 'grid', id: 'grid-1', columns: { default: 4, md: 1 },
      children: [
        { type: 'text', id: 't1', content: 'Alpha' },
        { type: 'text', id: 't2', content: 'Bravo' },
        { type: 'text', id: 't3', content: 'Charlie' },
        { type: 'text', id: 't4', content: 'Delta' },
      ],
    },
  ],
}
const SITE     = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'grid', title: { ka: 'ბადე', en: 'Grid' }, status: 'draft', updated_at: '2026-07-16T00:00:00.000Z' }

const j = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function mock(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname
    if (p.endsWith('/api/bootstrap'))           return j(route, GOVERNED)
    if (p.endsWith('/api/config/site'))         return j(route, { data: SITE })
    if (p.endsWith('/api/config/data-sources')) return j(route, { data: [] })
    if (p.endsWith('/api/config/data-specs'))   return j(route, { data: [] })
    if (p.endsWith('/api/config/nav'))          return j(route, { data: [] })
    if (p.endsWith('/api/config/pages'))        return j(route, { data: [PAGE_ROW] })
    if (p.includes('/api/config/pages/'))       return j(route, { data: { ...PAGE_ROW, config: PAGE_CONFIG, data_specs: [], version_number: 1, is_published: false } })
    return j(route, { data: {} })
  })
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err })
  await page.addInitScript(() => window.sessionStorage.setItem('geostat_panel_token', 'e2e-token'))
  await mock(page)
})

// Count the RESOLVED grid-template-columns tracks of the live grid.
const trackCount = (page: Page) =>
  page.locator('.layout-grid').first().evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
  )

test('a responsive grid reflows per breakpoint — 4 columns at base, 1 at md (container-query cascade)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  const grid = page.locator('.layout-grid').first()
  await expect(grid).toBeVisible({ timeout: 60_000 })

  // Base breakpoint (no preview cap) — the wide container shows the default MULTI-column
  // template (4). The value is authored as pure per-breakpoint DATA; the renderer lowered
  // it to the container-query cascade with ZERO new mechanism.
  await expect.poll(() => trackCount(page)).toBeGreaterThan(1)

  // Select `md` in the Builder.io/Framer breakpoint switcher — the canvas preview is
  // capped to 768px, the grid's container drops into the md band, and the SAME cascade
  // selects `md`'s single-column value. The canvas reflows LIVE.
  await page.locator('[data-testid="breakpoint-switcher"] [data-bp="md"]').click()
  await expect.poll(() => trackCount(page)).toBe(1)

  // Back to base — reflow is reversible; the grid restores its multi-column template.
  await page.locator('[data-testid="breakpoint-switcher"] [data-bp="default"]').click()
  await expect.poll(() => trackCount(page)).toBeGreaterThan(1)

  await page.screenshot({ path: 'e2e/__screens__/responsive-grid-canvas.png', fullPage: false })
})

test('selecting the grid shows the ONE value-authoring control in per-breakpoint mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // Select the grid via its overlay frame (whole-node selection).
  await page.locator('[data-node-id="grid-1"]').first().click({ timeout: 60_000 })

  // Wait for the Inspector, then open the LAYOUT concern group — where the responsive
  // `columns` field lives (the dock opens only the first concern group by default). A
  // normal author disclosure gesture.
  const dock = page.locator('.studio-right-dock')
  await expect(dock).toBeVisible({ timeout: 60_000 })
  await dock.getByRole('button', { name: 'Layout', exact: true }).click()

  // The `columns` field, seeded as a per-breakpoint map, opens in RESPONSIVE mode: the
  // unified control's responsive toggle is pressed and the per-breakpoint editor is shown
  // — ONE wrapper, its mode reflecting the value's shape (the coherence mandate).
  await expect(page.locator('.insp-va__responsive[aria-pressed="true"]').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid="responsive-editor"]').first()).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/responsive-grid-inspector.png', fullPage: false })
})
