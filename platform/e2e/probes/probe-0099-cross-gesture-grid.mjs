// ── probe-0099-cross-gesture-grid — «დაათვალიერე workbench-ში» lands on the GRID ──
//
//  Closes 0089 finding #2 / completes 0091. Walks the REAL stack (:3013, steward lens):
//  Sources page → expand REGIONAL_GVA → «დაათვალიერე workbench-ში» → asserts the
//  three-pane WORKBENCH renders (the 200-row browse GRID + steps rail + generated-query
//  pane), NOT the raw-JSON JsonFallback. Captures the browse wire (dataset=REGIONAL_GVA).
//  Then re-checks the in-place inspector DATA-facet workbench door (0086) — no regression.
//
//  RUN (from platform/):  node e2e/probes/probe-0099-cross-gesture-grid.mjs [pageSlug]
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0099')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const PAGE = process.argv[2] ?? 'regional'
const PICK = process.env.PICK ?? 'REGIONAL_GVA'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
const obsWire = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))
page.on('request', (r) => {
  const u = r.url()
  if (u.includes('/api/stats/observations')) {
    obsWire.push({ dataset: new URL(u).searchParams.get('dataset'), at: Date.now() })
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

async function crossGesture() {
  // Sources page (the Data Home, FIRST in nav) — the origin of the «დაათვალიერე» gesture.
  await page.goto(BASE + `/studio/sources?page=${PAGE}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '01-sources.png'), fullPage: true })

  // Expand the cube, then click «დაათვალიერე workbench-ში».
  await page.locator(`[data-testid="inv-cube-${PICK}"]`).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(OUT, '02-cube-expanded.png'), fullPage: true })

  const browseFrom = obsWire.length
  const btn = page.locator(`[data-testid="inv-cube-workbench-${PICK}"]`).first()
  const hasBtn = await btn.count()
  await btn.click().catch(() => {})
  // The handoff navigates to /studio/model + steward lens; the workbench consumes it,
  // creates the seeded pipeline spec, and renders the grid (source read → wire).
  await page.waitForTimeout(7000)
  await page.screenshot({ path: resolve(OUT, '03-workbench-grid.png'), fullPage: true })

  const onWorkbench = await page.locator('[data-testid="data-workbench"]').count()
  const modelingHead = await page.locator('[data-testid="modeling-workbench"]').count()
  const gridCount = await page.locator('[data-testid="pipeline-grid"]').count()
  const rows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gqPane = await page.locator('[data-testid="workbench-query"] [data-testid="generated-query"]').count()
  const rawAdvancedCollapsed = await page.locator('[data-testid="workbench-raw-advanced"] [aria-expanded="false"]').count()
  // The raw-JSON textarea must NOT be the landing surface (JsonFallback caption absent up-front).
  const jsonFallbackVisible = await page.getByText('ვიზუალური რედაქტორი ამ ტიპისთვის ჯერ არ არის').isVisible().catch(() => false)

  const browseWire = [...new Set(obsWire.slice(browseFrom).map((w) => w.dataset))]
  log('cross-gesture', {
    hasBrowseButton: !!hasBtn,
    landedOnWorkbench: !!onWorkbench,
    isModelingWorkbench: !!modelingHead,
    hasBrowseGrid: !!gridCount,
    rowsInGrid: rows,
    hasGeneratedQueryPane: !!gqPane,
    rawJsonIsCollapsedDisclosure: !!rawAdvancedCollapsed,
    jsonFallbackIsLanding: jsonFallbackVisible,
    browseWireDatasets: browseWire,
    routedToPickedCube: browseWire.includes(PICK),
  })

  // Steps addable — the verb palette / add-step affordance is present in the rail.
  const canAddStep = await page.locator('[data-testid="workbench-rail"] [data-testid="verb-palette"], [data-testid="workbench-rail"] button:has-text("ნაბიჯი"), [data-testid="workbench-rail"] button:has-text("დაამატე")').count()
  log('steps', { addStepAffordance: canAddStep })
}

// ── No-regression: the in-place inspector DATA-facet workbench door (0086) ─────────
async function facetDoorStillWorks() {
  await page.goto(BASE + `/studio/insert?page=${PAGE}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1000)
    if (!(await page.locator('[data-testid="data-facet-field"]').count())) continue
    const door = page.locator('[data-testid="open-data-workbench"]')
    if (!(await door.count())) continue
    await door.click().catch(() => {})
    await page.waitForTimeout(4000)
    if (await page.locator('[data-testid="data-workbench"]').count()) {
      await page.screenshot({ path: resolve(OUT, '04-facet-door.png'), fullPage: true })
      log('facet-door', { opened: true, viaElement: i })
      return
    }
  }
  log('facet-door', { opened: false })
}

async function run() {
  await setRole('steward')
  await login()
  await crossGesture()
  await facetDoorStillWorks()
  const nonRateLimit = errors.filter((e) => !e.includes('429') && !e.toLowerCase().includes('too many requests'))
  log('honesty', { rateLimit429: errors.length - nonRateLimit.length, nonRateLimitErrors: nonRateLimit.slice(0, 8), nonRateLimitCount: nonRateLimit.length })
  log('done', { totalObsRequests: obsWire.length })
}

await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
