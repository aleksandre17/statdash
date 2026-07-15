// ── dataModelReachable.e2e — FF-DATA-REACHABLE, the LIVE leg (AR-50 M5b) ────────
//
//  The G6 "built ≠ buried" closer, proven where jsdom cannot: the REAL Vite bundle in
//  Chromium, from a DEFAULT (author) session, reaches the whole data-model capability
//  in obvious clicks — and lands on the READ-ONLY Data Dictionary, never the raw query
//  modeler. This is the assertion the brief demands as the DoD: reachability is not a
//  unit claim, it is a running-app fact. It drives the same faithful governed API stub
//  (e2e/support/mockApi.ts) the boot/steward proofs use, so all three assert one truth.
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, GOVERNED_CATALOG } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  // Fail LOUD on any uncaught page error (the white-screen defect class).
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('a DEFAULT (author) session reaches the data model in one click — as the read-only Dictionary', async ({ page }) => {
  await page.goto('/')

  // ── BOOT — the default landing is the author lens editing shell ──────────────
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // ── REACH — the Data-model destination is a first-class, always-visible RAIL mode
  //  (relay Step 1: Data is rail-mode #1, the front door, NOT gated behind a preference
  //  toggle). ONE click opens it.
  await page.getByRole('navigation', { name: 'Studio surfaces' })
    .getByRole('button', { name: 'Data', exact: true }).click()

  // ── LAND — the data-model screen opened as the READ-ONLY Dictionary (author lens
  //  was NOT escalated), populated with the REAL governed nouns.
  await expect(page.getByRole('region', { name: 'Data model' })).toBeVisible()
  const dictionary = page.getByTestId('data-dictionary')
  await expect(dictionary).toBeVisible()
  // A governed metric with its real en label (the catalog boot populated the registry).
  await expect(page.getByTestId('dict-metric-gdp.current')).toContainText('GDP at current prices')
  // The whole governed metric set is browsable.
  await expect(page.locator('[data-testid^="dict-metric-"]')).toHaveCount(GOVERNED_CATALOG.metrics.length)
  // A governed dimension is browsable too (dbt-docs-grade dictionary, not just metrics).
  await expect(page.getByTestId('dict-dimension-time')).toBeVisible()

  // ── SAFE — the author path never met the raw query modeler (FF-AUTHOR-NO-QUERY):
  //  no "Define the governed data model" caption, no in-tool metric authoring buttons.
  await expect(page.getByText(/Define the governed data model/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New metric' })).toHaveCount(0)

  // ── OPT-IN — the in-place lens toggle upgrades to the Steward modeler on the SAME
  //  screen (explicit, never automatic) — the capability is fully reachable, gated by
  //  an intentful action, not buried.
  await page.getByRole('button', { name: 'Edit (Steward)' }).click()
  await expect(page.getByRole('region', { name: 'Governed metric catalog' })).toBeVisible()
})
