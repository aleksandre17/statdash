// ── probe-0089-cross-cube — a picked raw cube browses ITS OWN store (ADR-046 Add.3) ──
//
//  Walks the REAL stack (:3013, steward lens). Captures EVERY /api/stats/observations
//  wire `dataset` param. Opens the workbench on a page, records the PAGE's cube(s), then
//  Get → «ნედლი კუბები» → pick REGIONAL_GVA → browse → asserts the browse wire carries
//  dataset=REGIONAL_GVA (the picked cube's OWN store), not the page's cube. The lying-grid
//  fix: before 0089 the steward head declared no home → the browse read the page store.
//
//  RUN (from platform/):  node e2e/probes/probe-0089-cross-cube.mjs [pageSlug]
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0089')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const PAGE = process.argv[2] ?? 'regional'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
const obsWire = []  // { dataset, at } — every observations request, in order
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))
page.on('request', (r) => {
  const u = r.url()
  if (u.includes('/api/stats/observations')) {
    const ds = new URL(u).searchParams.get('dataset')
    obsWire.push({ dataset: ds, at: Date.now() })
  }
})

async function setRole(role) {
  await page.addInitScript((r) => {
    localStorage.setItem('statdash.role', JSON.stringify({ state: { role: r }, version: 0 }))
  }, role)
}
async function login() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const pass = page.locator('input[type="password"]').first()
  if (await pass.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await pass.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
    await page.waitForTimeout(4000)
  }
}
async function openWorkbench() {
  await page.goto(BASE + `/studio/insert?page=${PAGE}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
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
  await setRole('steward')
  await login()
  const opened = await openWorkbench()
  await page.screenshot({ path: resolve(OUT, '01-workbench.png'), fullPage: true })
  const pageCubes = [...new Set(obsWire.map((w) => w.dataset))]
  const markPagePhase = obsWire.length
  log('opened', { page: PAGE, opened, pageCubes, obsCount: obsWire.length })

  // Get → «ნედლი კუბები» tab.
  await page.locator('[data-testid="get-tab-cubes"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  const rawCubes = await page.locator('[data-testid^="raw-cube-"][aria-expanded]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid')?.replace('raw-cube-', '')),
  ).catch(() => [])
  log('raw-tab', { rawCubes })

  // Pick the cube: PICK env override, else REGIONAL_GVA, else the first non-page cube.
  const pick = (process.env.PICK && rawCubes.includes(process.env.PICK)) ? process.env.PICK
    : rawCubes.includes('REGIONAL_GVA') ? 'REGIONAL_GVA'
    : (rawCubes.find((c) => !pageCubes.includes(c)) ?? rawCubes[0])
  await page.locator(`[data-testid="raw-cube-${pick}"]`).first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(OUT, '02-cube-expanded.png'), fullPage: true })

  // Browse → the grid renders + the source read fires the wire.
  const browseFrom = obsWire.length
  await page.locator(`[data-testid="raw-cube-browse-${pick}"], [data-testid^="raw-cube-browse-"]`).first().click().catch(() => {})
  await page.waitForTimeout(6000)
  const rows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  await page.screenshot({ path: resolve(OUT, '03-browse-grid.png'), fullPage: true })

  const browseWire = obsWire.slice(browseFrom).map((w) => w.dataset)
  const browseDatasets = [...new Set(browseWire)]
  log('browse', {
    pickedCube: pick,
    pageCubes,
    browseDatasets,
    rowsInGrid: rows,
    routedToPickedCube: browseDatasets.includes(pick),
    crossCube: !pageCubes.includes(pick),
  })
  log('honesty', { consoleErrors: errors.slice(0, 6) })
  log('done', { totalObsRequests: obsWire.length, markPagePhase })
}

await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
