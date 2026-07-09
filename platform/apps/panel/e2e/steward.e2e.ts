// ── steward.e2e — the M2.2 headline proof: in-tool metric authoring, real browser ─
//
//  AR-49 M2.2's headline capability — a non-programmer STEWARD defines a governed
//  metric in-tool, and an AUTHOR immediately sees it as a bindable noun — is proven
//  at vitest-integration level but had NOT been proven in a real browser. This spec
//  is that missing "green ≠ works" closer: it drives the REAL Vite bundle in Chromium
//  through the whole steward-authors → author-sees loop against the faithful governed
//  API stub (e2e/support/mockApi.ts), asserting the ONE thing jsdom cannot — that the
//  live MUI form, the role-lens surface projection, the PUT→register→invalidate save
//  loop, and the palette re-read all cohere in a running browser.
//
//  The loop, end to end:
//    1. BOOT      — author lens, the Studio mounts (no white-screen / boot-order crash).
//    2. LENS      — flip the top-bar "Model mode" toggle → the Steward lens unlocks the
//                   Model rail slot (role is a LENS over ONE document, not a route).
//    3. MODEL     — open Model → the MetricCatalogManager (headline region) renders.
//    4. AUTHOR    — New metric → PICK dataset + measure (assert the unit PRE-FILLS from
//                   the cube's resolved unit) → set a slug-legal id + a bilingual
//                   GOVERNED label + a display format → Create.
//    5. SAVE      — assert the save-success feedback ("…now in the palette").
//    6. AUTHOR-SEES — flip back to the author lens → open Data → assert the newly
//                   authored metric is in the MetricPalette by its GOVERNED label
//                   (distinct from the cube measure label → proves the steward's
//                   governance text round-tripped, not merely the cube echo).
//
import { test, expect } from '@playwright/test'
import {
  mockPanelApi, seedAuthToken, GOVERNED_CATALOG, STEWARD_DATASET, STEWARD_PROFILE, AUTHORED_METRIC,
} from './support/mockApi'

test.beforeEach(async ({ page }) => {
  // Fail LOUD on any uncaught page error (the M0-class white-screen defect) instead
  // of silently proceeding — the assertion jsdom structurally cannot make.
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('steward authors a governed metric in-tool → the author sees it in the palette', async ({ page }) => {
  await page.goto('/')

  // ── 1. BOOT (author lens is the default landing — safety-by-default) ─────────
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // ── 2. LENS — flip to the Steward lens via the top-bar "Model mode" toggle ───
  //  The toggle is a real <button aria-pressed>; before the flip the Model rail slot
  //  is absent (author lens), after it the slot appears (role-as-lens projection).
  await expect(page.getByRole('button', { name: 'Model', exact: true })).toHaveCount(0)
  const modelToggle = page.getByRole('button', { name: 'Model mode' })
  await expect(modelToggle).toHaveAttribute('aria-pressed', 'false')
  await modelToggle.click()
  await expect(modelToggle).toHaveAttribute('aria-pressed', 'true')

  // ── 3. MODEL — open the Model surface (now a rail entry) → catalog manager ────
  await page.getByRole('button', { name: 'Model', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Governed metric catalog' })).toBeVisible()

  // ── 4. AUTHOR — open the editor and author against the LIVE cube profile ──────
  await page.getByRole('button', { name: 'New metric' }).click()
  const editor = page.getByRole('form', { name: 'Metric editor' })
  await expect(editor).toBeVisible()

  // id — slug-legal, immutable-on-create.
  await page.getByLabel('Metric id (immutable)').fill(AUTHORED_METRIC.id)

  // dataset PICK (MUI Select → open + choose the real option; never hand-typed).
  await page.getByRole('combobox', { name: /Dataset \(cube\)/ }).click()
  await page.getByRole('option', { name: new RegExp(STEWARD_DATASET.label) }).click()

  // measure PICK — derives code + PRE-FILLS the unit from the measure's resolved unit.
  const measure = STEWARD_PROFILE.measures[0]
  await page.getByRole('combobox', { name: /Measure/ }).click()
  await page.getByRole('option', { name: new RegExp(measure.code) }).click()

  //  ASSERT the unit pre-fill (the "pick, never type" governance win): the en unit
  //  field now carries the measure's resolved bilingual unit label, and NO
  //  "supply a unit" warning shows (the resolved unit had source:'measure').
  await expect(page.locator('#me-unit-en')).toHaveValue(measure.unit.label!.en)
  await expect(editor.getByText('This measure has no resolved unit')).toHaveCount(0)

  //  Overwrite the seeded label with a DISTINCT governed label (bilingual) — this is
  //  the steward's governance authorship, the text the author will later see.
  await page.locator('#me-label-en').fill(AUTHORED_METRIC.label.en)
  await page.locator('#me-label-ka').fill(AUTHORED_METRIC.label.ka)

  //  Display format — pick a real formatter (registry-driven options; nth(0) is None).
  await page.getByRole('combobox', { name: /Display format/ }).click()
  await page.getByRole('option').nth(1).click()

  // ── 5. SAVE — the metric is valid → Create enabled → commit → PUT + live apply ─
  const create = editor.getByRole('button', { name: 'Create metric' })
  await expect(create).toBeEnabled()
  await create.click()

  //  Save success — the manager returns to the list and announces the metric is now
  //  in the palette (PUT /api/config/site succeeded, catalog re-registered live).
  await expect(page.getByText(`Saved "${AUTHORED_METRIC.id}"`)).toBeVisible()

  // ── 6. AUTHOR-SEES — flip back to the author lens, open Data, find the metric ──
  await modelToggle.click()
  await expect(modelToggle).toHaveAttribute('aria-pressed', 'false')
  // Model is gone from the rail again (author lens); the Data surface reveals the palette.
  await expect(page.getByRole('button', { name: 'Model', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Data' }).click()

  const palette = page.getByTestId('metric-palette')
  await expect(palette).toBeVisible()

  //  THE HEADLINE ASSERTION: the steward-authored metric is a first-class governed
  //  noun in the author's palette — keyed by its stable id, rendered by its GOVERNED
  //  label (not the cube measure label). This is the define → see loop, in Chromium.
  const authoredTile = page.getByTestId(`metric-tile-${AUTHORED_METRIC.id}`)
  await expect(authoredTile).toBeVisible()
  await expect(authoredTile).toContainText(AUTHORED_METRIC.label.en)

  //  And the catalog GREW by exactly one — the four provisioned governed metrics plus
  //  the one the steward just authored (no clobber of the provisioned set).
  await expect(page.locator('[data-testid^="metric-tile-"]'))
    .toHaveCount(GOVERNED_CATALOG.metrics.length + 1)
})
