import { chromium } from 'playwright'
const BASE='http://192.168.1.199:3013'
const b=await chromium.launch({headless:true})
const p=await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`${BASE}/studio`,{waitUntil:'networkidle'}); await p.waitForTimeout(1500)
// login if a form is present
const hasPwd = await p.$('input[type="password"]')
if (hasPwd){
  const user = await p.$('input[type="text"], input[name*="user" i], input[type="email"]')
  if(user) await user.fill('admin')
  await hasPwd.fill('dev_admin_pw_123')
  const btn = await p.$('button[type="submit"], button')
  if(btn) await btn.click()
  await p.waitForTimeout(3000)
}
await p.waitForTimeout(2000)
const bar = await p.evaluate(()=>{
  const el=document.querySelector('[data-testid="page-workflow-bar"]')
  if(!el) return {found:false}
  const btns=[...el.querySelectorAll('button')].map(b=>b.textContent.trim())
  return {found:true, buttons:btns}
})
console.log('workflow-bar:', JSON.stringify(bar))
console.log('pageerrors:', errs.length, JSON.stringify(errs.slice(0,3)))
await p.screenshot({path:'work/authoring-truth/0093/studio-topbar.png'})
await b.close()
