// ── thresholdFormat.e2e — conditional formatting (thresholds) in the REAL bundle ─
//
//  The live leg of the threshold slice. The node/jsdom fitness prove the pipeline
//  (FF-KPI-THRESHOLD: value→token/glyph honestly; FF-KPI-CARD-THRESHOLD: the DOM
//  recolours + glyph). THIS proves the running app, boot-to-paint in Chromium against
//  the real Vite bundle:
//    1. BOOT — a page whose KPI config CARRIES `thresholds` paints with no white-screen
//       (the fresh source carries resolveValueThreshold — the stale-dist defect class);
//    2. HONEST (Law 11) — a KPI whose value is no-data (empty structural store) renders
//       its declared honest affordance and NO threshold glyph: a threshold colours a
//       real value only, never a fabricated 0;
//    3. AUTHORING — selecting the KPI card projects the "Conditional formatting" field
//       onto its bounded contract as the friendly step-list editor (NOT raw JSON), and
//       the author ADDS a step live (the Grafana thresholds gesture, felt end-to-end).
//
import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const GOVERNED = {
  metrics: [
    { id: 'gdp.realGrowth', code: 'real-gdp-growth-rates', label: { ka: 'რეალური ზრდა', en: 'Real growth' }, format: 'sign_pct', dataSource: 'gdp' },
  ],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

// A kpi-strip with ONE item, bound to a governed measure AND carrying an authored
// two-sided threshold (below-zero danger + down glyph, at/above-zero success + up
// glyph). Against the empty structural store the value is no-data — so the card must
// render its honest state, and the threshold must apply to nothing (leg 2).
const STRIP_ID = 'kpi-th'
const PAGE_ID = 'page-th'
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'th',
  children: [
    {
      type: 'kpi-strip', id: STRIP_ID, title: { ka: 'მაჩვენებელი', en: 'Indicator' },
      items: [
        {
          id: 'kpi-growth', label: { ka: 'ზრდა', en: 'Growth' },
          value: { type: 'point', measure: 'gdp.realGrowth', time: 2024, format: 'sign_pct' },
          thresholds: [
            { from: 0, token: 'status.positive-fg', glyph: 'up',   state: { ka: 'ზრდა', en: 'On track' } },
            {          token: 'status.negative-fg', glyph: 'down', state: { ka: 'ვარდნა', en: 'Below target' } },
          ],
        },
      ],
    },
  ],
}
const SITE = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'th', title: { ka: 'ზღვარი', en: 'Threshold' }, status: 'draft', updated_at: '2026-07-11T00:00:00.000Z' }

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
  // A threshold-carrying config must NEVER throw at boot (the resolver is honest) —
  // fail LOUD if it does (the stale-dist / white-screen class).
  page.on('pageerror', (err) => { throw err })
  await page.addInitScript(() => window.sessionStorage.setItem('geostat_panel_token', 'e2e-token'))
  await mock(page)
})

test('boot + honest: a thresholds-carrying KPI paints; a no-data value gets NO threshold glyph', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // The strip's single value-band item renders (its PartAnchor stamped the frame) —
  // proof the fresh bundle interpreted a KPI whose config carries `thresholds` without
  // throwing (the resolver loaded; no white-screen).
  const card = page.locator('[data-item-path="items.0"]')
  await expect(card).toBeVisible({ timeout: 60_000 })

  // HONEST (Law 11): the value is no-data on the empty structural store → the card shows
  // its declared honest affordance, and NO threshold glyph is rendered (a threshold
  // colours a real value only — never a fabricated 0). `.kpi-value-glyph` exists ONLY
  // when a genuine `ok` value matched a step.
  await expect(page.locator('.kpi-value-glyph')).toHaveCount(0)

  await page.screenshot({ path: 'e2e/__screens__/threshold-honest-canvas.png', fullPage: false })
})

test('authoring: selecting the KPI card projects the Conditional formatting editor; the author adds a step', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // Select the KPI card as a BOUNDED element (its value-band item contract).
  await page.locator('[data-item-path="items.0"]').click({ timeout: 60_000 })
  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  // The item's declared `thresholds` field is concern:'style' — expand the ITEM-level
  // Style concern group (collapsed by default; Content is the only one open). Target it
  // by its aria-controls (distinct from the nested `value` object's own Style group).
  const styleGroup = dock.locator('button.concern-group__toggle[aria-controls="insp-items-0-style-body"]')
  await styleGroup.scrollIntoViewIfNeeded()
  await styleGroup.click()

  // The "Conditional formatting" field is projected onto the bounded contract as the
  // friendly step-list editor — the add-step affordance proves it resolved to
  // ThresholdField (NOT the raw-JSON fallback).
  await expect(dock.getByText('Conditional formatting')).toBeVisible()
  const addStep = dock.getByRole('button', { name: 'ბიჯის დამატება' })
  await addStep.scrollIntoViewIfNeeded()
  await expect(addStep).toBeVisible()

  // ADD a step — the Grafana thresholds gesture, felt live. A step row appears
  // (the list grew from empty to one authored breakpoint).
  await addStep.click()
  await expect(dock.getByText(/ბიჯი 1/)).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/threshold-authoring-dock.png', fullPage: false })
})
