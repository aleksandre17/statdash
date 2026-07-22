// Render-verify the reform on the dev line :3013 — AUTHENTICATED Studio, real browser.
import { chromium } from '@playwright/test'

const URL = process.env.VERIFY_URL || 'http://192.168.1.199:3013/'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

let ok = false
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1500)
  // Login gate: two inputs (user, password) + submit
  const inputs = page.locator('input')
  if (await inputs.count() >= 2) {
    await inputs.nth(0).fill('admin')
    await page.locator('input[type="password"]').first().fill('dev_admin_pw_123')
    await page.getByRole('button').first().click()
    await page.waitForTimeout(1500)
  }
  // Studio should boot; give Vite lazy chunks + api bootstrap time
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(6000)
  const url = page.url()
  const mainish = await page.locator('main, [role="main"], canvas, .canvas-layer--renderer, [data-part-node-id], [data-canvas-node-id], [class*="ActivityRail"], nav').count()
  const bodyLen = (await page.textContent('body'))?.trim().length ?? 0
  await page.screenshot({ path: 'work/__verify__/reform-3013-studio.png', fullPage: false })
  ok = mainish > 0 && bodyLen > 200 && errors.length === 0
  console.log(JSON.stringify({ url, mainishNodes: mainish, bodyTextLen: bodyLen, consoleErrors: errors.slice(0, 15), rendered: ok }, null, 2))
} catch (e) {
  console.log(JSON.stringify({ fatal: String(e), consoleErrors: errors.slice(0, 15), rendered: false }, null, 2))
} finally {
  await browser.close()
}
process.exit(ok ? 0 : 1)
