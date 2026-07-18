// ── probe-0085-realread — the steward ObsQuery shows a REAL governed read + a live
//  filter that ACTUALLY reduces the grid (N<200). Complements probe-0086-0085-wave.
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0086')
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
  await page.waitForTimeout(1200)
  const passField = page.locator('input[type="password"]').first()
  if (await passField.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await passField.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await page.locator('button[type="submit"]').first().click().catch(() => {})
    await page.waitForTimeout(4000)
  }
}

async function run() {
  await page.evaluate(() => localStorage.setItem('statdash.role', JSON.stringify({ state: { role: 'steward' }, version: 0 }))).catch(() => {})
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  for (let i = 0; i < Math.min(await els.count(), 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(900)
    if (await page.locator('[data-testid="open-data-workbench"]').count()) break
  }
  await page.locator('[data-testid="open-data-workbench"]').first().click().catch(() => {})
  await page.waitForTimeout(4500)

  // Bind a governed metric IN the workbench rail (grain-∅ Get) → sourceHeadObs = { measure }.
  const tile = page.locator('[data-testid="workbench-rail"] [data-testid^="metric-tile-"]').first()
  if (await tile.count()) { await tile.click().catch(() => {}); await page.waitForTimeout(3000) }

  // Expand the lowered-ObsQuery accordion and read the REAL resolved read.
  const obsAccordion = page.locator('[data-testid="gq-steward"] .MuiAccordionSummary-root').last()
  if (await obsAccordion.count()) { await obsAccordion.click().catch(() => {}); await page.waitForTimeout(700) }
  const obsBox = page.locator('[data-testid="gq-obsquery"]')
  const obsText = await obsBox.innerText().catch(() => '')
  const obsH = await obsBox.evaluate((el) => el.getBoundingClientRect().height).catch(() => 0)
  await page.screenshot({ path: resolve(OUT, '09-steward-real-read.png'), fullPage: true })
  log('0085-real-read', { obsHeight: Math.round(obsH), hasMeasure: /measure/.test(obsText), obsText: obsText.replace(/\s+/g, ' ').trim().slice(0, 140) })

  // ── A filter that ACTUALLY reduces the grid: pick the period column, check ONE year ──
  const before = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('[data-testid="verb-insert-filter"]').first().click().catch(() => {})
  await page.waitForTimeout(1000)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: /Add condition|პირობის დამატება/ }).first().click().catch(() => {})
  await page.waitForTimeout(800)
  const select = page.getByLabel(/^სვეტი$|^Column$/).first()
  if (await select.count()) { await select.click().catch(() => {}); await page.waitForTimeout(500) }
  // Pick the period column (year) — a selective column for a clean reduction.
  const period = page.getByRole('option', { name: /პერიოდი|Period|წელი|Year/ }).first()
  if (await period.count()) await period.click().catch(() => {})
  else await page.locator('[role="option"]').last().click().catch(() => {})
  await page.waitForTimeout(1200)
  // Check exactly ONE member (one year).
  const boxes = page.locator('[aria-label="ფილტრის მნიშვნელობები"] input[type="checkbox"], [aria-label="Filter values"] input[type="checkbox"]')
  const memberCount = await boxes.count().catch(() => 0)
  await boxes.nth(0).click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const after = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gqSteps = await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => [])
  await page.screenshot({ path: resolve(OUT, '10-filter-reduces.png'), fullPage: true })
  log('filter-reduces', { memberCount, gridBefore: before, gridAfter: after, reduced: after < before, gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 40)) })
  log('done', { consoleErrors: errors })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
