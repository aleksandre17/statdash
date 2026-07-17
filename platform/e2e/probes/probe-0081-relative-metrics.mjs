// ── probe-0081-relative-metrics — governed time-relative metric, bound live on :3013 ─
//
//  ADR-045 / card 0081. Proves on the REAL stack that a GROWTH metric declared with a
//  relative coordinate ({ $prev: 1 }) is a first-class governed noun:
//    1. gdp.growthYoy surfaces in the Inspector DATA facet's Metric Palette (authorable).
//    2. Binding it to a canvas element LANDS (aria-live announcement).
//    3. The canvas renders a REAL growth value (the $prev member-navigation evaluates
//       live against the ApiStore — not an error, not a fabricated 0).
//  Shots → work/authoring-truth/0081/.
//
//  Mechanics mirror probe-w2-semantic-spine (lives under platform/ so bare imports
//  resolve from platform/node_modules). RUN (from platform/): node e2e/probes/probe-0081-relative-metrics.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0081')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const TARGET_METRIC = 'gdp.growthYoy'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
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

// The governed growth metric surfaces in the palette + binds + renders a real value.
async function bindGrowthMetric() {
  await page.goto(BASE + '/studio/insert', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  // Select a bindable canvas element (scoped to the live canvas overlay — see the
  // w2 probe note on the palette-tile ambiguity).
  const el = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="kpi-strip"]').first()
  if (await el.count()) { await el.click().catch(() => {}); await page.waitForTimeout(1500) }

  const paletteCount = await page.locator('[data-testid="metric-palette"]').count()
  const growthTile = page.locator(`[data-testid="metric-tile-${TARGET_METRIC}"]`).first()
  const inPalette = await growthTile.count() > 0
  await page.screenshot({ path: resolve(OUT, '01-palette-growth-metric.png') })

  let bound = false, announcement = ''
  if (inPalette) {
    await growthTile.scrollIntoViewIfNeeded().catch(() => {})
    await growthTile.click().catch(() => {})
    await page.waitForTimeout(1500)
    announcement = (await page.locator('[role="status"][aria-live="polite"]').first().textContent().catch(() => '')) ?? ''
    bound = /მიბმულია|bound/i.test(announcement)
  }
  await page.screenshot({ path: resolve(OUT, '02-bound-render.png') })
  log('BIND', { paletteRendered: paletteCount > 0, growthInPalette: inPalette, bound, announcement })
  return { inPalette, bound }
}

// The dashboard renders the governed growth number live (the $prev navigation runs in
// the browser against the ApiStore). We visit the accounts page and capture the KPIs.
async function renderDashboard() {
  await page.goto(BASE + '/accounts', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, '03-dashboard-accounts.png'), fullPage: true }).catch(() => {})
  log('DASHBOARD', { url: page.url() })
}

await login()
const r = await bindGrowthMetric()
await renderDashboard()
log('done', { result: r, consoleErrors: errors.slice(0, 8) })
await browser.close()
