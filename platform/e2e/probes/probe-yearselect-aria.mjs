import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,70))})
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional',{waitUntil:'networkidle',timeout:60000}).catch(()=>{})
const pass=p.locator('input[type="password"]').first()
if(await pass.count()){await p.locator('input[name="username"],input[type="text"]').first().fill('admin').catch(()=>{});await pass.fill('dev_admin_pw_123');await p.locator('button[type="submit"]').first().click().catch(()=>{});await p.waitForTimeout(4000);await p.goto('http://192.168.1.199:3013/studio/insert?page=regional',{waitUntil:'networkidle',timeout:60000}).catch(()=>{})}
await p.waitForTimeout(5000)
// find the year-select combobox in the canvas filter bar; read its accessible name
const combos = p.locator('.studio-canvas select, .studio-canvas [role="combobox"], select')
const n = await combos.count()
const names=[]
for(let i=0;i<Math.min(n,8);i++){ const al = await combos.nth(i).getAttribute('aria-label').catch(()=>null); if(al) names.push(al) }
console.log(JSON.stringify({ comboAriaLabels: names, hasWeliKa: names.some(x=>/წელი/.test(x)), hasYearEn: names.some(x=>/^Year$/.test(x)), errs: errs.slice(0,3) }))
await b.close()
