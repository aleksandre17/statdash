// ── probe-w1-honest-canvas — full W1 "honest canvas" gesture-truth proof on :3013 ─
//  Proves live (Canon C2): live-data-by-default; the honest structural veil; ONE
//  perspective control; real (non-zero) KPI values; NO {token} plumbing leak on the
//  canvas; canvas chrome carrying the published brand accent (#0080BE); the unbound-
//  KPI affordance count (data-kpi-state=unbound — shows only when an unbound element
//  is present). Shots → work/authoring-truth/w1/.
//  RUN (from platform/, where @statdash + @playwright/test resolve):
//    cp ../work/probe-w1-honest-canvas.mjs ./_probe.mjs && node _probe.mjs && rm _probe.mjs
//  (ESM resolves bare specifiers from the file's own dir; work/ has no node_modules.)
//  OUT is resolved relative to this file, so it lands in work/ regardless of cwd.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT  = resolve(HERE, '..', 'work', 'authoring-truth', 'w1')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
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
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/w1-01-default-live.png` })

const state = await page.evaluate(() => {
  const modeRadios = [...document.querySelectorAll('.canvas-toolbar [role="radio"]')].map(
    (r) => ({ label: r.textContent?.trim(), checked: r.getAttribute('aria-checked') }))
  const canvasEl = document.querySelector('[data-testid="canvas-root"]')
  const canvasText = canvasEl?.textContent ?? ''
  // Token-leak: any raw {placeholder} braces rendered as author-visible text.
  const tokenLeaks = (canvasText.match(/\{[a-zA-Z][\w.]*\}/g) ?? []).slice(0, 8)
  return {
    liveDefault: modeRadios.find((r) => /ცოცხალი/.test(r.label ?? ''))?.checked === 'true',
    veilPresent: !!document.querySelector('[data-testid="canvas-structural-veil"]'),
    perspectiveSwitchInToolbar: !!document.querySelector('[data-testid="canvas-perspective-switch"]'),
    modeRadios,
    hasNonZeroKpi: [...document.querySelectorAll('.kpi-value')].some((v) => /[1-9]/.test(v.textContent ?? '')),
    kpiValues: [...document.querySelectorAll('.kpi-value')].map((v) => v.textContent?.trim()).slice(0, 8),
    unboundAffordances: document.querySelectorAll('[data-kpi-state="unbound"]').length,
    tokenLeaks,
    tokenLeakCount: tokenLeaks.length,
    canvasAccent: canvasEl instanceof HTMLElement ? canvasEl.style.getPropertyValue('--color-accent') : '(no canvas-root)',
  }
})
log('default', state)

// structural opt-out → honest veil
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
