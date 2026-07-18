import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage()
const errs = []; p.on('console', m=>{if(m.type()==='error')errs.push(m.text().slice(0,80))}); p.on('pageerror', e=>errs.push('PE:'+String(e).slice(0,80)))
await p.goto('http://192.168.1.199:3013/studio/insert?page=regional',{waitUntil:'networkidle',timeout:60000}).catch(()=>{})
const pass=p.locator('input[type="password"]').first()
if(await pass.count()){await p.locator('input[name="username"],input[type="text"]').first().fill('admin').catch(()=>{});await pass.fill('dev_admin_pw_123');await p.locator('button[type="submit"]').first().click().catch(()=>{});await p.waitForTimeout(4000)}
await p.waitForTimeout(3000)
const canvas = await p.locator('.studio-canvas, main').count()
const bodyTxt = await p.locator('body').innerText().catch(()=>'')
console.log(JSON.stringify({ canvasMounted: canvas>0, topbarGeorgian: /გვერდები|ისტორია|მონახაზი/.test(bodyTxt), errs: errs.slice(0,5) }))
await b.close()
