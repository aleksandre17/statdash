// ── chromeNavAuthoring.e2e — chrome + left-bar nav are AUTHORABLE (deep-authorability) ─
//
//  The gate the owner hit repeatedly on the live panel: "chrome functionality STILL
//  not visible anywhere" + "STILL can't touch the left-bar navigations." Proven where
//  jsdom cannot — the REAL Vite bundle in Chromium, a DEFAULT session:
//    1. CHROME is reachable + selectable: the Pages&Site surface carries a Chrome
//       section (ChromePalette); picking a chrome element opens its schema-driven
//       editor in the RightDock (the SAME generic Inspector nodes use).
//    2. The LEFT-BAR NAV is deep-editable: a nav entry's label is editable inline
//       (updateNavItem), and the edit REFLECTS live — the entry row AND the canvas's
//       InnerSidebar rail repaint the new label (WYSIWYG, projectCanvasSiteChrome).
//
//  Drives the same faithful governed API stub (support/mockApi.ts) the boot/steward
//  proofs use; the stub seeds ONE page-backed nav entry (NAV_ENTRY_LABEL).
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, NAV_ENTRY_LABEL } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  // Fail LOUD on any uncaught page error (the white-screen defect class).
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('chrome + left-bar nav are authorable from the Studio (deep-authorability)', async ({ page }) => {
  await page.goto('/')

  // ── BOOT — the default landing is the author-lens editing shell ───────────────
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // ── REACH — open the site authoring home (identity · nav · chrome) ────────────
  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })
  await rail.getByRole('button', { name: 'Pages & Site' }).click()

  // ── CHROME is VISIBLE + SELECTABLE (the "not visible anywhere" closer) ────────
  //  Chrome is site furniture — it lives here, next to identity + nav (correct IA),
  //  not buried in the page-content Insert palette.
  const palette = page.getByTestId('chrome-palette')
  await expect(palette).toBeVisible()
  // Picking a registered chrome element selects it → its editor opens in the RightDock.
  await palette.getByRole('button').first().click()
  await expect(page.getByTestId('chrome-inspector')).toBeVisible()
  // It is the SAME generic Inspector (no forked chrome UI) — schema-driven fields.
  await expect(page.getByTestId('inspector')).toBeVisible()

  // ── LEFT-BAR NAV is DEEP-EDITABLE (the "can't touch the nav" closer) ──────────
  //  The entry is present (its Edit affordance's a11y name derives from the live label).
  await expect(page.getByRole('button', { name: `Edit ${NAV_ENTRY_LABEL.en}` })).toBeVisible()
  // The canvas's InnerSidebar rail renders the SAME authored label (WYSIWYG parity).
  await expect(page.locator('[data-nav-entry] a').filter({ hasText: NAV_ENTRY_LABEL.en }).first()).toBeVisible()

  // Progressive disclosure: the per-entry editor is hidden until Edit is clicked.
  await expect(page.getByLabel('Label (en)')).toHaveCount(0)
  await page.getByRole('button', { name: `Edit ${NAV_ENTRY_LABEL.en}` }).click()

  // Edit the label — the write goes through updateNavItem.
  const labelEn = page.getByLabel('Label (en)')
  await expect(labelEn).toHaveValue(NAV_ENTRY_LABEL.en)
  await labelEn.fill('Homepage')

  // ── REFLECTS — the edit is SEEN: the entry's own a11y name repaints from the store
  //  AND the live canvas rail repaints the new label (store → projectCanvasSiteChrome
  //  → rail cascade). Nothing that renders is un-buildable.
  await expect(page.getByRole('button', { name: 'Edit Homepage' })).toBeVisible()
  await expect(page.locator('[data-nav-entry] a').filter({ hasText: 'Homepage' }).first()).toBeVisible()
})
