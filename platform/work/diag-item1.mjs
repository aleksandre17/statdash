// Item-1 diagnostic: single clean cycle, timed re-measures, container dims.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/composition-batch'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport:{width:1440,height:1600}, locale:'ka-GE' })).newPage()
const errs=[]; page.on('pageerror',e=>errs.push('PE '+String(e.message).slice(0,90)))
const probe = () => page.evaluate(() => {
  const c = document.querySelector('#geo-map .leaflet-container')
  if(!c) return {present:false}
  const paths=[...c.querySelectorAll('path.leaflet-interactive')]
  const bad=d=>!d||/^M0 0z?$/i.test((d||'').trim())||(d||'').trim().length<12
  const ds=paths.map(p=>p.getAttribute('d')||'')
  const r=c.getBoundingClientRect()
  return { real:ds.filter(d=>!bad(d)).length, degen:ds.filter(bad).length, contW:Math.round(r.width), contH:Math.round(r.height), mapPanes: c.querySelectorAll('.leaflet-overlay-pane svg').length, sampleD: (ds[0]||'').slice(0,40) }
})
const clickGeo = rs => page.evaluate(s=>{ const rx=new RegExp(s,'i'); const b=[...document.querySelectorAll('#geo-map button')].find(x=>rx.test((x.textContent||'').trim())); if(b){b.click();return true} return false }, rs)
const S=ms=>page.waitForTimeout(ms)
const R={}
await page.goto(BASE+'/ka/regional',{waitUntil:'networkidle',timeout:45000}); await S(5000)
await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(1200)
R.baseline = await probe()

// CONTROL: plain toggle table->map, NO select
await clickGeo('ცხრილ|table'); await S(1600)
await clickGeo('რუქა|map'); await S(2500)
R.plainToggle = await probe()

// TARGET: table -> select ONE row (map hidden) -> map, measured over time
await page.reload({waitUntil:'networkidle'}); await S(5000)
await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(1000)
await clickGeo('ცხრილ|table'); await S(1800)
await page.evaluate(()=>{ const rows=[...document.querySelectorAll('#geo-map tbody tr')]; (rows[3]?.querySelector('td')||rows[3])?.click() }); await S(1500)
R.regionSel = await page.evaluate(()=>new URLSearchParams(location.search).get('region')||'')
await clickGeo('რუქა|map')
await S(1500); R.at1_5s = await probe()
await S(2500); R.at4s   = await probe()
await S(3000); R.at7s   = await probe()
// nudge: real viewport resize
await page.setViewportSize({width:1441,height:1600}); await S(1000); await page.setViewportSize({width:1440,height:1600}); await S(1500)
R.afterResizeNudge = await probe()
R.errs = errs.slice(0,6)
await page.evaluate(()=>document.querySelector('#geo-map')?.scrollIntoView({block:'center'})); await S(800)
await page.locator('#geo-map').screenshot({ path: OUT+'/diag-item1-map.png' }).catch(()=>{})
console.log(JSON.stringify(R,null,1))
await browser.close()
