import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,90)) })
const OUT = new URL('../../work/authoring-truth/0091/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')
async function login(){
  const pass = p.locator('input[type="password"]').first()
  if (await pass.count()) {
    await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
    await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
    await p.waitForTimeout(4000)
  }
}
await p.goto('http://192.168.1.199:3013/studio/sources?page=regional', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{})
await login()
await p.goto('http://192.168.1.199:3013/studio/sources?page=regional', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{})
await p.waitForTimeout(4000)
const body = await p.locator('[data-testid="sources-body"]').count()
const uploadOnSources = await p.locator('[data-testid="sources-upload"]').count()
const cubeInv = await p.locator('[data-testid="cube-inventory"]').count()
const cubeText = (await p.locator('[data-testid="cube-inventory"]').innerText().catch(()=>'')).replace(/\n/g,' | ').slice(0,220)
await p.screenshot({ path: OUT+'01-sources-page.png', fullPage:true }).catch(()=>{})
// expand first cube for classifiers
const expander = p.locator('[data-testid="cube-inventory"] [aria-expanded], [data-testid="cube-inventory"] [role="button"]').first()
let classifierText = ''
if (await expander.count()) { await expander.click().catch(()=>{}); await p.waitForTimeout(2500); classifierText = (await p.locator('[data-testid="cube-inventory"]').innerText().catch(()=>'')).replace(/\n/g,' | ').slice(0,300); await p.screenshot({ path: OUT+'02-cube-expanded.png', fullPage:true }).catch(()=>{}) }
// model page should NOT carry the front-door upload anymore
await p.goto('http://192.168.1.199:3013/studio/model?page=regional', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{})
await p.waitForTimeout(3000)
const frontDoorOnModel = await p.locator('[data-testid="data-front-door"]').count()
const uploadOnModel = await p.locator('[data-testid="sources-upload"], [data-testid="data-front-door"]').count()
await p.screenshot({ path: OUT+'03-model-cleaned.png', fullPage:true }).catch(()=>{})
console.log(JSON.stringify({ sourcesBody:body, uploadOnSources, cubeInventory:cubeInv, cubeText, classifierText, frontDoorOnModel, uploadOnModel, errs:errs.slice(0,4) }, null, 1))
await b.close()
