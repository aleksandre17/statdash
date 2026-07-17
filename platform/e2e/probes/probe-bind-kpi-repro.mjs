// decisive repro: canvas KPI cards BEFORE and AFTER a palette bind + post-bind obs wires
import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const wires = []; let mark = 0
p.on('request', r => { const u = r.url(); if (/observation/.test(u)) wires.push((mark ? 'POST-BIND ' : 'pre ') + u.replace(/^.*observations\?/, '').slice(0, 110)) })
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,70)) })
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
const pass = p.locator('input[type="password"]').first()
if (await pass.count()) {
  await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
  await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
  await p.waitForTimeout(4000)
  await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
}
await p.waitForTimeout(6000)
const before = await p.locator('.kpi-card').allInnerTexts()
// select a bindable chart node then bind a governed metric via the palette (0081's gesture)
await p.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"]').first().click({ force: true })
await p.waitForTimeout(1500)
mark = 1
const tile = p.locator('[data-testid="metric-palette"] [role="option"], [data-testid="metric-palette"] button', { hasText: /ზრდა/ }).first()
if (await tile.count()) await tile.click().catch(()=>{})
await p.waitForTimeout(6000)
const after = await p.locator('.kpi-card').allInnerTexts()
console.log(JSON.stringify({
  before: before.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,60)),
  after:  after.slice(0,2).map(t=>t.replace(/\n/g,'|').slice(0,60)),
  postBindWires: wires.filter(w=>w.startsWith('POST-BIND')).slice(0,6),
  errs: errs.slice(0,3) }, null, 1))
await b.close()
