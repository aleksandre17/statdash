// ── probe-0087b-filter-parity — FILTER FULL-POWER PARITY, live on :3013 ─────────────
//
//  Card 0087 remainder DoD. Opens the data workbench, inserts a FILTER step, and walks
//  the three OFFERED MemberPicker modes: specific (checkbox narrows the grid) · follow
//  «მიჰყევი გვერდის არჩევანს» ($ctx) · except «ყველა, გარდა…» ($ne). Then authors a Get
//  read-area grain PIN «წაკითხვის არე» (browse narrows). Screenshots + zero console errors.
//
//  RUN (from platform/):  node e2e/probes/probe-0087b-filter-parity.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0087b')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

const shot = (name) => page.screenshot({ path: resolve(OUT, name), fullPage: true })

async function login() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const pass = page.locator('input[type="password"]').first()
  if (await pass.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await pass.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await page.locator('button[type="submit"]').first().click().catch(() => {})
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

const gridRows = () => page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)

// Pick the first offered non-value column in the filter form's FieldPicker (a MUI Select).
async function pickFirstColumn() {
  const combo = page.locator('[data-testid="data-workbench"] [role="combobox"]').first()
  await combo.click().catch(() => {})
  await page.waitForTimeout(500)
  // choose the second option (skip the empty placeholder + prefer a dimension over value)
  const opts = page.locator('[role="option"]')
  const c = await opts.count()
  await opts.nth(Math.min(1, c - 1)).click().catch(() => {})
  await page.waitForTimeout(1000)
}

async function run() {
  const opened = await openWorkbench()
  await shot('00-workbench.png')
  log('opened', { opened })
  if (!opened) return

  // Insert FILTER, select its step.
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.locator('[data-testid="verb-insert-filter"]').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1200)
  // Add a condition, pick a column.
  await page.locator('button:has-text("პირობის დამატება"), button:has-text("Add condition")').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await pickFirstColumn()
  const before = await gridRows()

  // ── SPECIFIC — check a member; the grid narrows ───────────────────────────────────
  const firstBox = page.locator('[data-testid="data-workbench"] input[type="checkbox"]').first()
  await firstBox.click().catch(() => {})
  await page.waitForTimeout(1500)
  const afterSpecific = await gridRows()
  await shot('01-specific.png')
  log('specific', { before, afterSpecific, narrowed: afterSpecific !== before, errs: errors.length })

  // ── FOLLOW «მიჰყევი გვერდის არჩევანს» ($ctx) ──────────────────────────────────────
  await page.locator('[data-testid="filter-mode-follow"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  const followNote = await page.locator('[data-testid="filter-follow-note"]').count().catch(() => 0)
  await shot('02-follow.png')
  log('follow', { followNote, gridRows: await gridRows(), errs: errors.length })

  // ── EXCEPT «ყველა, გარდა…» ($ne) — exclude a member ───────────────────────────────
  await page.locator('[data-testid="filter-mode-except"]').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const exBox = page.locator('[data-testid="data-workbench"] input[type="checkbox"]').first()
  await exBox.click().catch(() => {})
  await page.waitForTimeout(1500)
  await shot('03-except.png')
  log('except', { gridRows: await gridRows(), errs: errors.length })

  // ── GET GRAIN «წაკითხვის არე» — pin a coordinate; the browse narrows ──────────────
  // Select the Get source chip first so the grid shows the browse.
  await page.locator('[data-testid="pipe-source-chip"]').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const browseBefore = await gridRows()
  await page.locator('[data-testid="get-grain-toggle"]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('button:has-text("პინის დამატება"), button:has-text("Add pin")').first().click().catch(() => {})
  await page.waitForTimeout(500)
  // pick a dimension in the grain FieldPicker (the last combobox in the get card)
  const grainCombo = page.locator('[data-testid="get-grain"] [role="combobox"]').first()
  await grainCombo.click().catch(() => {})
  await page.waitForTimeout(500)
  const gopts = page.locator('[role="option"]')
  await gopts.nth(Math.min(1, (await gopts.count()) - 1)).click().catch(() => {})
  await page.waitForTimeout(800)
  // pin the first member
  const pinBox = page.locator('[data-testid="get-grain"] input[type="checkbox"]').first()
  await pinBox.click().catch(() => {})
  await page.waitForTimeout(1800)
  const browseAfter = await gridRows()
  await shot('04-grain-pin.png')
  log('grain', { browseBefore, browseAfter, narrowed: browseAfter !== browseBefore, errs: errors.length })

  log('honesty', { consoleErrors: errors.slice(0, 10) })
  log('done', {})
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
