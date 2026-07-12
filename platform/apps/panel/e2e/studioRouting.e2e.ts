// ── studioRouting.e2e — REAL URL routing for the Studio (the owner's #3) ────────
//
//  The owner: "ისევ არ არის ლამაზი როუტები" (still no nice routing). This proves,
//  in the REAL Vite bundle in Chromium (the only place a URL/history claim is honest),
//  that the activity-rail surface and the selected page live in the ADDRESS BAR:
//    • clicking a Navigator pane CHANGES the URL (`/studio/<surface>`) and renders it;
//    • browser Back/Forward move between panes (real history entries);
//    • a pasted deep-link URL opens that surface — and `?page=<id>` opens that page;
//    • the `model` destination is a real route (`/studio/model`) — the focus-view is
//      deep-linkable (summoned from the top bar, SPEC S5), and Back leaves it.
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

test('the Navigator pane is real URL state — click, deep-link, and Back/Forward all work', async ({ page }) => {
  // ── BOOT — a bare `/` redirects to the default surface (a stale/typed root URL
  //  always lands somewhere valid) ──────────────────────────────────────────────
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()
  await expect(page).toHaveURL(/\/studio\/insert/)
  await expect(page.getByRole('heading', { name: 'Add', exact: true })).toBeVisible()

  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })

  // ── SWAP PANE — the URL changes and the pane renders (Add | Layers, SPEC S5) ──
  await rail.getByRole('button', { name: 'Layers', exact: true }).click()
  await expect(page).toHaveURL(/\/studio\/layers/)
  await expect(page.getByRole('heading', { name: 'Layers', exact: true })).toBeVisible()

  // ── BACK / FORWARD — real browser history moves between panes ────────────────
  await page.goBack()
  await expect(page).toHaveURL(/\/studio\/insert/)
  await expect(page.getByRole('heading', { name: 'Add', exact: true })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/studio\/layers/)
  await expect(page.getByRole('heading', { name: 'Layers', exact: true })).toBeVisible()
})

test('the Data-model focus-view is a real, deep-linkable route (/studio/model) summoned from the top bar, and Back leaves it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })

  // Enter the Data-model destination from the TOP BAR (SPEC S5 — demoted off the rail).
  await page.getByRole('banner').getByRole('button', { name: 'Data model' }).click()
  await expect(page).toHaveURL(/\/studio\/model/)
  await expect(page.getByRole('region', { name: 'Data model' })).toBeVisible()
  await expect(rail).toBeHidden() // the focus-view is a separate screen (rail not primary)

  // Back navigates OUT of the focus-view, restoring the editing shell.
  await page.goBack()
  await expect(page.getByRole('navigation', { name: 'Studio surfaces' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Data model' })).toBeHidden()
})

test('a pasted deep-link opens the surface directly; ?page= opens that page', async ({ page }) => {
  // Deep-link straight to the Layers pane (no prior click / redirect) — a permalink.
  await page.goto(`/studio/layers?page=${SEED_PAGE_ID}`)
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/\/studio\/layers/)
  await expect(page.getByRole('heading', { name: 'Layers', exact: true })).toBeVisible()

  // The `?page=` deep-link drove the store: the seeded page is the SELECTED page tab.
  await expect(page.getByRole('tab', { name: 'GDP', selected: true })).toBeVisible()
})

test('Theme + Site are top-bar-summoned surfaces OFF the rail (SPEC S5), deep-linkable and reversible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })

  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })
  // The rail carries ONLY the two Navigator panes — Theme/Site are not on it.
  await expect(rail.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Layers', exact: true })).toBeVisible()

  // Theme — summoned from the top bar into the dock; the editing shell (rail + canvas)
  // stays visible (live-repaint payoff), and Back returns to the prior surface.
  await page.getByRole('banner').getByRole('button', { name: 'Brand & theme' }).click()
  await expect(page).toHaveURL(/\/studio\/style/)
  await expect(page.getByRole('heading', { name: 'Brand & theme', exact: true })).toBeVisible()
  await expect(rail).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/studio\/insert/)

  // Site — the second project surface, likewise deep-linkable.
  await page.goto('/studio/pages-site')
  await expect(page.getByRole('heading', { name: 'Pages & Site', exact: true })).toBeVisible({ timeout: 60_000 })
})
