// ── probe-0091-data-home — «წყაროები» FIRST, cube inventory + browsable classifiers ──
//
//  0091. Walks the REAL stack (:3013): rail shows «წყაროები» FIRST → the page lists cubes
//  → expand a cube → dims → a dimension's codelist members in governed Georgian (tree if
//  edges) → ONE upload door here, ZERO on the Model page → cross-gesture cube→workbench.
//  Zero console errors.
//
//  RUN (from platform/):  node e2e/probes/probe-0091-data-home.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0091')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

const shot = (name) => page.screenshot({ path: resolve(OUT, name), fullPage: false })

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

await login()

// ── 1) Sources is FIRST in the rail ────────────────────────────────────────────
await page.goto(BASE + '/studio/sources', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3500)
const rail = page.locator('nav[aria-label="Studio surfaces"]')
const railButtons = rail.locator('button')
const firstRailName = await railButtons.first().getAttribute('aria-label').catch(() => null)
const railOrder = await railButtons.evaluateAll((btns) => btns.map((b) => b.getAttribute('aria-label')))
await shot('01-sources-page.png')
log('rail', { firstRailName, railOrder })

const uploadOnSources = await page.locator('[data-testid="canonical-upload"]').count()
log('upload-door-on-sources', { count: uploadOnSources })

// ── 2) List cubes → expand the first cube ───────────────────────────────────────
const cubeRows = page.locator('[data-testid^="inv-cube-"]').filter({ hasNot: page.locator('[data-testid*="workbench"]') })
const cubeCount = await page.locator('[data-testid^="inv-cube-"]:not([data-testid*="workbench"])').count()
log('cube-inventory', { cubeCount })

// Prefer REGIONAL_GVA if present, else the first cube.
let target = page.locator('[data-testid="inv-cube-REGIONAL_GVA"]')
if (!(await target.count())) target = page.locator('[data-testid^="inv-cube-"]:not([data-testid*="workbench"])').first()
const targetId = await target.getAttribute('data-testid').catch(() => null)
await target.click().catch(() => {})
await page.waitForTimeout(2500)
await shot('02-cube-expanded.png')

// ── 3) Expand a dimension → its codelist members (the classifier browse) ─────────
const geo = page.locator('[data-testid="inv-dim-geo"]')
let dim = (await geo.count()) ? geo : page.locator('[data-testid^="inv-dim-"]').first()
const dimId = await dim.getAttribute('data-testid').catch(() => null)
await dim.click().catch(() => {})
await page.waitForTimeout(1800)
const tree = page.locator('[data-testid="codelist-tree"]').first()
const hierarchical = await tree.getAttribute('data-hierarchical').catch(() => null)
const memberText = await tree.innerText().catch(() => '')
await shot('03-codelist-tree.png')
log('codelist', { dimId, hierarchical, sample: memberText.slice(0, 200) })

// ── 4) The Model page — Floor-2 only, ZERO upload door ──────────────────────────
await page.goto(BASE + '/studio/model', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3500)
const uploadOnModel = await page.locator('[data-testid="canonical-upload"]').count()
const frontDoorOnModel = await page.locator('[data-testid="data-front-door"]').count()
await shot('04-model-page.png')
log('model-page', { uploadOnModel, frontDoorOnModel })

// ── 5) Cross-gesture: cube → workbench (Steward lens, seeded) ────────────────────
await page.goto(BASE + '/studio/sources', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await (await target.count() ? target : page.locator('[data-testid^="inv-cube-"]:not([data-testid*="workbench"])').first()).click().catch(() => {})
await page.waitForTimeout(2000)
const wbBtn = page.locator('[data-testid^="inv-cube-workbench-"]').first()
const hadWbBtn = await wbBtn.count()
await wbBtn.click().catch(() => {})
await page.waitForTimeout(4500)
const url = page.url()
await shot('05-cross-gesture-workbench.png')
log('cross-gesture', { hadWbBtn, url })

log('done', { errors: errors.slice(0, 12), errorCount: errors.length })
await browser.close()
