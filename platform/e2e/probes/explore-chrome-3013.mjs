// Ground-truth: can you REACH + author chrome on :3013? Log in, look, probe.
import { chromium } from '@playwright/test'
const URL = 'http://192.168.1.199:3013/'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1440,height:900} })
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message)))
try {
  await p.goto(URL,{waitUntil:'networkidle',timeout:45000}); await p.waitForTimeout(1200)
  const ins=p.locator('input')
  if(await ins.count()>=2){ await ins.nth(0).fill('admin'); await p.locator('input[type=password]').first().fill('dev_admin_pw_123'); await p.getByRole('button').first().click(); await p.waitForTimeout(1500) }
  await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(5000)
  // What chrome-ish things exist?
  const probe = {
    url: p.url(),
    structuralLiveToggle: await p.getByText(/structural|live|სტრუქტ|ცოცხ/i).count(),
    chromeAnchors: await p.locator('[data-canvas-chrome-slot], [data-part-node-id], header, footer, [class*="chrome"], [class*="Chrome"]').count(),
    topBarButtons: await p.locator('header button, [class*="TopBar"] button, [class*="topbar"] button').allInnerTexts().catch(()=>[]),
    siteOrChromeText: await p.getByText(/site|chrome|ქრომ|საიტ|ჰედერ|header|footer/i).allInnerTexts().catch(()=>[]),
    railIcons: await p.locator('nav button, [class*="ActivityRail"] button, [class*="rail"] button').count(),
    consoleErrs: errs.slice(0,5),
  }
  await p.screenshot({ path:'work/__verify__/chrome-explore.png', fullPage:true })
  console.log(JSON.stringify(probe,null,2))
} catch(e){ console.log(JSON.stringify({fatal:String(e),errs:errs.slice(0,5)})) } finally { await b.close() }
