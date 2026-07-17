// exact replica of probe-0081's flow, reading card texts (no-param entry)
import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://192.168.1.199:3013/', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(1500)
const pass = p.locator('input[type="password"]').first()
if (await pass.count()) {
  await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
  await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
  await p.waitForTimeout(4000)
}
await p.goto('http://192.168.1.199:3013/studio/insert', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(4000)
const el = p.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="kpi-strip"]').first()
if (await el.count()) { await el.click().catch(()=>{}); await p.waitForTimeout(1500) }
const tile = p.locator('[data-testid="metric-tile-gdp.growthYoy"]').first()
if (await tile.count()) { await tile.scrollIntoViewIfNeeded().catch(()=>{}); await tile.click().catch(()=>{}) }
await p.waitForTimeout(1500)
const cards1 = await p.locator('.kpi-card').allInnerTexts()
await p.waitForTimeout(5000)
const cards2 = await p.locator('.kpi-card').allInnerTexts()
console.log(JSON.stringify({ url: p.url(),
  at1_5: cards1.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,55)),
  at6_5: cards2.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,55)) }, null, 1))
await b.close()
