// ── probe-authoring-truth — the lead's personal gesture-truth probe vs live :3013 ──
// Walks the REAL author journey and reports what is actually reachable/usable:
//   boot → login → studio → canvas census → select node → dock census →
//   select KPI part → chrome select → pages → model surface census.
// Output: JSON lines + screenshots under work/authoring-truth/.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const OUT = 'work/authoring-truth'
mkdirSync(OUT, { recursive: true })

const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)))

// 1 — boot
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log('boot', { error: String(e) }))
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-boot.png` })
log('boot', { url: page.url(), title: await page.title(), bodyChars: (await page.textContent('body').catch(() => '') || '').length })

// 2 — login if a form is present
const userField = page.locator('input[name="username"], input[type="text"]').first()
const passField = page.locator('input[type="password"]').first()
if (await passField.count()) {
  await userField.fill('admin').catch(() => {})
  await passField.fill('dev_admin_pw_123').catch(() => {})
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
  await page.waitForTimeout(4000)
  log('login', { url: page.url() })
  await page.screenshot({ path: `${OUT}/02-after-login.png` })
}

// 3 — studio census
if (!page.url().includes('/studio')) {
  await page.goto(BASE + '/studio/insert', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
}
await page.screenshot({ path: `${OUT}/03-studio.png`, fullPage: false })
const census = await page.evaluate(() => {
  const q = (s) => document.querySelectorAll(s).length
  return {
    railButtons: q('.studio-rail__btn'),
    paletteTiles: q('[data-testid="palette-item"], .node-palette [draggable], .node-palette button'),
    canvasNodes: q('[data-node-id]'),
    partAnchors: q('[data-part-field], [data-part-key], [data-part-path]'),
    chromeAnchors: q('[data-canvas-chrome-slot], [data-part-residence="sourced"]'),
    pageChips: q('footer [role="tab"], .studio-bottom [role="tab"]'),
    dockPresent: q('.studio-right-dock'),
    emptyStates: q('[class*="EmptyState"], [data-testid*="empty"]'),
  }
})
log('studio-census', census)

// 4 — click first canvas node → dock contents
const firstNode = page.locator('[data-node-id]').first()
if (await firstNode.count()) {
  await firstNode.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1200)
  const dockText = (await page.locator('[data-testid="dock-content"]').textContent().catch(() => '')) || ''
  const dockSections = await page.locator('[data-testid="dock-content"] .MuiAccordion-root, [data-testid="dock-content"] [role="tab"]').count()
  log('select-node', { dockChars: dockText.length, dockSections, dockPreview: dockText.slice(0, 300) })
  await page.screenshot({ path: `${OUT}/04-node-selected.png` })
}

// 5 — deep part: try a KPI/band item
const bandItem = page.locator('[data-part-path], [data-item-path]').first()
if (await bandItem.count()) {
  await bandItem.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1000)
  const dockText = (await page.locator('[data-testid="dock-content"]').textContent().catch(() => '')) || ''
  log('select-part', { dockPreview: dockText.slice(0, 250) })
  await page.screenshot({ path: `${OUT}/05-part-selected.png` })
} else { log('select-part', { found: 0 }) }

// 6 — chrome: click header region if anchored
const chrome = page.locator('[data-canvas-chrome-slot]').first()
if (await chrome.count()) {
  await chrome.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1000)
  const dockText = (await page.locator('[data-testid="dock-content"]').textContent().catch(() => '')) || ''
  log('select-chrome', { dockPreview: dockText.slice(0, 250) })
  await page.screenshot({ path: `${OUT}/06-chrome-selected.png` })
} else { log('select-chrome', { found: 0 }) }

// 7 — model surface
await page.goto(BASE + '/studio/model', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3500)
const modelText = (await page.textContent('body').catch(() => '')) || ''
log('model-surface', {
  hasUpload: /ატვირთ|Upload|Onboard/i.test(modelText),
  hasFlowMap: /Data.?flow|ნაკადი|flow/i.test(modelText),
  hasMetricCatalog: /metric|მეტრიკ/i.test(modelText),
  chars: modelText.length,
})
await page.screenshot({ path: `${OUT}/07-model.png`, fullPage: true })

// 8 — pages surface
await page.goto(BASE + '/studio/pages-site', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/08-pages-site.png` })
const pagesText = (await page.textContent('aside').catch(() => '')) || ''
log('pages-site', { asidePreview: pagesText.slice(0, 250) })

log('console-errors', { count: consoleErrors.length, first: consoleErrors.slice(0, 8) })
await browser.close()
