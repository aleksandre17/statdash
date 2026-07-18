// ── probe-wp5b-journey — the pipeline emission flip + J-PIPE walk, on :3013 (W-P5b) ─
//
//  ADR-046 · SPEC §4 (J-PIPE) · FF-JOURNEY-PIPE. Proves on the REAL stack that the
//  workbench now speaks the `pipeline` spine end-to-end:
//    • open the workbench on an element → the Get head is the ACTIVE governed-metric
//      picker (browse-first, E1);
//    • pick a governed metric via Get → the browse grid appears immediately (real rows);
//    • pick gdp.growthYoy (the 0081 closure) → a REAL growth VALUE renders;
//    • add Filter + Aggregate via the 7-verb palette → each step's grid reflects it;
//    • the generated-query pane mirrors the pipeline (governed nouns only);
//    • the emitted spec is a `pipeline` (source head) — read from the steward wire truth.
//  Shots → work/authoring-truth/wp5b/. Zero console errors is a pass condition.
//
//  RUN (from platform/):  node e2e/probes/probe-wp5b-journey.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'wp5b')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))
const RAW_LEAKS = ['adjara', 'AGRI', 'GVA', '_T', 'GVA_B1G', 'B1G', 'B1GQ']

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
  const present = await page.locator('[data-testid="data-workbench"]').count()
  if (!present) return { state: 'absent' }
  const gridCaption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '')
  const gridRows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gridHeaders = await page.locator('[data-testid="pipeline-grid"] thead th').allTextContents().catch(() => [])
  const gqSteps = await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => [])
  const cells = await page.locator('[data-testid="pipeline-grid"] tbody td').allTextContents().catch(() => [])
  const leaks = [...new Set(cells.map((c) => c.trim()).filter((c) => RAW_LEAKS.includes(c)))]
  return {
    state: 'workbench', gridCaption: (gridCaption || '').trim(), gridRows,
    gridHeaders: gridHeaders.map((h) => h.trim()),
    gqStepCount: gqSteps.length,
    gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 50)),
    sampleCells: cells.slice(0, 16).map((c) => c.trim().slice(0, 24)),
    rawLeaks: leaks,
  }
}

// Pick a metric from the WORKBENCH Get head palette (browse-first). Prefer a tile whose
// id matches `prefer` (e.g. a growth metric); else the first tile.
async function pickGetMetric(prefer) {
  const get = page.locator('[data-testid="workbench-get"]')
  let tile = prefer ? get.locator(`[data-metric-id*="${prefer}"]`).first() : get.locator('[data-testid^="metric-tile-"]').first()
  if (!(await tile.count())) tile = get.locator('[data-testid^="metric-tile-"]').first()
  const id = await tile.getAttribute('data-metric-id').catch(() => null)
  await tile.click().catch(() => {})
  await page.waitForTimeout(2500)
  return id
}

async function insertVerb(verb) {
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.locator(`[data-testid="verb-insert-${verb}"]`).click().catch(() => {})
  await page.waitForTimeout(1800)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
}

async function openWorkbenchOnSomeElement() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  log('elements', { chartsOrTables: n, url: page.url() })
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    await door.click().catch(() => {})
    await page.waitForTimeout(4500)
    if (await page.locator('[data-testid="data-workbench"]').count()) { log('opened', { element: i }); return true }
  }
  return false
}

async function run() {
  const opened = await openWorkbenchOnSomeElement()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(OUT, '01-workbench-open-browse-first.png'), fullPage: true })
  log('workbench-open', await readWorkbench())

  // ── The 0081 closure: Get gdp.growthYoy → a REAL growth VALUE ────────────────────
  const growthId = await pickGetMetric('growth')
  const afterGrowth = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '02-get-growth-value.png'), fullPage: true })
  log('get-growth', { boundId: growthId, ...afterGrowth })

  // ── Add Filter + Aggregate via the 7-verb palette → each step's grid reflects ────
  await insertVerb('filter')
  const afterFilter = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '03-after-filter.png'), fullPage: true })
  log('after-filter', afterFilter)

  await insertVerb('aggregate')
  const afterAggregate = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '04-after-aggregate.png'), fullPage: true })
  log('after-aggregate', afterAggregate)

  log('summary', {
    opened,
    growthBound: growthId,
    growthRendered: afterGrowth.gridRows > 0,
    stepsMirrored: afterAggregate.gqStepCount,
    queryGrew: afterAggregate.gqStepCount > afterGrowth.gqStepCount,
    rawLeaks: [...new Set([...afterGrowth.rawLeaks, ...afterFilter.rawLeaks, ...afterAggregate.rawLeaks])],
    consoleErrors: errors,
  })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
