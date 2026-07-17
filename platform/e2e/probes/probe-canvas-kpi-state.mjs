// verification: regional canvas KPI cards state on the CURRENT synced panel
import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,80)) })
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
const pass = p.locator('input[type="password"]').first()
if (await pass.count()) {
  await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
  await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
  await p.waitForTimeout(4000)
  await p.goto('http://192.168.1.199:3013/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
}
await p.waitForTimeout(6000)
const cards = await p.locator('.kpi-card').allInnerTexts()
console.log(JSON.stringify({ cards: cards.slice(0,4).map(c => c.replace(/\n/g,' | ').slice(0,90)), errs: errs.slice(0,4) }, null, 1))
await p.screenshot({ path: '../work/authoring-truth/w2/canvas-kpi-post-fix.png' })
await b.close()
