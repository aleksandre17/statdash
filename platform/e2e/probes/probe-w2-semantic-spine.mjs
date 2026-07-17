// ── probe-w2-semantic-spine — the W2 journeys walked live on :3013 (J1 · J2 · J4) ─
//
//  Canon C1 "data first, always". Proves on the REAL stack:
//    J1 — onboard raw data is ONE step from the shell: rail Data → the onboard-data
//         DOOR (data-front-door / canonical-upload) renders in the DEFAULT author lens,
//         NO Steward flip required.
//    J2 — the Steward defines/governs a metric: flip the in-place lens to Edit →
//         the metric catalog manager + the Data-Flow map (the Data home orientation).
//    J4 — bind data to an element via a governed noun: select a bindable canvas
//         element → the Inspector DATA facet's Metric Palette → click a governed metric
//         tile → the element's measure field carries the metric-id (the bind lands).
//  Shots → work/authoring-truth/w2/.
//
//  ── PROBE MECHANICS (the permanent fix — no more copy dance) ─────────────────────
//  This probe lives UNDER the platform subtree (platform/e2e/probes/), so Node resolves
//  its bare imports (@playwright/test, @statdash/*) from platform/node_modules by walking
//  up — the old work/ probes needed `cp ../work/probe.mjs ./_probe.mjs` because work/ has
//  no node_modules and is a SIBLING of platform/ (Node never reaches platform/node_modules
//  from there; NODE_PATH does not help ESM bare specifiers). New FF-JOURNEY-* probes go
//  HERE and run with zero copy:
//    RUN (from platform/):  node e2e/probes/probe-w2-semantic-spine.mjs
//  OUT is resolved relative to THIS file, so shots land in work/ regardless of cwd.
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
// platform/e2e/probes → up 3 → national-accounts → work/authoring-truth/w2
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', 'w2')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
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

// ── J1 — onboarding is ONE step from the shell (author lens, no burial) ──────────
async function journeyOnboard() {
  await page.goto(BASE + '/studio/model', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3500)
  const door   = await page.locator('[data-testid="data-front-door"]').count()
  const upload = await page.locator('[data-testid="canonical-upload"]').count()
  await page.screenshot({ path: resolve(OUT, 'j1-onboard-front-door.png') })
  log('J1', { frontDoor: door > 0, upload: upload > 0, url: page.url() })
}

// ── J2 — the Steward defines a governed metric (flip the in-place Edit lens) ─────
async function journeyDefine() {
  const edit = page.locator('[data-testid="data-model-lens-toggle"] button', { hasText: /Edit|რედაქტ/ }).first()
  if (await edit.count()) { await edit.click().catch(() => {}); await page.waitForTimeout(4000) }
  const flow    = await page.locator('[data-testid="data-flow-map"]').count()
  const catalog = await page.getByText(/New metric|ახალი მეტრიკა|Define the governed data model|განისაზღვრება/).count()
  await page.screenshot({ path: resolve(OUT, 'j2-define-metric.png') })
  log('J2', { dataFlowMap: flow > 0, catalogManager: catalog > 0 })
}

// ── J4 — bind a governed metric to a canvas element ──────────────────────────────
async function journeyBind() {
  await page.goto(BASE + '/studio/insert', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  // Select a bindable element on the LIVE CANVAS (`CanvasOverlay.tsx` renders one
  // `.canvas-node[data-node-id][data-node-type]` focus-frame button per canvas node,
  // scoped inside `[data-testid="canvas-overlay"]`). The unscoped `[data-node-type=
  // "chart"], .canvas-node` selector this probe used to carry is AMBIGUOUS: the left
  // rail's insertion NodePalette (`ბლოკები`) ALSO stamps `data-node-type="chart"` on
  // its OWN tile button (`NodePalette.tsx` — "insert a chart block", a completely
  // different affordance) and sits EARLIER in DOM order, so `.first()` silently
  // grabbed the palette tile instead of a real canvas element — a no-op click, J4
  // never walked (root cause: probe gesture, not a product gap — the live bind path
  // works end-to-end once the correct element is targeted; verified via
  // debug-j4-bound.png during the 0072-w2 investigation).
  const el = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"]').first()
  if (await el.count()) { await el.click().catch(() => {}); await page.waitForTimeout(1500) }
  const palette = await page.locator('[data-testid="metric-palette"]').count()
  const tile    = page.locator('[data-testid^="metric-tile-"]').first()
  let bound = false
  if (await tile.count()) {
    const id = await tile.getAttribute('data-metric-id')
    await tile.click().catch(() => {})
    await page.waitForTimeout(1200)
    // Confirm the bind LANDED (not just that a click fired): MetricPalette's aria-live
    // status region announces "მეტრიკა მიბმულია: <label>" on a successful onBind.
    const announcement = await page.locator('[role="status"][aria-live="polite"]').first().textContent().catch(() => '')
    bound = Boolean(id) && /მიბმულია/.test(announcement ?? '')
    log('J4', { palette: palette > 0, boundMetricId: id, bound, announcement })
  } else {
    log('J4', { palette: palette > 0, note: 'no bindable element selected / palette empty' })
  }
  await page.screenshot({ path: resolve(OUT, 'j4-bind-metric.png') })
  return bound
}

await login()
await journeyOnboard()
await journeyDefine()
await journeyBind()
log('done', { consoleErrors: errors })
await browser.close()
