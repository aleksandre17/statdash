// Composition-batch live verify — PART B: items 4 (range mode sector gate),
// 5 (comparison hbar height), 6 (non-regression).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/composition-batch'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport:{width:1440,height:1600}, locale:'ka-GE' })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion:'reduce' })
const errs=[]; page.on('pageerror',e=>errs.push('PE '+String(e.message).slice(0,120)))
const S=ms=>page.waitForTimeout(ms)
const qp = k => page.evaluate(kk=>new URLSearchParams(location.search).get(kk)||'', k)
const R={}

// controls snapshot: every select + its options, and any labelled sector control
const controls = () => page.evaluate(() => {
  const selects = [...document.querySelectorAll('select')].map(s => ({
    opts: [...s.options].map(o=>(o.textContent||'').trim().slice(0,14)).slice(0,8),
    val: (s.options[s.selectedIndex]?.textContent||'').trim().slice(0,14),
  }))
  // any control whose options include sector-like Georgian labels (დარგ / sector)
  const sectorish = selects.filter(s => s.opts.some(o=>/დარგ|სექტ|sector|ყველა|სოფლ|მრეწ/i.test(o)) )
  return { selectCount: selects.length, selects, sectorSelectCount: sectorish.length }
})

// ─────────────── ITEM 4: RANGE MODE — no sector selector + clears sector ─────
await page.goto(BASE + '/ka/regional?region=R5&mode=range', { waitUntil:'networkidle', timeout:45000 }); await S(4500)
R.item4_rangeControls = await controls()
// now year mode with a sector set → switch to range in UI → sector cleared?
await page.goto(BASE + '/ka/regional?region=R5&mode=year&sector=SEC01', { waitUntil:'networkidle', timeout:45000 }); await S(4000)
R.item4_yearControls = await controls()
R.item4_sectorBefore = await qp('sector'); R.item4_modeBefore = await qp('mode')
// find and click the range-mode toggle button (ნლიური=year / დინამიკა=range) — top right
R.item4_clickedRange = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button,a')].find(x=>/დინამიკა|range/i.test((x.textContent||'').trim()) && (x.textContent||'').trim().length<20)
  if (b){ b.click(); return (b.textContent||'').trim().slice(0,16) } return null
})
await S(3000)
R.item4_sectorAfter = await qp('sector'); R.item4_modeAfter = await qp('mode')
R.item4_rangeControlsAfterSwitch = await controls()

// ─────────────── ITEM 5: comparison hbar height ~560 (chart view) ───────────
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await S(4500)
await page.evaluate(()=>document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({block:'center'})); await S(700)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({force:true,timeout:5000}) } catch{}
await S(2500)
// ensure the comparison section is in CHART (დიაგრამა) view
await page.evaluate(() => {
  const secs=[...document.querySelectorAll('section,div')].filter(s=>/regional comparison|რეგიონული შედარ|comparison/i.test(s.textContent||''))
  // click the დიაგრამა button of the comparison section
  const btns=[...document.querySelectorAll('button.section__view-btn')].filter(b=>/დიაგრამა|chart/i.test(b.textContent||''))
  btns.forEach(b=>{ const near=(b.closest('section,div')?.textContent||''); if(/comparison|შედარ/i.test(near)) b.click() })
})
await S(2500)
R.item5_apex = await page.evaluate(() => [...document.querySelectorAll('.apexcharts-canvas')].map(c=>{
  const r=c.getBoundingClientRect()
  // nearest heading text
  let el=c,head=''; for(let k=0;k<8&&el;k++){el=el.parentElement; const h=el?.querySelector?.('[class*="title"],h2,h3'); if(h){head=(h.textContent||'').trim().slice(0,40);break}}
  const bar=c.querySelector('path.apexcharts-bar-area'); let horiz=null,bh=0
  if(bar){const b=bar.getBoundingClientRect(); horiz=b.width>b.height; bh=Math.round(b.height)}
  return { head, canvasH:Math.round(r.height), canvasW:Math.round(r.width), horiz, barH:bh }
}))
await page.evaluate(()=>{ const b=[...document.querySelectorAll('*')].find(e=>/regional comparison|შედარ/i.test(e.textContent||'')&&e.querySelector?.('.apexcharts-canvas')); b?.scrollIntoView({block:'center'}) }); await S(800)
await page.screenshot({ path: OUT+'/05-comparison-hbar.png', fullPage:true })

// ─────────────── ITEM 6: NON-REGRESSION ────────────────────────────────────
R.item6 = {}
// FiraGO fonts loaded + body font-family
R.item6.fonts = await page.evaluate(async () => {
  await document.fonts.ready
  const want=[400,500,600,700]
  const loaded = want.map(w=>({ w, ok: document.fonts.check(`${w} 16px FiraGO`) }))
  const bodyFF = getComputedStyle(document.body).fontFamily
  return { loaded, bodyFF: bodyFF.slice(0,60) }
})
// State-B distinct series colours (2 regions) — apex series fills
R.item6.seriesFills = await page.evaluate(() => {
  const c=[...document.querySelectorAll('.apexcharts-canvas')].find(x=>x.querySelectorAll('.apexcharts-series').length>1)
  if(!c) return { note:'no multi-series apex' }
  const fills=[...new Set([...c.querySelectorAll('.apexcharts-series path.apexcharts-bar-area,[class*="apexcharts-series"] path')].map(p=>(p.getAttribute('fill')||'').toLowerCase()).filter(Boolean))]
  return { distinct: fills.slice(0,8) }
})
// html lang flip ka -> en
R.item6.langKa = await page.evaluate(()=>document.documentElement.lang)
await page.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(x=>/^ENG$|english/i.test((x.textContent||'').trim())); b?.click() }); await S(2500)
R.item6.langAfterToggle = await page.evaluate(()=>document.documentElement.lang)
R.item6.urlAfterToggle = await page.evaluate(()=>location.pathname)
// /ka/accounts scroll
await page.goto(BASE+'/ka/accounts', { waitUntil:'networkidle', timeout:45000 }); await S(4000)
R.item6.accountsScroll = await page.evaluate(() => {
  const el=[...document.querySelectorAll('*')].find(e=>{ const cs=getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight>e.clientHeight+40 })
  if(!el) return { scrollable:false }
  const before=el.scrollTop; el.scrollTop=250; const after=el.scrollTop
  return { scrollable:true, scrollH:el.scrollHeight, clientH:el.clientHeight, moved: after-before }
})

R.errs = errs.slice(0,8)
writeFileSync(OUT+'/_verifyB.json', JSON.stringify(R,null,1))
console.log(JSON.stringify(R,null,1))
await browser.close()
