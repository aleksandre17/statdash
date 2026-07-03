// Composition-batch live verify — PART A: items 1 (map recovery), 2 (pivot
// multi-select), 3 (State-A SimpleTable row select). → http://192.168.1.199:3002
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/composition-batch'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 }, locale: 'ka-GE' })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
const errs = []
page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE '+m.text().slice(0,150)) })
page.on('pageerror', e => errs.push('PAGEERROR '+String(e.message).slice(0,150)))
const region = () => page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
const settle = ms => page.waitForTimeout(ms)
const R = {}

// map + colour probe (scoped to the geograph #geo-map)
const mapProbe = () => page.evaluate(() => {
  const c = document.querySelector('#geo-map .leaflet-container')
  const crashCard = !!Array.from(document.querySelectorAll('#geo-map *')).find(e => /Failed to load component|Invalid LatLng/i.test(e.textContent||'')) ||
                    !!document.querySelector('#geo-map [class*="error"],#geo-map [class*="crash"]')
  if (!c) return { present:false, crashCard }
  const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
  const bad = d => !d || /^M0 0z?$/i.test((d||'').trim()) || (d||'').trim().length < 12
  const ds = paths.map(p => p.getAttribute('d')||'')
  const fills = paths.map(p => (p.getAttribute('fill')||'').toLowerCase())
  return {
    present:true, crashCard,
    pathCount: paths.length,
    real: ds.filter(d=>!bad(d)).length,
    degen: ds.filter(bad).length,
    occupiedRed: fills.filter(f=>f==='#dc2626').length,
    selectedAmber: fills.filter(f=>/#e8a33d|#e8a83|amber|#e0a|#eab/i.test(f)).length,
    distinctFills: [...new Set(fills)].slice(0,12),
  }
})
const clickInGeoMap = (reStr) => page.evaluate((rs) => {
  const rx = new RegExp(rs,'i')
  const b = Array.from(document.querySelectorAll('#geo-map button')).find(x=>rx.test((x.textContent||'').trim()))
  if (b){ b.click(); return true } return false
}, reStr)

// ─────────────────────────── ITEM 1: MAP RECOVERY ───────────────────────────
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await settle(5000)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block:'center' })); await settle(1200)
R.item1_baseline = await mapProbe()
// storm the exact failing path several times: table → select row (map hidden) → map
for (let i=0;i<3;i++){
  await clickInGeoMap('ცხრილ|table'); await settle(1600)
  await page.evaluate((idx) => { const rows=[...document.querySelectorAll('#geo-map tbody tr')]; if(rows.length){ (rows[(idx+1)%rows.length].querySelector('td')||rows[0]).click() } }, i); await settle(1400)
  await clickInGeoMap('რუქა|map'); await settle(2600)
}
R.item1_afterStorm = await mapProbe()
R.item1_regionAfter = await region()
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block:'center' })); await settle(1000)
await page.locator('#geo-map').screenshot({ path: OUT + '/01-map-recovery.png' }).catch(async()=>{ await page.screenshot({ path: OUT+'/01-map-recovery.png' }) })

// ─────────────────────── ITEM 2: PIVOT MULTI-SELECT ─────────────────────────
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await settle(5000)
await page.evaluate(() => document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({ block:'center' })); await settle(800)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({ force:true, timeout:5000 }) } catch{}
await settle(2200); R.item2_regionAfter1 = await region()
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(7).click({ force:true, timeout:5000 }) } catch{}
await settle(2200); R.item2_regionAfter2 = await region()   // expect 2 regions
// reveal the composition section's TABLE view (section__view-btn, not in #geo-map)
await page.evaluate(() => Array.from(document.querySelectorAll('button.section__view-btn'))
  .filter(b => /ცხრილ|table/i.test(b.textContent||'')).forEach(b => b.click()))
await settle(2200)
R.item2_pivotCols = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table')].find(x => x.querySelector('th.data-table__col--selectable'))
  if (!t) return null
  return {
    visible: t.offsetParent !== null,
    bodyRows: t.querySelectorAll('tbody tr').length,
    selectable: [...t.querySelectorAll('th.data-table__col--selectable')].map(th => ({ txt:(th.textContent||'').trim().slice(0,16), role: th.getAttribute('role'), pressed: th.getAttribute('aria-pressed') })),
  }
})
// scroll composition into view + screenshot the 2-region stacked state
await page.evaluate(() => { const t=[...document.querySelectorAll('table')].find(x=>x.querySelector('th.data-table__col--selectable')); t?.scrollIntoView({ block:'center' }) }); await settle(1000)
await page.screenshot({ path: OUT + '/02a-pivot-2regions.png', fullPage: true })
// click the FIRST selectable region column header → expect toggle OFF (2 → 1)
R.item2_click = await page.evaluate(() => {
  const cols = [...document.querySelectorAll('th.data-table__col--selectable')]
  const before = new URLSearchParams(location.search).get('region') || ''
  if (!cols.length) return { note:'no selectable cols', before }
  const txt = (cols[0].textContent||'').trim().slice(0,16)
  cols[0].click(); return { before, clickedCol: txt, colCount: cols.length }
})
await settle(2200); R.item2_regionAfterColClick = await region()
await page.evaluate(() => { const t=[...document.querySelectorAll('table')].find(x=>x.querySelector('th.data-table__col--selectable')); t?.scrollIntoView({ block:'center' }) }); await settle(800)
await page.screenshot({ path: OUT + '/02b-pivot-after-deselect.png', fullPage: true })
// Can we ADD a NEW region from the pivot? (unselected column present?)
R.item2_hasUnselectedCol = await page.evaluate(() => [...document.querySelectorAll('th.data-table__col--selectable')].some(th => th.getAttribute('aria-pressed')==='false'))
// ALT add-path: geograph SimpleTable row add in State B
await clickInGeoMap('ცხრილ|table'); await settle(1500)
R.item2_regionBeforeRowAdd = await region()
await page.evaluate(() => { const rows=[...document.querySelectorAll('#geo-map tbody tr')]; const r=rows[9]||rows[rows.length-1]; (r?.querySelector('td')||r)?.click() }); await settle(1800)
R.item2_regionAfterRowAdd = await region()

// ─────────────────── ITEM 3: STATE-A SIMPLE TABLE ROW SELECT ────────────────
await page.goto(BASE + '/ka/regional', { waitUntil:'networkidle', timeout:45000 }); await settle(4500)
R.item3_regionBefore = await region()
await clickInGeoMap('ცხრილ|table'); await settle(1600)
await page.evaluate(() => { const rows=[...document.querySelectorAll('#geo-map tbody tr')]; (rows[2]?.querySelector('td')||rows[2])?.click() }); await settle(1800)
R.item3_regionAfter = await region()

R.errors = errs
writeFileSync(OUT + '/_verifyA.json', JSON.stringify(R, null, 1))
console.log(JSON.stringify(R, null, 1))
await browser.close()
