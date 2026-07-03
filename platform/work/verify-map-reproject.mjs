// Verify fix/map-reproject-on-show (4d177a2) LIVE on prod :3002 after docker-cp hot-swap.
// Failing path: /ka/regional -> composition/map panel TABLE view -> click a row
// (select region while map hidden) -> toggle back to MAP -> must render REAL region paths.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/map-reproject'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport:{width:1440,height:1600}, locale:'ka-GE' })
const page = await ctx.newPage()
const errs=[]; page.on('pageerror',e=>errs.push('PE '+String(e.message).slice(0,100)))
const bad = d => !d || /^M0 0z?$/i.test((d||'').trim()) || (d||'').trim().length<12
const probe = () => page.evaluate(() => {
  const c = document.querySelector('#geo-map .leaflet-container')
  if(!c) return {present:false}
  const paths=[...c.querySelectorAll('path.leaflet-interactive')]
  const badf=d=>!d||/^M0 0z?$/i.test((d||'').trim())||(d||'').trim().length<12
  const ds=paths.map(p=>p.getAttribute('d')||'')
  const r=c.getBoundingClientRect()
  const svg=c.querySelector('.leaflet-overlay-pane svg')
  let bbox={w:0,h:0}
  try{ const b=svg?.getBBox?.(); if(b) bbox={w:Math.round(b.width),h:Math.round(b.height)} }catch{}
  // colour census on real paths
  const fills={}
  paths.forEach(p=>{ if(!badf(p.getAttribute('d'))){ const f=(p.getAttribute('fill')||'').toLowerCase(); fills[f]=(fills[f]||0)+1 } })
  const crash = !!document.querySelector('[class*="error" i], [class*="crash" i]') &&
                /failed to load|invalid latlng|retry/i.test(document.body.innerText||'')
  return {
    present:true,
    real:ds.filter(d=>!badf(d)).length,
    degen:ds.filter(badf).length,
    contW:Math.round(r.width), contH:Math.round(r.height),
    overlayBBox:bbox,
    sampleD:(ds.find(d=>!badf(d))||ds[0]||'').slice(0,48),
    fills, crash
  }
})
const clickToggle = rs => page.evaluate(s=>{ const rx=new RegExp(s,'i'); const b=[...document.querySelectorAll('#geo-map button')].find(x=>rx.test((x.textContent||'').trim())); if(b){b.click();return true} return false }, rs)
const S=ms=>page.waitForTimeout(ms)
const R={ servedHash:null, iterations:[] }

// which bundle are we actually running?
R.servedHash = await page.evaluate(async b=>{ const h=await (await fetch(b+'/',{cache:'no-store'})).text(); return (h.match(/assets\/index-[A-Za-z0-9_-]+\.js/)||[])[0]||null }, BASE).catch(()=>null)

// ---- CONTROL: plain table->map toggle, NO select ----
await page.goto(BASE+'/ka/regional',{waitUntil:'networkidle',timeout:45000}); await S(5000)
await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(1200)
R.baseline = await probe()
await clickToggle('ცხრილ|table'); await S(1600)
await clickToggle('რუქა|map'); await S(2500)
R.control_plainToggle = await probe()

// ---- TARGET: select-while-hidden -> toggle -> map. Run 3 times. ----
for(let i=1;i<=3;i++){
  await page.reload({waitUntil:'networkidle'}); await S(5000)
  await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(1000)
  await clickToggle('ცხრილ|table'); await S(1800)
  const rowIdx = 2+i // vary the selected row across iterations
  await page.evaluate((ri)=>{ const rows=[...document.querySelectorAll('#geo-map tbody tr')]; (rows[ri]?.querySelector('td')||rows[ri])?.click() }, rowIdx); await S(1500)
  const region = await page.evaluate(()=>new URLSearchParams(location.search).get('region')||'')
  await clickToggle('რუქა|map'); await S(2500)
  const m1 = await probe()
  await S(2500)
  const m2 = await probe()
  R.iterations.push({ iter:i, rowIdx, region, at2_5s:m1, at5s:m2 })
  if(i===1){
    await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(600)
    await page.locator('#geo-map').screenshot({ path: OUT+'/01-select-while-hidden-toggle.png' }).catch(()=>{})
    await page.screenshot({ path: OUT+'/01-fullpage.png' }).catch(()=>{})
  }
}
R.errs = errs.slice(0,8)
console.log(JSON.stringify(R,null,1))
await browser.close()
