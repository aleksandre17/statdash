// ── probe-wp3-palette — the 7-verb palette + governed grid, walked on :3013 (W-P3) ─
//
//  ADR-046 · SPEC §1.2/§3. Proves on the REAL stack: open the workbench → "+add step"
//  opens the 7-verb palette → insert Filter and Derive VIA the palette → both valid
//  immediately (grid stays green, updates; query pane updates) → the grid CELLS speak
//  GOVERNED labels (no adjara/AGRI/GVA/_T raw leak in the author plane). Shots →
//  work/authoring-truth/wp3/.
//
//  RUN (from platform/):  node e2e/probes/probe-wp3-palette.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'wp3')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

// Raw SDMX codes that must NEVER appear as a CELL value in the author plane.
const RAW_LEAKS = ['adjara', 'AGRI', 'GVA', '_T', 'GVA_B1G']

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
    state: 'workbench', gridCaption, gridRows,
    gridHeaders: gridHeaders.map((h) => h.trim()),
    gqStepCount: gqSteps.length,
    gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 50)),
    sampleCells: cells.slice(0, 12).map((c) => c.trim().slice(0, 24)),
    rawLeaks: leaks,
  }
}

// Open the palette and insert a verb's default op.
async function insertVerb(verb) {
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const cards = await page.locator('[data-testid="verb-palette"] [data-testid^="verb-card-"]').count()
  await page.locator(`[data-testid="verb-insert-${verb}"]`).click().catch(() => {})
  await page.waitForTimeout(1800)
  return cards
}

async function run() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  log('elements', { chartsOrTables: n, url: page.url() })

  let opened = false
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue
    const tile = page.locator('[data-testid^="metric-tile-"]').first()
    if (!(await tile.count())) continue
    const boundId = await tile.getAttribute('data-metric-id')
    await tile.click().catch(() => {})
    await page.waitForTimeout(2000)
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) { log('no-door', { element: i, boundId }); continue }
    await door.click().catch(() => {})
    await page.waitForTimeout(4500)
    if (await page.locator('[data-testid="data-workbench"]').count()) {
      opened = true
      log('opened', { element: i, boundId })
      break
    }
  }

  await page.waitForTimeout(2500)
  const atOpen = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '01-workbench-open.png'), fullPage: true })
  log('workbench-open', atOpen)

  // ── "+add step" → the 7-verb palette ─────────────────────────────────────────
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(700)
  const verbCards = await page.locator('[data-testid="verb-palette"] [data-testid^="verb-card-"]').count()
  const verbLabels = await page.locator('[data-testid="verb-palette"] [data-testid^="verb-insert-"]').allTextContents().catch(() => [])
  await page.screenshot({ path: resolve(OUT, '02-verb-palette.png') })
  log('palette', { verbCards, verbLabels: verbLabels.map((v) => v.replace(/\s+/g, ' ').trim().slice(0, 40)) })
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // ── Insert Filter + Derive VIA the palette ───────────────────────────────────
  const filterCards = await insertVerb('filter')
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const afterFilter = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '03-after-filter.png'), fullPage: true })
  log('after-filter', { paletteCards: filterCards, ...afterFilter })

  const deriveCards = await insertVerb('derive')
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const afterDerive = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '04-after-derive.png'), fullPage: true })
  log('after-derive', { paletteCards: deriveCards, ...afterDerive })

  log('summary', {
    opened,
    palette7: verbCards === 7,
    gridStayedGreen: afterFilter.gridRows > 0 && afterDerive.gridRows > 0,
    queryGrew: afterDerive.gqStepCount > atOpen.gqStepCount,
    fromSteps: atOpen.gqStepCount, toSteps: afterDerive.gqStepCount,
    rawLeaksAtOpen: atOpen.rawLeaks, rawLeaksAfterDerive: afterDerive.rawLeaks,
    consoleErrors: errors,
  })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
