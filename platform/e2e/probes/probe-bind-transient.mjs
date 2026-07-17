// decisive: KPI card text at +1.5s and +6s after a palette bind (transient-state truth)
import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
const pass = p.locator('input[type="password"]').first()
if (await pass.count()) {
  await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
  await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
  await p.waitForTimeout(4000)
  await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
}
await p.waitForTimeout(6000)
await p.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"]').first().click({ force: true })
await p.waitForTimeout(1500)
const tile = p.locator('[data-testid="metric-palette"] button, [data-testid="metric-palette"] [role="option"]', { hasText: /ზრდა/ }).first()
await tile.click().catch(()=>{})
await p.waitForTimeout(1500)
const at1_5 = await p.locator('.kpi-card').allInnerTexts()
await p.waitForTimeout(4500)
const at6 = await p.locator('.kpi-card').allInnerTexts()
console.log(JSON.stringify({
  at1_5s: at1_5.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,55)),
  at6s:   at6.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,55)) }, null, 1))
await b.close()
