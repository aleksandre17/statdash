// ── boot.e2e — the keystone real-browser boot + metric-bind proof (M0 + M1) ────
//
//  The proof we never had. The M0 defects shipped GREEN: unit/jsdom suites passed
//  while the running app white-screened (no MetricPalette path + main.tsx missed
//  i18next.init → "addResources is not a function" at first canvas mount). Those are
//  precisely the failures a REAL browser driving the REAL Vite bundle catches and
//  jsdom does not. This spec is the automated form of the "REAL-BROWSER verify
//  pending" TODO the registry keeps deferring.
//
//  It drives the panel end to end against a mocked-but-faithful governed API
//  (e2e/support/mockApi.ts) and asserts, in one flow:
//    1. BOOT    — the app reaches the Studio (no white-screen, no addResources throw).
//    2. PALETTE — the MetricPalette is populated with REAL governed nouns.
//    3. BIND    — selecting a chart block flips the palette to bindable and a click
//                 binds the metric → the chart's `data.query.measure` config write,
//                 reflected in the Inspector and announced live.
//
//  Selection path note: the chart is selected via the Layers OUTLINE (a first-class
//  selection surface that projects the store, role=tree), NOT the live canvas frame.
//  The live canvas currently cannot render page nodes in a real browser — see the
//  documented `test.fixme` at the bottom (CanvasView omits `chromeConfig`, so the
//  inner-page's InnerSidebar chrome slot throws and the whole page render is swallowed
//  by NodeErrorBoundary). That is itself a real "green ≠ works" defect this harness
//  surfaced on its first run; the keystone bind proof routes around it through the
//  store-backed outline so the M0+M1 win stands independently of that fix.
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, GOVERNED_CATALOG, CHART_NODE_ID } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  // Fail LOUD on the exact M0 boot defect: an uncaught page error (e.g.
  // "addResources is not a function") fails the test instead of silently
  // white-screening. This is the assertion jsdom structurally cannot make.
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('boots to the Studio with a populated governed MetricPalette, and binds a metric to a chart block', async ({ page }) => {
  await page.goto('/')

  // ── 1. BOOT ────────────────────────────────────────────────────────────────
  //  The Studio shell mounts its banner landmark — proof the async boot reached
  //  'ready' (initFromApi + bootstrapCatalog resolved) and the lazy StudioShell +
  //  live canvas graph loaded without a boot-order / i18next-init crash.
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  // The app actually painted content (not a white screen / bare #root).
  await expect(page.locator('.studio-shell')).toBeVisible()

  // ── 2. PALETTE (populated with REAL governed nouns) ──────────────────────────
  //  Default surface is Insert; summon the Data surface (English rail — site seeded
  //  en) to reveal the MetricPalette.
  await page.getByRole('button', { name: 'Data' }).click()

  const palette = page.getByTestId('metric-palette')
  await expect(palette).toBeVisible()

  // The governed tile is present with its REAL en label — proof the catalog boot
  // (bootstrapCatalog → describeApp) populated the registry the palette reads.
  const gdpTile = page.getByTestId('metric-tile-gdp.current')
  await expect(gdpTile).toBeVisible()
  await expect(gdpTile).toContainText('GDP at current prices')
  // A second metric from the OTHER dataSource group — proof it is the governed
  // catalog, not a one-off stub (grouping exercised too).
  await expect(page.getByTestId('metric-tile-accounts.gni')).toBeVisible()
  // The whole governed set is registered.
  await expect(page.locator('[data-testid^="metric-tile-"]')).toHaveCount(GOVERNED_CATALOG.metrics.length)

  // ── 3. BIND (the measure write) ──────────────────────────────────────────────
  //  Before a bindable block is selected, a click cannot bind — the palette
  //  announces the hint (its polite status region), and NO bind occurs.
  await gdpTile.click()
  await expect(page.getByRole('status')).toContainText('აირჩიეთ') // "select a block…"

  //  Select the chart block via the Layers outline (role=tree over the store).
  await page.getByRole('button', { name: 'Layers' }).click()
  await page.locator(`[data-outline-id="${CHART_NODE_ID}"]`).click()

  //  The Inspector materializes for the selected chart — the selection took.
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByText('chart', { exact: true })).toBeVisible()

  //  Back on the Data surface the block is now bindable: the tile advertises the
  //  bind affordance (canBind), and the metric select starts UNbound.
  await page.getByRole('button', { name: 'Data' }).click()
  const boundGdpTile = page.getByTestId('metric-tile-gdp.current')
  await expect(boundGdpTile).toHaveAttribute('aria-label', /GDP at current prices.*(bind|მისაბმელად)/i)
  const metricField = inspector.getByRole('combobox', { name: /Metric|მეტრიკა/ })
  await expect(metricField).toHaveValue('')

  //  Bind: click the governed tile → onBind → bindMetric → the chart's
  //  `data.query.measure` write. Two independent proofs of the write:
  //   (a) the palette announces the successful bind with the metric label, and
  //   (b) the Inspector's Metric select now holds the governed metric-id — the
  //       config actually changed (byte-identical to hand-authoring the metric).
  await boundGdpTile.click()
  await expect(page.getByRole('status')).toContainText('მეტრიკა მიბმულია') // "metric bound:"
  await expect(page.getByRole('status')).toContainText('GDP at current prices')
  await expect(metricField).toHaveValue('gdp.current')
})

// ── FINDING (documented, not swept) — the live canvas cannot render page nodes ──
//
//  This harness's FIRST catch, and a textbook "green ≠ works": jsdom suites are
//  green while the running Constructor canvas shows "Failed to load component" for
//  any real page. Root cause: `apps/panel/src/canvas/CanvasView.tsx` builds its
//  `<SiteProvider>` WITHOUT a `chromeConfig`, but the `inner-page` shell
//  unconditionally mounts `<ChromeSlot slot="InnerSidebar" />`, whose InnerSidebarShell
//  calls `useChromeConfig()` → throws "chromeConfig not provided to <SiteProvider>".
//  `NodeErrorBoundary` swallows it into a fallback card, so children (the chart) never
//  render → no canvas frame to select. The sibling jsdom proof
//  (apps/panel/src/save/authorRender.e2e.test.tsx) hides this by passing `chromeConfig`
//  to its OWN SiteProvider — i.e. the test compensates for what the product omits.
//
//  This is a RUNTIME/product fix (out of this test-infra task's scope — flagged, not
//  patched). The architectural call is between: CanvasView passing a (default)
//  chromeConfig, vs. the chrome shells null-guarding chromeConfig (the "fail-soft
//  chrome" direction). Once fixed, delete `.fixme` and this becomes the direct
//  canvas-frame bind proof.
test.fixme('the live canvas renders the chart node (blocked: CanvasView omits chromeConfig)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  // Currently RED: the inner-page render is caught by NodeErrorBoundary, so no
  // per-node frame is stamped for the chart.
  await expect(page.locator(`.canvas-overlay [data-node-id="${CHART_NODE_ID}"]`)).toBeVisible()
})
