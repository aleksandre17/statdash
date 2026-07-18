// ── probe-wp5c-journey — the browse lowering closes the W-P5b crack, on :3013 (W-P5c) ─
//
//  ADR-046 Addendum 2 · SPEC §9 E1 · FF-JOURNEY-PIPE. Proves on the REAL stack that a
//  governed grain-∅ source head now BROWSES (a source IS the table — Power Query), the
//  crack W-P5b diagnosed (grain-∅ → a 1-row scalar `0`) now closed:
//    • open the workbench on element A → Get `accounts.compensation` (base) → the browse
//      grid renders REAL OBSERVATION ROWS (many, not a 1-row scalar);
//    • open the workbench on element B → Get `gdp.growthYoy` (calc) → a REAL growth VALUE
//      column renders YEAR-BY-YEAR (captured), honest no-data at the first period;
//    • add Filter + Aggregate via the 7-verb palette → each step's grid reflects it;
//    • the generated-query pane mirrors the pipeline (governed nouns only), zero raw leaks.
//  Shots → work/authoring-truth/wp5c/. Zero console errors is a pass condition.
//
//  RUN (from platform/):  node e2e/probes/probe-wp5c-journey.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'wp5c')
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

// Read the workbench view-model. `rowCells` = each tbody row as its ordered cell array
// (so a year↔value pair is visible — the growth VALUE capture the 0081 closure needs).
async function readWorkbench() {
  const present = await page.locator('[data-testid="data-workbench"]').count()
  if (!present) return { state: 'absent' }
  const gridCaption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '')
  const gridRows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gridHeaders = await page.locator('[data-testid="pipeline-grid"] thead th').allTextContents().catch(() => [])
  const gqSteps = await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => [])
  const rowLocs = await page.locator('[data-testid="pipeline-grid"] tbody tr').all().catch(() => [])
  const rowCells = []
  for (const r of rowLocs.slice(0, 14)) {
    const tds = await r.locator('td').allTextContents().catch(() => [])
    rowCells.push(tds.map((c) => c.replace(/\s+/g, ' ').trim().slice(0, 28)))
  }
  const flat = rowCells.flat()
  const leaks = [...new Set(flat.filter((c) => RAW_LEAKS.includes(c)))]
  return {
    state: 'workbench', gridCaption: (gridCaption || '').trim(), gridRows,
    gridHeaders: gridHeaders.map((h) => h.trim()),
    gqStepCount: gqSteps.length,
    gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 50)),
    rowCells,
    rawLeaks: leaks,
  }
}

async function pickGetMetric(prefer) {
  const get = page.locator('[data-testid="workbench-get"]')
  let tile = prefer ? get.locator(`[data-metric-id*="${prefer}"]`).first() : get.locator('[data-testid^="metric-tile-"]').first()
  if (!(await tile.count())) tile = get.locator('[data-testid^="metric-tile-"]').first()
  const id = await tile.getAttribute('data-metric-id').catch(() => null)
  await tile.click().catch(() => {})
  await page.waitForTimeout(3000)
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

// Open the workbench on the `skip`-th eligible (chart/table) element — a fresh element per
// pass so the base browse and the calc browse are INDEPENDENT binds (no append-mixing).
async function openWorkbench(skip) {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  let seen = -1
  for (let i = 0; i < Math.min(n, 8); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    seen += 1
    if (seen < skip) continue
    await door.click().catch(() => {})
    await page.waitForTimeout(4500)
    if (await page.locator('[data-testid="data-workbench"]').count()) { log('opened', { element: i, skip }); return true }
  }
  return false
}

// Extract the plausible growth VALUE cells from a calc-browse grid: numeric cells that are
// NOT a bare year (4-digit) — the YoY percentages, plus the honest no-data marker.
function growthValues(rowCells) {
  const out = []
  for (const cells of rowCells) {
    const year = cells.find((c) => /^\d{4}$/.test(c))
    const val = cells.find((c) => c !== year && (/^-?\d+([.,]\d+)?%?$/.test(c) || c === '—' || c === '–'))
    out.push({ year: year ?? null, value: val ?? null, row: cells })
  }
  return out
}

async function run() {
  // ── Pass A — the BASE browse (accounts.compensation) → real observation rows ─────────
  const openedA = await openWorkbench(0)
  await page.waitForTimeout(1000)
  const baseId = await pickGetMetric('compensation')
  const baseBrowse = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '01-base-browse-compensation.png'), fullPage: true })
  log('base-browse', { boundId: baseId, gridRows: baseBrowse.gridRows, gridCaption: baseBrowse.gridCaption,
    headers: baseBrowse.gridHeaders, sample: baseBrowse.rowCells.slice(0, 4), rawLeaks: baseBrowse.rawLeaks })

  // ── Pass B — the CALC browse (gdp.growthYoy) → a REAL growth VALUE, year-by-year ─────
  const openedB = await openWorkbench(1)
  await page.waitForTimeout(1000)
  const growthId = await pickGetMetric('growth')
  const growthBrowse = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '02-calc-browse-growthYoY.png'), fullPage: true })
  const gvals = growthValues(growthBrowse.rowCells)
  log('calc-browse', { boundId: growthId, gridRows: growthBrowse.gridRows, gridCaption: growthBrowse.gridCaption,
    headers: growthBrowse.gridHeaders, growthValues: gvals, rawLeaks: growthBrowse.rawLeaks })

  // ── Filter + Aggregate still flow over the browse ────────────────────────────────────
  await insertVerb('filter')
  const afterFilter = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '03-after-filter.png'), fullPage: true })
  log('after-filter', { gridRows: afterFilter.gridRows, gqStepCount: afterFilter.gqStepCount,
    gqSteps: afterFilter.gqSteps, rawLeaks: afterFilter.rawLeaks })

  await insertVerb('aggregate')
  const afterAggregate = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '04-after-aggregate.png'), fullPage: true })
  log('after-aggregate', { gridRows: afterAggregate.gridRows, gqStepCount: afterAggregate.gqStepCount,
    gqSteps: afterAggregate.gqSteps, rawLeaks: afterAggregate.rawLeaks })

  const capturedGrowth = gvals.filter((g) => g.value && g.value !== '—' && g.value !== '–').map((g) => `${g.year}:${g.value}`)
  log('summary', {
    openedA, openedB,
    baseBrowseRows: baseBrowse.gridRows,
    baseBrowseIsRichGrid: baseBrowse.gridRows > 1,
    growthBound: growthId,
    growthRows: growthBrowse.gridRows,
    capturedGrowthValues: capturedGrowth,
    firstPeriodHonest: gvals.length ? (gvals[0].value === '—' || gvals[0].value === '–' || gvals[0].value === null) : null,
    stepsFlow: afterAggregate.gqStepCount,
    rawLeaks: [...new Set([...baseBrowse.rawLeaks, ...growthBrowse.rawLeaks, ...afterFilter.rawLeaks, ...afterAggregate.rawLeaks])],
    consoleErrors: errors,
  })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
