// Non-regression: d3-geo choropleth MAP survives the historically-blanking path
// (table view -> select a region while map HIDDEN -> toggle back to map -> real regions).
// d3-geo selectors: #geo-map svg.geo-map__svg path.geo-map__region. occupied=red #dc2626,
// selected=distinct highlight hue. DOM metrics lie for the map -> also screenshot to READ.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 }, locale: 'ka-GE' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PE ' + String(e.message).slice(0, 120)))
const S = ms => page.waitForTimeout(ms)
const region = () => page.evaluate(() => new URLSearchParams(location.search).get('region') || '')

const mapProbe = () => page.evaluate(() => {
  const svg = document.querySelector('#geo-map svg.geo-map__svg') || document.querySelector('#geo-map svg')
  const crash = !!Array.from(document.querySelectorAll('#geo-map *')).find(e => /Failed to load|Invalid|crashed/i.test(e.textContent||'')) || !!document.querySelector('#geo-map [class*="error" i]')
  if (!svg) return { present:false, crash }
  const paths = [...svg.querySelectorAll('path.geo-map__region')]
  const bad = d => !d || /^M0 0z?$/i.test((d||'').trim()) || (d||'').trim().length < 12
  const ds = paths.map(p => p.getAttribute('d')||'')
  const fills = paths.map(p => (getComputedStyle(p).fill||p.getAttribute('fill')||'').toLowerCase())
  return { present:true, crash, count: paths.length, real: ds.filter(d=>!bad(d)).length, degen: ds.filter(bad).length,
    occupiedRed: fills.filter(f=>/#dc2626|rgb\(220, 38, 38\)/.test(f)).length,
    distinctFills: [...new Set(fills)].length }
})
const clickToggle = (re) => page.evaluate((rs) => {
  const rx = new RegExp(rs,'i')
  const b = [...document.querySelectorAll('#geo-map button, button.section__view-btn')].find(x=>rx.test((x.textContent||'').trim()))
  if (b){ b.click(); return (b.textContent||'').trim() } return null
}, re)

const R = { errs: [] }
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await S(4500)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block:'center' })); await S(1000)
R.baseline = await mapProbe()

// the failing path x3: toggle to table -> select a row while map hidden -> toggle back to map
for (let i=0;i<3;i++){
  R['toTable'+i] = await clickToggle('ცხრილ|table'); await S(1500)
  await page.evaluate((idx) => { const rows=[...document.querySelectorAll('#geo-map tbody tr')]; if(rows.length){ (rows[(idx+1)%rows.length].querySelector('td')||rows[0]).click() } }, i); await S(1300)
  R['toMap'+i] = await clickToggle('რუქა|map'); await S(2200)
}
R.regionAfter = await region()
R.afterStorm = await mapProbe()
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block:'center' })); await S(800)
await page.locator('#geo-map').screenshot({ path: OUT + '/nonreg-map-after-hidden-select.png' }).catch(async()=>{ await page.screenshot({ path: OUT+'/nonreg-map-after-hidden-select.png' }) })

// map-click select from fresh map
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await S(4000)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block:'center' })); await S(800)
R.beforeClick = await region()
await page.evaluate(() => document.querySelector('#geo-map svg.geo-map__svg path.geo-map__region[role="button"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))); await S(2000)
R.afterClick = await region()
R.afterClickMap = await mapProbe()
await page.locator('#geo-map').screenshot({ path: OUT + '/nonreg-map-click-select.png' }).catch(()=>{})

R.errs = errs.slice(0,6)
console.log(JSON.stringify(R, null, 1))
await browser.close()
