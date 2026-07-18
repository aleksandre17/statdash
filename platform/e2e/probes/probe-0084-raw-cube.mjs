// ── probe-0084-raw-cube — the steward raw-cube Get entry + the promotion loop ──
//
//  ADR-046 variant 2 · 0084. Walks the REAL stack (:3013, steward lens):
//    workbench → Get → «ნედლი კუბები» tab → expand REGIONAL_GVA (dim summary + label-debt
//    marks) → browse → the grid shows RAW observations → add a step → «მეტრიკად დაწინაურება»
//    → propose a governed metric → the head becomes governed (the palette offers it).
//  Then the AUTHOR lens: NO raw tab (FF-AUTHOR-NO-QUERY). Zero console errors.
//
//  RUN (from platform/):  node e2e/probes/probe-0084-raw-cube.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0084')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))
const RAW_TOKENS = ['adjara', 'AGRI', 'GVA', 'B1G', '_T', 'REGION']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

// Set the STEWARD lens before any app code runs (zustand-persist localStorage key).
async function setRole(role) {
  await page.addInitScript((r) => {
    localStorage.setItem('statdash.role', JSON.stringify({ state: { role: r }, version: 0 }))
  }, role)
}

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
    if (await tile.count()) { await tile.click().catch(() => {}); await page.waitForTimeout(1500) }
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    await door.click().catch(() => {})
    await page.waitForTimeout(4500)
    if (await page.locator('[data-testid="data-workbench"]').count()) return true
  }
  return false
}

async function run() {
  // ── STEWARD lens ──────────────────────────────────────────────────────────────
  await setRole('steward')
  await login()
  const opened = await openWorkbench()
  await page.screenshot({ path: resolve(OUT, '01-workbench-steward.png'), fullPage: true })
  log('opened', { opened, tabs: await page.locator('[data-testid="get-tab-cubes"]').count() })

  // Switch to «ნედლი კუბები».
  await page.locator('[data-testid="get-tab-cubes"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(OUT, '02-raw-cubes-tab.png'), fullPage: true })
  // The cube disclosure buttons carry aria-expanded (the outer section does not).
  const cubeRows = page.locator('[data-testid^="raw-cube-"][aria-expanded]')
  const cubeCount = await cubeRows.count()

  // Expand EVERY cube → record the member-label DEBT inventory (item 3).
  const debtInventory = {}
  for (let i = 0; i < cubeCount; i++) {
    const row = cubeRows.nth(i)
    const code = (await row.getAttribute('data-testid').catch(() => '') || '').replace('raw-cube-', '')
    await row.click().catch(() => {})
    await page.waitForTimeout(1800)
    const marks = await page.locator('[data-testid^="dim-debt-"]').allTextContents().catch(() => [])
    if (marks.length) debtInventory[code] = marks.map((m) => m.trim())
    await row.click().catch(() => {})   // collapse
    await page.waitForTimeout(300)
  }
  log('debt-inventory', { cubeCount, debtInventory })

  // Re-open the cube that carries debt (or the first) for the dim-summary shot + browse.
  const debtCodes = Object.keys(debtInventory)
  const targetCode = debtCodes[0] ?? ((await cubeRows.first().getAttribute('data-testid')) || '').replace('raw-cube-', '')
  await page.locator(`[data-testid="raw-cube-${targetCode}"]`).first().click().catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: resolve(OUT, '03-cube-dim-summary-debt.png'), fullPage: true })
  log('target-cube', { targetCode })

  // Browse the raw cube → the grid renders raw observations.
  await page.locator('[data-testid^="raw-cube-browse-"]').first().click().catch(() => {})
  await page.waitForTimeout(5000)
  const rowsAfterBrowse = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gridCaption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '')
  await page.screenshot({ path: resolve(OUT, '04-raw-browse-grid.png'), fullPage: true })
  log('browse', { rowsAfterBrowse, gridCaption: (gridCaption ?? '').trim().slice(0, 60) })

  // Add a step (the shaping) then PROMOTE.
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('[data-testid="verb-insert-filter"]').first().click().catch(() => {})
  await page.waitForTimeout(1200)

  const promoteOpen = page.locator('[data-testid="promote-metric-open"]')
  const promotePresent = await promoteOpen.count()
  await promoteOpen.first().click().catch(() => {})
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(OUT, '05-promote-form.png'), fullPage: true })

  // Fill the promotion (id + ka name) and submit. A unique id per run (the live catalog
  // persists across runs; a duplicate id is honestly rejected by the form).
  const promoId = 'probe_gva_' + Date.now().toString(36)
  const idInput = page.locator('[data-testid="promote-id"] input').first()
  await idInput.fill(promoId).catch(() => {})
  await page.locator('#promote-label-ka').fill('პრობ რეგიონული').catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('[data-testid="promote-submit"]').first().click().catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '06-promoted.png'), fullPage: true })

  // Is the head now governed? The steward promote affordance disappears once governed.
  const promoteGoneAfter = await page.locator('[data-testid="promote-metric-open"]').count()
  // Is the metric in the palette now? Switch to the metrics tab + search.
  await page.locator('[data-testid="get-tab-metrics"]').first().click().catch(() => {})
  await page.waitForTimeout(1000)
  const palettedMetric = await page.locator(`[data-metric-id="${promoId}"]`).count().catch(() => 0)
  log('promote', { promoId, promotePresent, promoteGoneAfter, palettedMetric })

  const wbText = await page.locator('[data-testid="data-workbench"]').innerText().catch(() => '')

  // ── AUTHOR lens — NO raw tab (fitness) ─────────────────────────────────────────
  //  A FRESH context (its own session) with the author role pinned, then log in.
  const authorCtx = await browser.newContext({ viewport: { width: 1720, height: 1000 } })
  const author = await authorCtx.newPage()
  await author.addInitScript(() => localStorage.setItem('statdash.role', JSON.stringify({ state: { role: 'author' }, version: 0 })))
  await author.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await author.waitForTimeout(1500)
  const apass = author.locator('input[type="password"]').first()
  if (await apass.count()) {
    await author.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await apass.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await author.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
    await author.waitForTimeout(4000)
  }
  await author.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await author.waitForTimeout(3000)
  const els = author.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  let authorRawTab = -1
  for (let i = 0; i < Math.min(await els.count(), 6); i++) {
    await els.nth(i).click().catch(() => {})
    await author.waitForTimeout(1000)
    if (!(await author.locator('[data-testid="data-facet-field"]').count())) continue
    const tile = author.locator('[data-testid^="metric-tile-"]').first()
    if (await tile.count()) { await tile.click().catch(() => {}); await author.waitForTimeout(1200) }
    const door = author.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    await door.click().catch(() => {})
    await author.waitForTimeout(3500)
    authorRawTab = await author.locator('[data-testid="get-tab-cubes"]').count()
    break
  }
  await author.screenshot({ path: resolve(OUT, '07-author-no-raw-tab.png'), fullPage: true })

  const rawLeaks = RAW_TOKENS.filter((t) => wbText.includes(t))
  log('honesty', { rawLeaks_stewardPlane_expected: rawLeaks, consoleErrors: errors })
  log('author-lens', { authorRawTab })
  log('done', {})
}

await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
