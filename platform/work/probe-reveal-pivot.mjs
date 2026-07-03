// Probe: locate the composition pivot's view-toggle + literal 1-region pivot columns.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1600 }, locale: 'ka-GE' })).newPage()
const R = {}
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(5000)
// select 1 region
await page.evaluate(() => document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({ block:'center' })); await page.waitForTimeout(600)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({ force:true, timeout:5000 }) } catch{}
await page.waitForTimeout(2500)
R.region1 = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')

// enumerate ALL buttons page-wide with ancestry hints
R.allToggleButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
  .filter(b => /ცხრილ|table|რუქა|map|დიაგრ|chart|გრაფ/i.test(b.textContent||''))
  .map(b => {
    // nearest heading ancestor text
    let el = b, head = ''
    for (let k=0;k<6 && el;k++){ el = el.parentElement; const h = el?.querySelector?.('[class*="title"],h2,h3'); if (h){ head=(h.textContent||'').trim().slice(0,36); break } }
    return { txt:(b.textContent||'').trim().slice(0,14), inGeoMap: !!b.closest('#geo-map'), nearHead: head, cls: b.className.slice(0,40) }
  }))

// The composition pivot lives outside #geo-map. Click every table-toggle NOT in #geo-map.
await page.evaluate(() => Array.from(document.querySelectorAll('button'))
  .filter(b => /ცხრილ|table/i.test(b.textContent||'') && !b.closest('#geo-map'))
  .forEach(b => b.click()))
await page.waitForTimeout(2000)

// Now dump the composition pivot columns (ALL th, plus selectable) with visibility
R.pivotLiteral = await page.evaluate(() => Array.from(document.querySelectorAll('table'))
  .map((t,i) => ({
    i, visible: t.offsetParent !== null && t.getBoundingClientRect().height>5,
    allHeadCols: Array.from(t.querySelectorAll('thead th')).map(th=>(th.textContent||'').trim().slice(0,14)),
    selectable: Array.from(t.querySelectorAll('th.data-table__col--selectable')).map(th=>({txt:(th.textContent||'').trim().slice(0,14),pressed:th.getAttribute('aria-pressed')})),
    bodyRows: t.querySelectorAll('tbody tr').length,
  }))
  .filter(x => x.selectable.length || x.allHeadCols.some(c=>/რეგიონ|region/i.test(c)===false && x.bodyRows>3)))
console.log(JSON.stringify(R, null, 1))
await browser.close()
