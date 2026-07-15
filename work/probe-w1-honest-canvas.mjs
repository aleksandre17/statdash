// ── probe-w1-honest-canvas — gesture-truth proof of AR-52 W1 on live :3013 ─────
//  Proves (live): live-data-by-default paints real values on open; the explicit
//  structural opt-out raises the honest "preview off" veil; ONE perspective control
//  (no duplicate toolbar tab-bar). Screenshots → work/authoring-truth/w1/.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const OUT  = 'work/authoring-truth/w1'
mkdirSync(OUT, { recursive: true })
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(1500)
const passField = page.locator('input[type="password"]').first()
if (await passField.count()) {
  await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
  await passField.fill('dev_admin_pw_123').catch(() => {})
  await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
  await page.waitForTimeout(4000)
}
if (!page.url().includes('/studio')) {
  await page.goto(BASE + '/studio/insert', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4500)
}

// 1 — default state: live mode active (no veil), the mode toggle present.
await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}/w1-01-default-live.png` })
const state = await page.evaluate(() => {
  const modeRadios = [...document.querySelectorAll('.canvas-toolbar [role="radio"]')].map(
    (r) => ({ label: r.textContent?.trim(), checked: r.getAttribute('aria-checked') }))
  return {
    liveDefault: modeRadios.find((r) => /ცოცხალი/.test(r.label ?? ''))?.checked === 'true',
    veilPresent: !!document.querySelector('[data-testid="canvas-structural-veil"]'),
    perspectiveSwitchInToolbar: !!document.querySelector('[data-testid="canvas-perspective-switch"]'),
    modeRadios,
    // Truthful data check — a real KPI value (non-zero) somewhere on the canvas.
    hasNonZeroKpi: [...document.querySelectorAll('.kpi-value')].some((v) => /[1-9]/.test(v.textContent ?? '')),
    unboundAffordances: document.querySelectorAll('[data-kpi-state="unbound"]').length,
  }
})
log('default', state)

// 2 — opt into structural → the honest veil rises.
const structuralRadio = page.locator('.canvas-toolbar [role="radio"]', { hasText: 'სტრუქტურა' }).first()
if (await structuralRadio.count()) {
  await structuralRadio.click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/w1-02-structural-veil.png` })
  const veil = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="canvas-structural-veil"]')
    return { veilPresent: !!v, veilText: v?.textContent?.trim().slice(0, 120) }
  })
  log('structural-veil', veil)
}

log('console-errors', { count: errors.length, first: errors.slice(0, 6) })
await browser.close()
