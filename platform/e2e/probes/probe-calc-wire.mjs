// wire capture on the calc-browse flow: does ANY obs fetch fire for the gdp dataset?
import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const wires = []; p.on('request', r => { const u = r.url(); if (/observation/.test(u)) wires.push(u.replace(/^.*observations\?/, '').slice(0, 100)) })
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,80)) })
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
const pass = p.locator('input[type="password"]').first()
if (await pass.count()) {
  await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
  await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
  await p.waitForTimeout(4000)
  await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
}
await p.waitForTimeout(5000)
// select 2nd chart element, open workbench, Get gdp.growthYoy
const els = p.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"]')
await els.nth(1).click({ force: true }); await p.waitForTimeout(1500)
const door = p.locator('[data-testid="open-data-workbench"], button:has-text("workbench"), button:has-text("ვორქბენჩ"), [data-testid="data-facet"] button').first()
if (await door.count()) await door.click().catch(()=>{})
await p.waitForTimeout(2000)
wires.length = 0 // only post-Get wires matter
const tile = p.locator('[data-testid="metric-tile-gdp.growthYoy"]').first()
if (await tile.count()) { await tile.scrollIntoViewIfNeeded().catch(()=>{}); await tile.click().catch(()=>{}) }
await p.waitForTimeout(8000)
const grid = await p.locator('[class*=pipeline], [class*=workbench]').first().innerText().catch(()=>'')
console.log(JSON.stringify({ postGetWires: wires.slice(0,10), gridText: grid.replace(/\n/g,'|').slice(0,200), errs: errs.slice(0,4) }, null, 1))
await b.close()
