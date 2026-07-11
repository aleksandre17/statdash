// ── summaryCardInspector.e2e — Move 1 LIVE proof (Summary-Card Inspector) ───────
//
//  The owner's standing grievance: "the right side doesn't fit" — rich values fell
//  back to raw-JSON textareas. This drives the REAL Vite bundle in Chromium and
//  proves, on a real selection, that:
//    • the dock renders WITHOUT any raw-JSON textarea (FF-NO-RAW-JSON-DEFAULT);
//    • the opaque `trend`/`when` fields (which the code comment itself calls
//      "raw-JSON in the nested editor") now render as populated SummaryCards
//      (constant-weight glance projections, FF-DOCK-CONSTANT-WEIGHT).
//
//  Runs against the deployed dev line (:3013) when PW_BASE_URL is set (live.config),
//  else the local harness vite — the SAME source either way.
//
import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const GOVERNED = {
  metrics: [
    { id: 'gdp.current', code: 'gdp-cp', label: { ka: 'მშპ', en: 'GDP at current prices' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel', dataSource: 'gdp' },
  ],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

// A seed page carrying a kpi-strip with ONE populated item — its `trend` + `when`
// are OPAQUE objects (no itemSchema) that used to fall to a raw-JSON textarea and
// now render as SummaryCards.
const KPI_ID = 'kpi-gdp'
const PAGE_ID = 'page-gdp'
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'gdp',
  children: [
    {
      type: 'kpi-strip', id: KPI_ID, title: { ka: 'მაჩვენებლები', en: 'Indicators' },
      items: [
        {
          label: { ka: 'მშპ', en: 'GDP' },
          value: { measure: 'gdp.current' },
          trend: { dir: 'up', value: 3.2, period: 'YoY' },
          when:  { op: 'perspective-is', perspective: 'year' },
        },
      ],
    },
  ],
}
const SITE = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'gdp', title: { ka: 'მშპ', en: 'GDP' }, status: 'draft', updated_at: '2026-07-09T00:00:00.000Z' }

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

test('the dock shows populated summary cards for opaque rich fields — no raw JSON', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // Select the kpi-strip via the Layers outline (store-backed, canvas-independent).
  await page.getByRole('button', { name: 'Layers' }).click()
  await page.locator(`[data-outline-id="${KPI_ID}"]`).click()

  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  // Drill into the seeded KPI item — its opaque `trend`/`when` fields render inside.
  await page.getByRole('button', { name: /Edit GDP/ }).click()

  // POSITIVE — the opaque objects are now populated SummaryCards (was raw JSON).
  await expect(dock.locator('.summary-card').first()).toBeVisible()
  expect(await dock.locator('.summary-card').count()).toBeGreaterThan(0)

  // NEGATIVE — the raw-JSON textarea has left the default path entirely.
  await expect(dock.locator('.insp-field__json')).toHaveCount(0)

  await page.screenshot({ path: 'e2e/__screens__/summary-card-dock.png', fullPage: false })
})
