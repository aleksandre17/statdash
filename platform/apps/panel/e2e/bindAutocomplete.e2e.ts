// ── bindAutocomplete.e2e — the schema-aware binding editor, proven in the REAL bundle ─
//
//  The jsdom-can't-catch half of mission #4 (Retool-class autocomplete): the fitness
//  test proves the pure vocabulary is GOVERNED-noun-first; THIS proves the running app
//  turns that into a felt gesture, boot-to-paint in Chromium:
//    1. selecting a bound element shows the expr editor as an ACCESSIBLE combobox;
//    2. typing surfaces a GOVERNED metric (its bilingual label), NEVER the raw code;
//    3. picking it INSERTS the governed id into the serializable expr (Law 2);
//    4. the live preview updates; a malformed expr shows a FRIENDLY message.
//
import { test, expect, type Page, type Route } from '@playwright/test'

// A governed catalog whose metric LABEL ('GDP') differs from its raw CODE ('gdp-cp') —
// the decisive shape: the author must see the noun, never the code.
const GOVERNED = {
  metrics: [
    { id: 'gdp.current', code: 'gdp-cp', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'GEL mn' }, format: 'mln_gel', dataSource: 'gdp' },
  ],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}

const PAGE_ID = 'page-auto'
// One text node with a valid OK binding so it renders real content and carries a
// selectable [data-node-id] overlay (an empty/no-data binding renders only an honest
// placeholder note). The test clears the field before typing the governed prefix.
const SEED_EXPR = "'seed'"
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'auto',
  children: [{ type: 'text', id: 'text-auto', content: { $bind: SEED_EXPR } }],
}
const SITE     = { name: 'e2e', defaultLocale: 'en', activeLocales: ['en', 'ka'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'auto', title: { ka: 'ავტო', en: 'Auto' }, status: 'draft', updated_at: '2026-07-11T00:00:00.000Z' }

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

test('the binding editor autocompletes GOVERNED nouns; picking inserts the governed id; preview + friendly error', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // Select the bound node → the Inspector shows the bind editor (combobox).
  await page.locator('[data-node-id="text-auto"]').click({ timeout: 60_000 })
  const dock = page.locator('.studio-dock')
  await expect(dock).toBeVisible()

  const combo = dock.locator('.insp-expr-ac__input').first()
  await expect(combo).toBeVisible()
  await expect(combo).toHaveRole('combobox')

  // Type a prefix of the GOVERNED metric noun → the listbox offers 'GDP' (the label),
  // and NEVER the raw code 'gdp-cp' (Law 1 governed-noun-first).
  await combo.click()
  await combo.fill('gd')
  const listbox = dock.getByRole('listbox')
  await expect(listbox).toBeVisible()
  const gdpOption = listbox.getByRole('option').filter({ hasText: 'GDP' }).first()
  await expect(gdpOption).toBeVisible()
  await expect(listbox).not.toContainText('gdp-cp') // the raw code never leaks

  // Pick it → the serializable expr becomes the GOVERNED id (Law 2: a string ref).
  await gdpOption.click()
  await expect(combo).toHaveValue('gdp.current')

  // The live preview stays honest (a bare governed id resolves live on the canvas).
  await expect(dock.locator('.insp-bind__preview').first()).toBeVisible()

  // Friendly validation — a malformed expr shows a readable message, never a raw throw.
  await combo.fill('1 +')
  await expect(dock.locator('.insp-bind__preview--error').first()).toBeVisible()

  await page.screenshot({ path: 'e2e/__screens__/bind-autocomplete.png', fullPage: false })
})
