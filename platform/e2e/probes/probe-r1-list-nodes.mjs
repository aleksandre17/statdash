import { chromium } from '@playwright/test'
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })

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
await page.goto(BASE + '/studio/insert?page=gdp', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(4000)

const nodes = await page.locator('[data-testid="canvas-overlay"] [data-node-id]').evaluateAll((els) =>
  els.map((el) => ({ id: el.getAttribute('data-node-id'), type: el.getAttribute('data-node-type') })),
)
log('nodes', { nodes })
await browser.close()
