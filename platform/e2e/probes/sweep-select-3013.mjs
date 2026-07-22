// Full sweep: click EVERY node element, report which selects + whether the RIGHT inspector opens its contract.
import { chromium } from '@playwright/test'
const URL='http://192.168.1.199:3013/'
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:1000}})
try{
  await p.goto(URL,{waitUntil:'networkidle',timeout:45000}); await p.waitForTimeout(1200)
  const ins=p.locator('input')
  if(await ins.count()>=2){await ins.nth(0).fill('admin');await p.locator('input[type=password]').first().fill('dev_admin_pw_123');await p.getByRole('button').first().click();await p.waitForTimeout(1500)}
  await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(5000)
  // The RIGHT inspector = the aside/panel containing "ინსპექტორი"
  const rightPanel = p.locator('aside').last()
  const anchors = p.locator('[data-part-node-id]')
  const n = await anchors.count()
  const out=[]
  for(let i=0;i<n;i++){
    const el=anchors.nth(i)
    const type=await el.getAttribute('data-part-node-type').catch(()=>null)
    let ok=false, crumb='', nFields=0, txt=''
    try{
      await el.scrollIntoViewIfNeeded({timeout:1500}).catch(()=>{})
      await el.click({timeout:2500,force:true}); ok=true; await p.waitForTimeout(400)
      txt=(await rightPanel.innerText().catch(()=>'')).replace(/\n+/g,' ').slice(0,120)
      // crumb = the breadcrumb chip (e.g. "kpi-strip")
      crumb=(await rightPanel.locator('button,[class*="crumb"],[class*="Crumb"]').first().innerText().catch(()=>'')).slice(0,40)
      // count form controls in the right inspector = how much of its contract is authorable
      nFields=await rightPanel.locator('input,select,textarea,[role="combobox"]').count().catch(()=>0)
    }catch(e){ txt='CLICK-FAIL' }
    out.push({ i, type, sel:ok, crumb, inspectorControls:nFields })
  }
  // also: are chrome regions present at all?
  const chromeFrames = await p.locator('[data-canvas-chrome-slot]').count()
  console.log(JSON.stringify({ totalNodes:n, chromeFramesOnCanvas:chromeFrames, sweep:out },null,2))
}catch(e){ console.log(JSON.stringify({fatal:String(e)})) } finally{ await b.close() }
