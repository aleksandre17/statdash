// ── probe-0087-role-projection — every verb OFFERED, comprehensible, live on :3013 ──
//
//  Card 0087 DoD (owner: «ნაბიჯის დამატებაში ფილტრაციის გარდა სხვა არაფერი მუშაობს»).
//  Walks the 5 demo verbs through the ONE role-projecting step editor: for each, insert
//  the verb → select its step → the form is OFFERED (no raw-JSON textarea) → screenshot.
//  For DERIVE, type a formula into the expr combobox → the LIVE per-row preview shows the
//  computed value (the Power-Query Custom-Column moment). Zero console errors.
//
//  RUN (from platform/):  node e2e/probes/probe-0087-role-projection.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0087')
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

async function openWorkbench() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
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
    if (await page.locator('[data-testid="data-workbench"]').count()) return true
  }
  return false
}

// Insert a verb (optionally a specific op via the "more" menu), select its step chip.
async function insertVerb(category, opCode) {
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  if (opCode) {
    await page.locator(`[data-testid="verb-more-${category}"]`).first().click().catch(() => {})
    await page.waitForTimeout(400)
    await page.locator(`[data-testid="verb-op-${opCode}"]`).first().click().catch(() => {})
  } else {
    await page.locator(`[data-testid="verb-insert-${category}"]`).first().click().catch(() => {})
  }
  await page.waitForTimeout(1400)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1400)
}

async function readForm() {
  const wb = page.locator('[data-testid="data-workbench"]')
  const text = await wb.innerText().catch(() => '')
  return {
    roleEditor:  await page.locator('[data-testid="transform-step-editor"]').count().catch(() => 0),
    rawJsonFallback: /დაარედაქტირეთ JSON|Edit JSON/.test(text),   // the dreaded raw box (bad)
    gridRows:    await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0),
  }
}

async function walk(shot, category, opCode) {
  await insertVerb(category, opCode)
  const form = await readForm()
  await page.screenshot({ path: resolve(OUT, shot), fullPage: true })
  log('verb', { verb: opCode ?? category, ...form, errs: errors.length })
  return form
}

async function run() {
  const opened = await openWorkbench()
  await page.screenshot({ path: resolve(OUT, '00-workbench.png'), fullPage: true })
  log('opened', { opened })
  if (!opened) return

  // ── DERIVE — the expr editor + LIVE preview (headline) ────────────────────────────
  await walk('01-derive.png', 'derive')
  // Type a real formula into the expr combobox; the preview should compute per row.
  const expr = page.locator('#step-expr').first()
  if (await expr.count()) {
    await expr.click().catch(() => {})
    await expr.fill('value * 2').catch(() => {})
    await page.waitForTimeout(1500)
  }
  const previewVisible = await page.getByText(/Preview \(sample rows\)|გადახედვა/).count().catch(() => 0)
  await page.screenshot({ path: resolve(OUT, '02-derive-preview.png'), fullPage: true })
  log('derive-preview', { previewVisible, errs: errors.length })

  // ── AGGREGATE — groupBy checklist + structured aggregations list ──────────────────
  await walk('03-aggregate.png', 'aggregate', 'aggregate')

  // ── SORT (Reshape family calls it) — bespoke multi-key, offered field ─────────────
  await walk('04-sort.png', 'sort')

  // ── COMBINE → LOOKUP — bespoke, key offered ───────────────────────────────────────
  await walk('05-lookup.png', 'combine', 'lookup')

  // ── FILTER — the owner's baseline (offered column + member checklist) ─────────────
  await walk('06-filter.png', 'filter')

  log('honesty', { consoleErrors: errors.slice(0, 10) })
  log('done', {})
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
