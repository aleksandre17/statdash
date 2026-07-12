// ── bandItemSelect.e2e — BE-1 LIVE proof (bounded value-band selection, ADR-038) ─
//
//  The owner's #1: "you can't click a KPI card separately — clicking a KPI selects
//  the whole strip, and everything dumps onto the right and doesn't fit." This drives
//  the REAL Vite bundle in Chromium and proves, on a real click, that:
//    • clicking a single KPI CARD on the canvas selects it as a BOUNDED element
//      (the per-item overlay frame, `[data-item-path]`, exists and is clickable);
//    • the right dock then shows ONLY that card's OWN declared contract (its Label,
//      etc.) — NOT the whole strip and NOT the value-band array list (it FITS);
//    • the mechanism is generic (the card is a `kpi-strip.items[]` member reached by
//      its declared `itemSchema` — no per-type wire; FF-NO-EXTERNAL-SPECIAL-CASE).
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

// A seed page carrying a kpi-strip with TWO items, both ALWAYS visible (no `when`),
// with DISTINCT labels so "only THIS card" is provable. Each card is a value-band
// `items[]` member — a bounded element reached by its declared `itemSchema`.
const STRIP_ID = 'kpi-macro'
const PAGE_ID = 'page-macro'
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'macro',
  children: [
    {
      type: 'kpi-strip', id: STRIP_ID, title: { ka: 'მაჩვენებლები', en: 'Indicators' },
      items: [
        { id: 'kpi-pop', label: { ka: 'მოსახლეობა', en: 'Population' }, value: { type: 'point', measure: 'gdp.current', time: 2024 } },
        { id: 'kpi-gdp', label: { ka: 'მშპ',        en: 'GDP' },        value: { type: 'point', measure: 'gdp.current', time: 2024 } },
      ],
    },
  ],
}
const SITE = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'macro', title: { ka: 'მაკრო', en: 'Macro' }, status: 'draft', updated_at: '2026-07-11T00:00:00.000Z' }

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

test('clicking a single KPI card selects it as a BOUNDED element — the dock shows ONLY its contract', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // The canvas renders the strip; the overlay stamps one per-item frame per declared
  // band item (PartAnchor → data-part-field/index, measured by CanvasOverlay),
  // addressed by the item's ONE PartAddress.partPath — for a VALUE band that is the
  // POSITIONAL `${field}.${index}` (ADR-041 Delta 1: value parts stay positional), so
  // the selector is byte-identical after the Phase-3 collapse onto the port.
  const card1 = page.locator('[data-item-path="items.1"]')
  await expect(card1).toBeVisible({ timeout: 60_000 })

  // CLICK the SECOND card — this is the owner's #1 gesture (was: selects the strip).
  await card1.click()

  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  // BOUNDED — the dock shows the drill crumb back to the owning strip (the bounded
  // child's context: `‹ kpi-strip  › GDP`), and its Label FORM field carries this
  // card's value. The Label is the first field of the item's itemSchema, so the first
  // localized input is its `en` value; the crumb chip shows the item title as text.
  await expect(dock.getByRole('button', { name: /kpi-strip/ })).toBeVisible()
  await expect(dock.getByText('GDP', { exact: true })).toBeVisible()          // the crumb title
  await expect(dock.locator('.insp-locale__input').first()).toHaveValue('GDP') // the Label field

  // FITS / not the whole strip: the OTHER card is absent from the dock, and the
  // value-band ARRAY LIST (the strip-level "everything dumps" surface) is not rendered.
  await expect(dock.getByText('Population')).toHaveCount(0)
  await expect(dock.locator('.insp-nested__list')).toHaveCount(0)

  await page.screenshot({ path: 'e2e/__screens__/band-item-bounded-dock.png', fullPage: false })

  // Selecting the OTHER card re-projects the dock onto ITS contract (generic, per-item).
  await page.locator('[data-item-path="items.0"]').click()
  await expect(dock.locator('.insp-locale__input').first()).toHaveValue('Population')
  await expect(dock.getByText('GDP', { exact: true })).toHaveCount(0)
})
