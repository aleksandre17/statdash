// ── filterItemSelect.e2e — BE-4 LIVE proof (filter items are bounded elements) ───
//
//  The owner's BE-4 symptom: "the filtration items are also not objects." In the
//  canvas an individual filter (year-select, region-select, …) was NOT clickable as
//  a bounded element the way a KPI card is — only the whole filter-bar node selected.
//  This drives the REAL Vite bundle in Chromium and proves, on a real click, that:
//    • clicking a single FILTER CONTROL on the canvas selects it as a BOUNDED element
//      (its per-item overlay frame `[data-item-path="main.<controlKey>"]` — the ADR-041
//      Delta-1 STABLE key `${barId}.${controlKey}`, not a position — exists + is clickable);
//    • the right dock then shows ONLY that control's OWN declared contract — its
//      DISCRIMINATED ParamDef schema (year-select fields: Time dimension, Default
//      year, …) resolved via the engine param-schema registry — and FITS;
//    • the mechanism is generic: the filter-bar DECLARES `band.source: 'page-filters'`
//      in its META and the values are read/written through the page `filterSchema`
//      SSOT (no denormalised node copy, no per-type wire — FF-NO-EXTERNAL-SPECIAL-CASE
//      + FF-FILTER-ITEMS-DECLARED-BAND).
//
//  jsdom masks boot-wiring — this goes through the REAL panel boot (registry populated
//  by App.startApp, the filter-bar rendered by NodePageRenderer + useFilterState).
//
import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const GOVERNED = {
  metrics: [],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

// A seed page carrying a page-level `filterSchema` with a `main` bar of TWO controls
// (distinct labels so "only THIS control" is provable), and a filter-bar node that
// projects that bar. Each control is a page-owned, DISCRIMINATED band item reached by
// the filter-bar's DECLARED band source — NOT a value on the node.
const FILTER_BAR_ID = 'fb-main'
const PAGE_ID = 'page-macro'
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'macro',
  filterSchema: {
    bars: {
      main: {
        position: 'sticky',
        filters: {
          alpha: { type: 'year-select', label: { ka: 'ალფა', en: 'AlphaFilter' }, default: 2024 },
          beta:  { type: 'year-select', label: { ka: 'ბეტა',  en: 'BetaFilter'  }, default: 2020 },
        },
      },
    },
    context: { dims: { time: 'alpha' } },
  },
  children: [
    { type: 'filter-bar', id: FILTER_BAR_ID, barIds: ['main'] },
  ],
}
const SITE = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'macro', title: { ka: 'მაკრო', en: 'Macro' }, status: 'draft', updated_at: '2026-07-12T00:00:00.000Z' }

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

test('clicking a single filter control selects it as a BOUNDED element — the dock shows ONLY its ParamDef contract', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // The canvas renders the filter-bar (NodePageRenderer + useFilterState); the overlay
  // stamps one per-item frame per rendered control (PartAnchor → data-part-field/index,
  // measured by CanvasOverlay), addressed by the page-owned band's ONE STABLE-KEY
  // PartAddress `${barId}.${controlKey}` (ADR-041 Delta 1) — here `main.beta`.
  const beta = page.locator('[data-item-path="main.beta"]')
  await expect(beta).toBeVisible({ timeout: 60_000 })

  // CLICK the SECOND control — the owner's BE-4 gesture (was: selected the whole bar).
  await beta.click()

  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  // BOUNDED — the dock shows the crumb back to the owning filter-bar (‹ filter-bar › BetaFilter)
  // and projects ONLY this control's OWN declared ParamDef contract (the year-select
  // schema: "Time dimension" / "Default year" — resolved via getParamSchema, discriminated).
  await expect(dock.getByRole('button', { name: /filter-bar/ })).toBeVisible()
  await expect(dock.getByText('BetaFilter', { exact: true })).toBeVisible() // the crumb title
  await expect(dock.getByText('Default year')).toBeVisible()               // a year-select-only field

  // FITS / not the whole bar: the OTHER control is absent, and the strip-level filter
  // ARRAY LIST (the "everything dumps" surface) is not rendered.
  await expect(dock.getByText('AlphaFilter', { exact: true })).toHaveCount(0)
  await expect(dock.locator('.insp-nested__list')).toHaveCount(0)

  await page.screenshot({ path: 'e2e/__screens__/filter-item-bounded-dock.png', fullPage: false })

  // Selecting the OTHER control re-projects the dock onto ITS contract (generic, per-item).
  await page.locator('[data-item-path="main.alpha"]').click()
  await expect(dock.getByText('AlphaFilter', { exact: true })).toBeVisible()
  await expect(dock.getByText('BetaFilter', { exact: true })).toHaveCount(0)
})
