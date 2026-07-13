// ── chromeNavAuthoring.e2e — chrome + left-bar nav are AUTHORABLE (deep-authorability) ─
//
//  The gate the owner hit repeatedly on the live panel: "chrome functionality STILL
//  not visible anywhere" + "STILL can't touch the left-bar navigations." Proven where
//  jsdom cannot — the REAL Vite bundle in Chromium, a DEFAULT session:
//    1. CHROME is reachable + selectable ON THE CANVAS (S6 fold): the canvas paints the
//       WHOLE app shell (AppChrome) — the app HEADER + FOOTER regions AROUND the page, plus
//       the page-embedded InnerSidebar rail. Clicking any rendered region on the live home
//       canvas selects the ONE PartAddress, and its schema-driven editor opens in the
//       RightDock (the SAME generic Inspector nodes use — no palette, no forked chrome
//       panel). PLUS the labeled "Site & chrome" top-bar entry opens the whole-set
//       composition (enable/disable/swap each region) — the second, discoverable way in.
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
  //  now renders the WHOLE app SHELL (AppChrome): the app HEADER (top) + FOOTER (bottom)
  //  regions AROUND the page, plus the page-embedded InnerSidebar rail. Clicking ANY region
  //  selects the ONE PartAddress and opens its schema-driven editor in the RightDock — the
  //  SAME generic Inspector nodes use. First the app-shell HEADER (the render-gap fix — it
  //  did not render at all before AppChrome wrapped the canvas):
  const headerFrame = page.locator('.canvas-chrome[data-chrome-slot="AppHeader"]')
  await expect(headerFrame).toBeVisible({ timeout: 30_000 })
  await headerFrame.click()
  // Its chrome facet opens in the RightDock — the generic Inspector with the structural
  // controls (variant / region / order selects) projected for the site-frame chrome part.
  // A rich chrome region (AppHeader) yields BOTH a structural facet section AND its per-slot
  // config section, so the dock mounts more than one Inspector — assert at least one opened
  // AND that the structural chrome control (a variant/region select) is present in the dock.
  await expect(page.getByTestId('inspector').first()).toBeVisible()
  await expect(page.locator('.studio-right-dock').getByRole('combobox').first()).toBeVisible()

  // The page-embedded sidebar region is selectable the SAME way (proven pre-S6).
  const sidebarFrame = page.locator('.canvas-chrome[data-chrome-slot="InnerSidebar"]')
  await expect(sidebarFrame).toBeVisible()
  await sidebarFrame.click()
  await expect(page.getByTestId('inspector').first()).toBeVisible()

  // ── REACH — open the site authoring home from the LABELED top-bar entry (the second,
  //  discoverable way in). SPEC S5: Site is a top-bar-summoned surface; the entry now
  //  carries a VISIBLE "Site & chrome" label (the icon-only button was un-findable). It
  //  renders in the left dock — canvas + RightDock stay visible. ──
  await page.getByRole('banner').getByRole('button', { name: 'Site & chrome' }).click()

  // ── The WHOLE-CHROME-SET composition is reachable DIRECTLY here (not via region+Back) ──
  //  Enable/disable/swap every region's variant from ONE panel — incl. regions switched OFF
  //  (not clickable on the canvas). Editing writes the site.chrome SSOT and the canvas
  //  re-renders: switch the FOOTER off (hidden) → its canvas frame disappears.
  const composition = page.getByTestId('chrome-composition')
  await expect(composition).toBeVisible()
  await expect(page.locator('.canvas-chrome[data-chrome-slot="AppFooter"]')).toBeVisible()
  await composition.getByTestId('chrome-row-AppFooter').getByRole('combobox').click()
  await page.getByRole('option').filter({ hasText: /Hidden|გამორთ/i }).first().click()
  // site.chrome edit → the footer region no longer renders → the overlay drops its frame.
  await expect(page.locator('.canvas-chrome[data-chrome-slot="AppFooter"]')).toHaveCount(0)

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
