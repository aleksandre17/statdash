// ── chromeNavAuthoring.e2e — chrome + left-bar nav are AUTHORABLE (deep-authorability) ─
//
//  The gate the owner hit repeatedly on the live panel: "chrome functionality STILL
//  not visible anywhere" + "STILL can't touch the left-bar navigations." Proven where
//  jsdom cannot — the REAL Vite bundle in Chromium, a DEFAULT session:
//    1. CHROME is reachable + selectable ON THE CANVAS (S6 fold): chrome is a Part of the
//       site-frame — clicking the rendered InnerSidebar region on the live home canvas
//       selects the ONE PartAddress, and its schema-driven editor opens in the RightDock
//       (the SAME generic Inspector nodes use — no palette, no forked chrome panel).
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

  // ── CHROME is VISIBLE + SELECTABLE ON THE CANVAS (the "not visible anywhere" closer) ─
  //  S6: chrome is a Part of the site-frame — no palette, no forked panel. The home canvas
  //  renders the REAL InnerSidebar rail; clicking its region selects the ONE PartAddress
  //  ({ site-frame, chrome.InnerSidebar }) and opens its schema-driven editor in the
  //  RightDock — the SAME generic Inspector nodes use.
  const chromeFrame = page.locator('.canvas-chrome[data-chrome-slot="InnerSidebar"]')
  await expect(chromeFrame).toBeVisible({ timeout: 30_000 })
  await chromeFrame.click()
  // Its editor opens in the RightDock — the SAME generic Inspector (schema-driven fields),
  // projected through the ONE `element.schema` dock section (no chrome-specific dock).
  await expect(page.getByTestId('inspector')).toBeVisible()

  // ── REACH — open the site authoring home (identity · nav) from the TOP BAR (SPEC S5:
  //  Pages & Site is demoted off the rail to a top-bar-summoned surface; it renders in the
  //  left dock, the canvas + RightDock stay visible). ──
  await page.getByRole('banner').getByRole('button', { name: 'Pages & Site' }).click()

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
