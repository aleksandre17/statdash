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
//  The loop, end to end (AR-50 M5b: navigation decoupled from identity):
//    1. BOOT      — author lens, the Studio mounts (no white-screen / boot-order crash).
//    2. OPEN      — ONE click on the top-bar "Data model" destination switch → NAVIGATES
//                   to the always-reachable data-model screen WITHOUT escalating the
//                   lens: the author lands on the READ-ONLY Data Dictionary.
//    3. EDIT      — flip the in-place lens toggle to "Edit (Steward)" → the modeler's
//                   MetricCatalogManager (headline region) renders.
//    4. AUTHOR    — New metric → PICK dataset + measure (assert the unit PRE-FILLS from
//                   the cube's resolved unit) → set a slug-legal id + a bilingual
//                   GOVERNED label + a display format → Create.
//    5. SAVE      — assert the save-success feedback ("…now in the palette").
//    6. AUTHOR-SEES — breadcrumb-back to the compose shell → open Data → assert the
//                   newly authored metric is in the MetricPalette by its GOVERNED label
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

  // ── 2. OPEN — ONE click on the "Data model" destination switch ───────────────
  //  The segmented switch NAMES the destination and reflects which SCREEN is active.
  //  Before the jump Compose is the active screen. A single click on "Data model"
  //  NAVIGATES to the always-reachable data-model destination WITHOUT escalating the
  //  lens — the author lands on the READ-ONLY Data Dictionary (the built ≠ buried fix;
  //  the raw query cliff stays off the author path).
  const banner    = page.getByRole('banner')
  const composeSeg = banner.getByRole('button', { name: 'Compose' })
  const modelSeg   = banner.getByRole('button', { name: 'Data model' })
  await expect(composeSeg).toHaveAttribute('aria-pressed', 'true')
  await expect(modelSeg).toHaveAttribute('aria-pressed', 'false')
  await modelSeg.click()
  // The destination opened as the READ-ONLY Dictionary (author lens, not the modeler).
  await expect(page.getByTestId('data-dictionary')).toBeVisible()
  await expect(page.getByTestId('dict-metric-gdp.current')).toBeVisible()

  // ── 3. EDIT — flip the in-place lens toggle to Steward → the modeler renders ─
  //  The Dictionary is read-only; opting into editing is an explicit, in-place action
  //  (the lens toggle), never an auto-escalation. This lands the MetricCatalogManager.
  await page.getByRole('button', { name: 'Edit (Steward)' }).click()
  await expect(page.getByRole('region', { name: 'Governed metric catalog' })).toBeVisible()

  // ── 4. AUTHOR — open the editor and author against the LIVE cube profile ──────
  await page.getByRole('button', { name: 'New metric' }).click()
  const editor = page.getByRole('form', { name: 'Metric editor' })
  await expect(editor).toBeVisible()

  // id — slug-legal, immutable-on-create.
  await page.getByLabel('Metric id (immutable)').fill(AUTHORED_METRIC.id)

  // dataset PICK (MUI Select → open + choose the real option; never hand-typed).
  await page.getByRole('combobox', { name: /Dataset \(cube\)/ }).click()
  // The option paints the LOCALIZED label (site is English-first) — readLocale over
  // the {en,ka} LocaleString, never the raw object (React #31).
  await page.getByRole('option', { name: new RegExp(STEWARD_DATASET.label.en) }).click()

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

  // ── 6. AUTHOR-SEES — breadcrumb-back to the compose shell, open Data, find it ─
  //  The data-model screen is a separate focus-view; a breadcrumb-back returns to the
  //  editing shell (loss-free). The Data surface then reveals the palette — the
  //  authored metric is a first-class governed noun there regardless of lens.
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('.studio-shell')).toBeVisible()
  const rail = page.getByRole('navigation', { name: 'Studio surfaces' })
  await rail.getByRole('button', { name: 'Data', exact: true }).click()

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
