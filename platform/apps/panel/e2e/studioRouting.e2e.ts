// ── studioRouting.e2e — REAL URL routing for the Studio (the owner's #3) ────────
//
//  The owner: "ისევ არ არის ლამაზი როუტები" (still no nice routing). This proves,
//  in the REAL Vite bundle in Chromium (the only place a URL/history claim is honest),
//  that the activity-rail surface and the selected page live in the ADDRESS BAR:
//    • clicking a surface CHANGES the URL (`/studio/<surface>`) and renders it;
//    • browser Back/Forward move between surfaces (real history entries);
//    • a pasted deep-link URL opens that surface — and `?page=<id>` opens that page;
//    • the `model` destination is a real route (`/studio/model`) — the focus-view is
//      deep-linkable, and Back leaves it.
//  It drives the same governed API stub (e2e/support/mockApi.ts) the boot/steward
//  proofs use, so all the panel e2e legs assert one truth.
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, SEED_PAGE_ID } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  // Fail LOUD on any uncaught page error (the white-screen defect class).
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('the activity-rail surface is real URL state — click, deep-link, and Back/Forward all work', async ({ page }) => {
  // ── BOOT — a bare `/` redirects to the default surface (a stale/typed root URL
  //  always lands somewhere valid) ──────────────────────────────────────────────
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()
  await expect(page).toHaveURL(/\/studio\/insert/)
  await expect(page.getByRole('heading', { name: 'Insert', exact: true })).toBeVisible()

  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })

  // ── CLICK A SURFACE — the URL changes and the surface renders ────────────────
  await rail.getByRole('button', { name: 'Data', exact: true }).click()
  await expect(page).toHaveURL(/\/studio\/data/)
  await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible()

  await rail.getByRole('button', { name: 'Style', exact: true }).click()
  await expect(page).toHaveURL(/\/studio\/style/)
  await expect(page.getByRole('heading', { name: 'Style', exact: true })).toBeVisible()

  // ── BACK / FORWARD — real browser history moves between surfaces ─────────────
  await page.goBack()
  await expect(page).toHaveURL(/\/studio\/data/)
  await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/studio\/insert/)
  await expect(page.getByRole('heading', { name: 'Insert', exact: true })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/studio\/data/)
  await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible()
})

test('the Data-model focus-view is a real, deep-linkable route (/studio/model), and Back leaves it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })

  // Enter the Data-model destination — a real route; the editing shell chrome is gone.
  await rail.getByRole('button', { name: 'Data model' }).click()
  await expect(page).toHaveURL(/\/studio\/model/)
  await expect(page.getByRole('region', { name: 'Data model' })).toBeVisible()
  await expect(rail).toBeHidden() // the focus-view is a separate screen (rail not primary)

  // Back navigates OUT of the focus-view, restoring the editing shell.
  await page.goBack()
  await expect(page.getByRole('navigation', { name: 'Studio surfaces' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Data model' })).toBeHidden()
})

test('a pasted deep-link opens the surface directly; ?page= opens that page', async ({ page }) => {
  // Deep-link straight to the Style surface (no prior click / redirect) — a permalink.
  await page.goto(`/studio/style?page=${SEED_PAGE_ID}`)
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/\/studio\/style/)
  await expect(page.getByRole('heading', { name: 'Style', exact: true })).toBeVisible()

  // The `?page=` deep-link drove the store: the seeded page is the SELECTED page tab.
  await expect(page.getByRole('tab', { name: 'GDP', selected: true })).toBeVisible()
})
