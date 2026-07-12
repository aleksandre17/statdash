// ── dataFlowVisible.e2e — the Data-Flow Spine, proven VISIBLE (AR-49 M4.3 · Move 3) ─
//
//  The owner's repeated grievance — "pipelines STILL not visible" — closed where a
//  unit test cannot prove it: the REAL Vite bundle in Chromium. From a DEFAULT (author)
//  session, one click reaches the data model and the pipeline is a PROMINENT, legible
//  flow map (source → dataset/spec → metric → used-by), NOT buried behind an admin
//  wall. The steward lens gets the SAME map, interactive: clicking a metric node opens
//  its editor in place — never a dead end. Drives the same governed API stub the other
//  live proofs use, so all assert one truth.
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, GOVERNED_CATALOG } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('the data pipeline is VISIBLE as a flow map — read-only for the author, interactive for the steward', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })

  // ── REACH — one click to the always-visible Data-model workspace (top bar, S5) ─
  await page.getByRole('banner')
    .getByRole('button', { name: 'Data model' }).click()
  await expect(page.getByTestId('data-dictionary')).toBeVisible()

  // ── AUTHOR SEES THE FLOW — the read-only flow map is present + legible ────────
  const map = page.getByTestId('data-flow-map')
  await expect(map).toBeVisible()
  // Both governed sources appear as the flow's ORIGIN column (projected, not authored).
  await expect(page.getByTestId('flow-source-gdp')).toBeVisible()
  await expect(page.getByTestId('flow-source-accounts')).toBeVisible()
  // Every governed metric is a node on the map (source → spec → metric → used-by).
  await expect(page.locator('[data-testid^="flow-metric-"]')).toHaveCount(GOVERNED_CATALOG.metrics.length)
  const gdp = page.getByTestId('flow-metric-gdp.current')
  await expect(gdp).toContainText('GDP at current prices')       // the metric noun
  await expect(gdp).toContainText('gross-domestic-product-at-current-prices') // the spec/code
  // The author lens is READ-ONLY: no "open editor" affordance on the map.
  await expect(page.getByTestId('flow-open-gdp.current')).toHaveCount(0)

  // ── STEWARD GETS THE SAME MAP, INTERACTIVE — never a dead end ────────────────
  await page.getByRole('button', { name: 'Edit (Steward)' }).click()
  await expect(page.getByRole('region', { name: 'Governed metric catalog' })).toBeVisible()
  const stewardMap = page.getByTestId('data-flow-map')
  await expect(stewardMap).toBeVisible()
  // Clicking a metric node on the flow map opens THAT metric's editor in place.
  await page.getByTestId('flow-open-gdp.current').click()
  await expect(page.getByRole('button', { name: /Back to catalog/ })).toBeVisible()
})
