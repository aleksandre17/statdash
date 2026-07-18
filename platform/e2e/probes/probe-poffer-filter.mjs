// ── probe-poffer-filter — the OFFER-driven Filter editor walked on :3013 (P-OFFER) ─
//
//  ADR-046 · SPEC §3 · the Authoring Canon P-OFFER principle (owner 2026-07-18): the
//  author never TYPES an identifier. Proves on the REAL stack:
//    workbench → Get a governed metric → add a Filter step (7-verb palette) →
//    the Filter's COLUMN control OFFERS the governed columns (a Select, not free text) →
//    pick გეოგრაფია → the VALUE control OFFERS the actual regions by GOVERNED name
//    (an Excel AutoFilter checkbox list) → check two → the grid filters live to those
//    regions AND the generated-query pane shows the condition. Zero console errors,
//    zero raw-code leaks. Shots → work/authoring-truth/p-offer/.
//
//  RUN (from platform/):  node e2e/probes/probe-poffer-filter.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'p-offer')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

// A raw-code leak is any SDMX code / member id surfacing where the author reads governed
// nouns (the filter form + the grid, author plane). Bounded, illustrative set.
const RAW_TOKENS = ['adjara', 'AGRI', 'GVA', 'B1G', '_T', 'REGION']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

async function login() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const passField = page.locator('input[type="password"]').first()
  if (await passField.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await passField.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
    await page.waitForTimeout(4000)
  }
}

async function readWorkbench() {
  if (!(await page.locator('[data-testid="data-workbench"]').count())) return { state: 'absent' }
  return {
    state: 'workbench',
    gridCaption: await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => ''),
    gridRows: await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0),
    gqSteps: await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => []),
  }
}

// The OFFER truth: the Filter column control's offered options + the value checkboxes.
async function readFilterOffer() {
  // Open the column Select (the FieldPicker over input columns).
  const colSelect = page.locator('.MuiInputBase-root:has(> [aria-label="სვეტი"]), [role="combobox"][aria-label], label:has-text("სვეტი")')
  // A robust path: click the Select that renders inside the filter step card.
  const select = page.getByLabel('სვეტი').first()
  const columnOptions = []
  if (await select.count()) {
    await select.click().catch(() => {})
    await page.waitForTimeout(500)
    for (const t of await page.locator('[role="option"]').allTextContents()) columnOptions.push(t.trim())
  }
  return { columnOptions: columnOptions.filter(Boolean) }
}

async function run() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '01-insert.png') })

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()

  // Select a bindable element → DATA facet → bind a governed metric → open the workbench.
  let opened = false
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue
    const tile = page.locator('[data-testid^="metric-tile-"]').first()
    if (!(await tile.count())) continue
    await tile.click().catch(() => {})
    await page.waitForTimeout(2000)
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    await door.click().catch(() => {})
    await page.waitForTimeout(4500)
    if (await page.locator('[data-testid="data-workbench"]').count()) { opened = true; break }
  }
  const atOpen = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '02-workbench.png'), fullPage: true })
  log('opened', { opened, ...atOpen })

  // ── Add a Filter step via the 7-verb palette ─────────────────────────────────
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.locator('[data-testid="verb-insert-filter"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(OUT, '03-filter-added.png'), fullPage: true })

  // ── The COLUMN control OFFERS governed columns (not free text) ────────────────
  const offer = await readFilterOffer()
  await page.screenshot({ path: resolve(OUT, '04-column-offered.png'), fullPage: true })
  log('column-offer', offer)

  // Pick გეოგრაფია (the governed geography column).
  await page.getByRole('option', { name: /გეოგრაფია/ }).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(OUT, '05-value-offered.png'), fullPage: true })

  // ── The VALUE control OFFERS the actual members by governed name; check two ────
  const memberBoxes = page.locator('[aria-label="ფილტრის მნიშვნელობები"] input[type="checkbox"], [role="group"][aria-label="ფილტრის მნიშვნელობები"] input[type="checkbox"]')
  const memberLabels = await page.locator('[aria-label="ფილტრის მნიშვნელობები"] .MuiFormControlLabel-label').allTextContents().catch(() => [])
  const memberCount = await memberBoxes.count().catch(() => 0)
  await memberBoxes.nth(0).click().catch(() => {})
  await page.waitForTimeout(400)
  await memberBoxes.nth(1).click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const afterPick = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '06-filtered-live.png'), fullPage: true })

  // Raw-leak scan over the filter form + grid (author plane).
  const formText = await page.locator('[data-testid="data-workbench"]').innerText().catch(() => '')
  const rawLeaks = RAW_TOKENS.filter((t) => formText.includes(t))

  log('member-offer', { memberCount, memberLabels: memberLabels.slice(0, 8) })
  log('filtered', {
    gridRowsBefore: atOpen.gridRows, gridRowsAfter: afterPick.gridRows,
    gqSteps: afterPick.gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60)),
  })
  log('honesty', { rawLeaks, consoleErrors: errors })
  log('done', { opened })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
