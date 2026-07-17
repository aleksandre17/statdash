// ── probe-wp1-pipeline-grid — the live per-step data grid walked on :3013 (W-P1) ─
//
//  ADR-046 · SPEC §3.2 / §9 (E1 browse-first · E3 capped honest · E5 prefix-run).
//  Proves on the REAL stack: an author selects a data element → opens the DATA facet's
//  pipeline editor → SEES the live per-step grid with REAL rows + GOVERNED headers +
//  the honest count note → selecting a different step CHANGES the grid (as-of step).
//  Shots → work/authoring-truth/wp1/.
//
//  RUN (from platform/):  node e2e/probes/probe-wp1-pipeline-grid.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'wp1')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
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

// Read the grid's observable truth for the log.
async function readGrid() {
  const has = await page.locator('[data-testid="pipeline-grid"]').count()
  if (!has) {
    const states = ['loading', 'empty', 'unbound', 'unavailable', 'error']
    for (const s of states) {
      if (await page.locator(`[data-testid="pipeline-grid-${s}"]`).count()) return { state: s }
    }
    return { state: 'absent' }
  }
  const caption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '')
  const headers = await page.locator('[data-testid="pipeline-grid"] thead th').allTextContents().catch(() => [])
  const rows    = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const count   = await page.locator('[data-testid="pipeline-grid-count"]').textContent().catch(() => '')
  return { state: 'grid', caption, headers, rows, count }
}

async function expandPipe() {
  const pipe = page.locator('[data-testid="data-facet-pipe"]')
  if (await pipe.count()) {
    const expanded = await pipe.locator('.MuiAccordionSummary-root').first().getAttribute('aria-expanded').catch(() => 'false')
    if (expanded !== 'true') {
      await pipe.locator('.MuiAccordionSummary-root').first().click().catch(() => {})
    }
    await page.waitForTimeout(4000) // lazy DataSpecEditor + async live source read
  }
}

async function run() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '01-insert-regional.png') })

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  log('elements', { chartsOrTables: n, url: page.url() })

  // Select the first bindable element with a DATA facet (E1: pick a metric → data
  // appears). bindMeasureToSpec makes its `data` a `query` spec, so the pipe editor's
  // live grid resolves real rows off the cube.
  let landed = null
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1200)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue

    const tile = page.locator('[data-testid^="metric-tile-"]').first()
    if (!(await tile.count())) continue
    const boundId = await tile.getAttribute('data-metric-id')
    await tile.click().catch(() => {})          // → query spec with query.measure
    await page.waitForTimeout(2500)

    await expandPipe()
    const grid = await readGrid()
    log('probe', { element: i, boundId, ...grid })
    if (grid.state === 'grid' || grid.state === 'loading' || grid.state === 'unavailable') {
      landed = { i, boundId, grid }; break
    }
  }

  await page.waitForTimeout(2500)
  const atSource = await readGrid()
  await page.screenshot({ path: resolve(OUT, '02-grid-source.png'), fullPage: true })
  log('source-grid', atSource)

  // ── Select a DIFFERENT step: add a VALID step (filter), then select it → the grid
  //    changes (as-of step). The op picker is the AddStepControl Select. ───────────
  const opSelect = page.locator('.MuiSelect-select', { hasText: 'ოპერაცია' }).first()
  if (await opSelect.count()) {
    await opSelect.click().catch(() => {})
    await page.waitForTimeout(600)
    await page.getByRole('option', { name: 'filter' }).first().click().catch(() => {})
    await page.waitForTimeout(1200)
    await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
    await page.waitForTimeout(2000)
    const atStep = await readGrid()
    await page.screenshot({ path: resolve(OUT, '03-grid-after-step.png'), fullPage: true })
    log('step-grid', atStep)
    log('as-of-changed', {
      fromCaption: atSource.caption, toCaption: atStep.caption,
      changed: atSource.caption !== atStep.caption,
    })
    // Back to Get (source) — the as-of selection is reversible, pure re-slice.
    await page.locator('[data-testid="pipe-source-chip"]').first().click().catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(OUT, '04-grid-back-to-source.png'), fullPage: true })
    log('back-to-source', await readGrid())
  } else {
    log('step-grid', { note: 'add-step control not reached' })
  }

  log('done', { landed: Boolean(landed), consoleErrors: errors })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
