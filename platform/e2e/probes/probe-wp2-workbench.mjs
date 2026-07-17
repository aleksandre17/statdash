// ── probe-wp2-workbench — the three-pane authoring shell walked on :3013 (W-P2) ───
//
//  ADR-046 · SPEC §3 (the surface). Proves on the REAL stack: an author selects a
//  bound element → the DATA facet → binds a governed metric → OPENS the data workbench
//  → ALL THREE PANES appear in one screen with REAL data (wide grid · step rail ·
//  generated query) → adds a Filter step → the grid AND the generated-query pane both
//  update. Shots → work/authoring-truth/wp2/.
//
//  RUN (from platform/):  node e2e/probes/probe-wp2-workbench.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'wp2')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

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

// Read the three panes' observable truth for the log.
async function readWorkbench() {
  const present = await page.locator('[data-testid="data-workbench"]').count()
  if (!present) return { state: 'absent' }
  const rail   = await page.locator('[data-testid="workbench-rail"]').count()
  const gridWrap = await page.locator('[data-testid="workbench-grid"]').count()
  const gridCaption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '')
  const gridRows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gridHeaders = await page.locator('[data-testid="pipeline-grid"] thead th').allTextContents().catch(() => [])
  const gridCount = await page.locator('[data-testid="pipeline-grid-count"]').textContent().catch(() => '')
  const gqSteps = await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => [])
  return {
    state: 'workbench', rail, gridWrap,
    gridCaption, gridRows, gridHeaders, gridCount,
    gqStepCount: gqSteps.length, gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60)),
  }
}

async function run() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '01-insert-regional.png') })

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  log('elements', { chartsOrTables: n, url: page.url() })

  // Select a bindable element → DATA facet → bind a governed metric (→ query spec).
  let opened = false
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue

    const tile = page.locator('[data-testid^="metric-tile-"]').first()
    if (!(await tile.count())) continue
    const boundId = await tile.getAttribute('data-metric-id')
    await tile.click().catch(() => {})          // → query spec with query.measure
    await page.waitForTimeout(2000)

    // The workbench door — appears once the spec is a query spec.
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) { log('no-door', { element: i, boundId }); continue }
    await door.click().catch(() => {})
    await page.waitForTimeout(4500) // focus-view + lazy DataWorkbench + async live source read
    log('opened', { element: i, boundId, workbench: await page.locator('[data-testid="data-workbench"]').count() })
    if (await page.locator('[data-testid="data-workbench"]').count()) { opened = true; break }
  }

  // ── ALL THREE PANES in one screen with real data ─────────────────────────────
  await page.waitForTimeout(2500)
  const atOpen = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '02-workbench-three-panes.png'), fullPage: true })
  log('three-panes', atOpen)

  // ── Add a Filter step → grid AND generated-query pane both update ─────────────
  const opSelect = page.locator('.MuiSelect-select', { hasText: 'ოპერაცია' }).first()
  if (await opSelect.count()) {
    await opSelect.click().catch(() => {})
    await page.waitForTimeout(600)
    await page.getByRole('option', { name: 'filter' }).first().click().catch(() => {})
    await page.waitForTimeout(1500)
    // Select the new step so the grid shows its as-of output.
    await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
    await page.waitForTimeout(2000)
    const afterStep = await readWorkbench()
    await page.screenshot({ path: resolve(OUT, '03-workbench-after-filter.png'), fullPage: true })
    log('after-filter', afterStep)
    log('both-updated', {
      gridCaptionChanged: atOpen.gridCaption !== afterStep.gridCaption,
      queryGainedStep:    afterStep.gqStepCount > atOpen.gqStepCount,
      fromSteps: atOpen.gqStepCount, toSteps: afterStep.gqStepCount,
      fromCaption: atOpen.gridCaption, toCaption: afterStep.gridCaption,
    })
  } else {
    log('after-filter', { note: 'add-step control not reached' })
  }

  log('done', { opened, consoleErrors: errors })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
