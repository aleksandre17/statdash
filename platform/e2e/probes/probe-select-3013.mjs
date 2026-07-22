// GROUND TRUTH: can you actually SELECT + author node elements on :3013?
import { chromium } from '@playwright/test'
const URL='http://192.168.1.199:3013/'
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}})
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message)))
const log=[]
try{
  await p.goto(URL,{waitUntil:'networkidle',timeout:45000}); await p.waitForTimeout(1200)
  const ins=p.locator('input')
  if(await ins.count()>=2){await ins.nth(0).fill('admin');await p.locator('input[type=password]').first().fill('dev_admin_pw_123');await p.getByRole('button').first().click();await p.waitForTimeout(1500)}
  await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(5000)

  // How many selectable node anchors exist on the canvas?
  const nodeAnchors = p.locator('[data-part-node-id]')
  const nNodes = await nodeAnchors.count()
  log.push({ nodeAnchorsOnCanvas: nNodes })

  // Dock text BEFORE any selection (should be page params)
  const dockBefore = (await p.locator('aside, [class*="RightDock"], [class*="Dock"], [class*="inspector"], [class*="Inspector"]').first().innerText().catch(()=>'')).slice(0,200)
  log.push({ dockBefore })

  // Try to click the FIRST few node anchors and see if the dock switches to element scope + which facet sections appear
  const facetWords = /style|სტილ|data|მონაცემ|interaction|ინტერაქ|visib|ხილვად|chrome|ქრომ/i
  for(let i=0;i<Math.min(nNodes,4);i++){
    const el = nodeAnchors.nth(i)
    const type = await el.getAttribute('data-part-node-type').catch(()=>null)
    let clicked=false, dockAfter='', hasFacets=false, hasFrame=false
    try{
      await el.scrollIntoViewIfNeeded({timeout:2000}); await el.click({timeout:3000,force:true}); clicked=true
      await p.waitForTimeout(700)
      hasFrame = await p.locator('[class*="selected"], [data-selected], [class*="Overlay"] [class*="frame"]').count()>0
      dockAfter = (await p.locator('aside, [class*="RightDock"], [class*="Dock"], [class*="Inspector"]').first().innerText().catch(()=>'')).slice(0,260)
      hasFacets = facetWords.test(dockAfter)
    }catch(e){ dockAfter='CLICK-FAIL:'+String(e.message).slice(0,60) }
    log.push({ i, type, clicked, hasSelectedFrame:hasFrame, dockHasFacetSection:hasFacets, dockAfter })
    if(i===0) await p.screenshot({path:'work/__verify__/select-node-0.png'})
  }
  console.log(JSON.stringify({ pageErrs:errs.slice(0,4), steps:log },null,2))
}catch(e){ console.log(JSON.stringify({fatal:String(e),steps:log})) } finally{ await b.close() }
