// ── craftScreens — LOCAL screenshot proof for the CRAFT wave (card 0078) ──────
//
//  NOT a gate: an instrument that boots the REAL runner bundle against the
//  recorded governed API fixtures (e2e/fixtures/api-fixtures.json, same replay as
//  rangeSliderBrush.e2e.ts) and captures each interaction surface in LIGHT and
//  DARK, closed and open — the "LOOK" evidence the owner's round-3 verdict demands.
//  Screenshots land in work/portal-walk/craft-*.png. Run:
//     pnpm exec playwright test craftScreens
//
import { test, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const DIR = dirname(fileURLToPath(import.meta.url))
const FIXTURE_FILE = join(DIR, 'fixtures', 'api-fixtures.json')
const OUT = join(DIR, '..', '..', '..', '..', 'work', 'portal-walk')

type Fixture = { status: number; contentType: string; encoding: 'utf8' | 'base64'; body: string }

async function installFixtures(page: Page) {
  const fixtures: Record<string, Fixture> = JSON.parse(readFileSync(FIXTURE_FILE, 'utf8'))
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const hit = fixtures[url.pathname + url.search]
    if (!hit) { await route.fulfill({ status: 404, body: '{}' }); return }
    await route.fulfill({
      status: hit.status,
      contentType: hit.contentType,
      body: hit.encoding === 'utf8' ? hit.body : Buffer.from(hit.body, 'base64'),
    })
  })
}

async function setTheme(page: Page, mode: 'light' | 'dark') {
  // Click the real theme switcher so the store flips + charts recolor (not just a
  // CSS attribute poke). Buttons are ordered [light, dark]; pick by title/pressed.
  const btn = page.locator('.theme-switcher__btn').nth(mode === 'dark' ? 1 : 0)
  if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForTimeout(900) }
}

test('craft screens: multi-select, sidebar, brush — light + dark', async ({ page }) => {
  await installFixtures(page)

  for (const mode of ['light', 'dark'] as const) {
    // ── Regional: the sector multi-select (the owner's „საშინელებაა" surface) ──
    await page.goto('/ka/regional', { waitUntil: 'domcontentloaded' })
    await page.locator('.filter-bar, .filter-control__multiselect').first().waitFor({ timeout: 30000 }).catch(() => {})
    await setTheme(page, mode)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(OUT, `craft-${mode}-01-regional-closed.png`) })

    const trigger = page.locator('.filter-control__multiselect').first()
    if (await trigger.count()) {
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click().catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({ path: join(OUT, `craft-${mode}-02-multiselect-open.png`) })
      // Keyboard walk: arrow down + toggle two options with Space, then Escape.
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(OUT, `craft-${mode}-03-multiselect-selected.png`) })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(OUT, `craft-${mode}-04-trigger-chips.png`) })
    }

    // ── Sidebar hover overlay ──
    const rail = page.locator('.inner-sidebar').first()
    if (await rail.count()) {
      await rail.hover().catch(() => {})
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(OUT, `craft-${mode}-05-sidebar-hover.png`) })
      await page.mouse.move(900, 700)
    }

    // ── GDP dynamics: gray→blue charts + brush navigator ──
    await page.goto('/ka/gdp', { waitUntil: 'domcontentloaded' })
    await page.locator('.filter-bar, h1').first().waitFor({ timeout: 30000 }).catch(() => {})
    await setTheme(page, mode)
    const dyn = page.getByText('დინამიკა', { exact: false }).first()
    if (await dyn.count()) { await dyn.click().catch(() => {}); await page.waitForTimeout(1600) }
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 300)) }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(OUT, `craft-${mode}-06-gdp-dynamics.png`), fullPage: true })
  }
})
