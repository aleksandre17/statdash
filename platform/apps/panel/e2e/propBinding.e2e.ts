// ── propBinding.e2e — dynamic property binding (⚡ / `{{ }}`) proven in the REAL bundle ─
//
//  The jsdom-can't-catch half of the binding proof: the engine/core fitness proves the
//  VALUE model (resolveBindings tri-state, additive identity); THIS proves the running app,
//  boot-to-paint in Chromium, honours a `{ $bind }` prop end-to-end:
//    1. an OK binding renders its COMPUTED value on the live canvas (the seam ran the expr
//       engine in the shipped bundle — parseFormula → evalExpr → resolved prop → shell);
//    2. a no-data / error binding renders a DECLARED HONEST state, never a fake value or a
//       silent blank (root Law 11 — "the canvas never lies");
//    3. the Inspector affordance: selecting a bound element shows the ⚡ toggle (pressed),
//       the expr editor, and a LIVE preview that updates as the author types, and the
//       toggle flips literal ↔ bind (the Builder.io ⚡ / Retool `{{ }}` gesture, felt).
//
import { test, expect, type Page, type Route } from '@playwright/test'

const GOVERNED = {
  metrics: [
    { id: 'gdp.current', code: 'gdp-cp', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel', dataSource: 'gdp' },
  ],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

// The demo prop: a `text` panel's `content`, authored as a LITERAL for one node and as a
// live `{ $bind }` for three others — OK (computed), no-data (unresolved ref), error
// (malformed expr). The OK expr is a genuine COMPUTATION (a comparison + ternary), not a
// literal passthrough, so the render proves the expr engine actually evaluated.
const OK_EXPR       = "1 < 2 ? 'BOUND-OK-VALUE' : 'NEVER'"
const PAGE_ID       = 'page-bind'
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'bind',
  children: [
    { type: 'text', id: 'text-ok',      content: { $bind: OK_EXPR } },
    { type: 'text', id: 'text-nodata',  content: { $bind: 'missingRef' } },
    { type: 'text', id: 'text-error',   content: { $bind: '1 +' } },
  ],
}
const SITE     = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'bind', title: { ka: 'ბაინდი', en: 'Bind' }, status: 'draft', updated_at: '2026-07-11T00:00:00.000Z' }

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
  // A binding must NEVER throw (the seam catches every parse/eval error) — fail LOUD if it does.
  page.on('pageerror', (err) => { throw err })
  await page.addInitScript(() => window.sessionStorage.setItem('geostat_panel_token', 'e2e-token'))
  await mock(page)
})

test('a bound prop renders its computed value live; no-data/error render honest states', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // 1. OK binding — the canvas shows the COMPUTED value (the expr engine ran in the real
  //    bundle: `1 < 2 ? 'BOUND-OK-VALUE' : 'NEVER'` → 'BOUND-OK-VALUE'). This is the exact
  //    Builder.io ⚡ / Retool `{{ }}` payoff: a live-evaluated property on the canvas.
  await expect(page.getByText('BOUND-OK-VALUE', { exact: false })).toBeVisible({ timeout: 60_000 })

  // 2. HONEST states (Law 11) — a binding that resolved to no-data at the current context,
  //    and one whose expr is malformed, each render a DECLARED honest placeholder rather
  //    than a fabricated value or a silent blank.
  await expect(page.locator('[data-binding-state="no-data"]')).toBeVisible()
  await expect(page.locator('[data-binding-state="error"]')).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/prop-binding-canvas.png', fullPage: false })
})

test('the Inspector ⚡ affordance: bound field shows the editor + a live preview, and toggles', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // Select the bound text node via its overlay frame (a whole-node selection).
  await page.locator('[data-node-id="text-ok"]').click({ timeout: 60_000 })
  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  // The content field is BOUND → the ⚡ toggle is pressed and the expr editor is shown
  // (the literal LocaleField is swapped for the bind editor — the felt affordance).
  const toggle = dock.locator('.insp-bind__toggle[aria-pressed="true"]').first()
  await expect(toggle).toBeVisible()
  const expr = dock.locator('.insp-bind__expr').first()
  await expect(expr).toHaveValue(OK_EXPR)

  // LIVE preview — the Retool inline result: the editor evaluates the expr and shows it.
  await expect(dock.locator('.insp-bind__preview').first()).toContainText('BOUND-OK-VALUE')

  // "writes an expr, sees a live preview" — retype and watch the preview recompute live.
  await expr.fill("'RETYPED-LIVE'")
  await expect(dock.locator('.insp-bind__preview').first()).toContainText('RETYPED-LIVE')

  // The literal ↔ bind gesture — flipping ⚡ off returns a fixed-value control (unpressed).
  await toggle.click()
  await expect(dock.locator('.insp-bind__toggle[aria-pressed="false"]').first()).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/prop-binding-inspector.png', fullPage: false })
})
