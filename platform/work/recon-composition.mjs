// Recon v2: State-B pivot + selectable col headers, full page structure.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/composition-batch'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1600 }, locale: 'ka-GE' })).newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)))
const clickBtn = ({ root, reStr }) => { const rx = new RegExp(reStr, 'i'); const b = Array.from(document.querySelectorAll(root + ' button')).find(x => rx.test((x.textContent||'').trim())); if (b) { b.click(); return true } return false }
const R = {}
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(5000)
// scroll through full page to trigger any lazy panels
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } window.scrollTo(0,0) })
await page.waitForTimeout(1500)

// Select region via map path click → State B
await page.evaluate(() => document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(800)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({ force: true, timeout: 5000 }) } catch (e) { R.mapClickErr = String(e).slice(0,100) }
await page.waitForTimeout(3000)
R.regionAfter1 = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')

// Toggle the geograph (#geo-map) to TABLE view — State B → pivot expected
R.toggled = await page.evaluate(clickBtn, { root: '#geo-map', reStr: 'ცხრილ|table' })
await page.waitForTimeout(2500)

// Dump EVERY table on the page: caption/first-header + selectable col headers
R.tables = await page.evaluate(() => Array.from(document.querySelectorAll('table')).map((t, i) => {
  const container = t.closest('#geo-map') ? '#geo-map' : (t.closest('.panel') ? '.panel' : 'other')
  const headTxts = Array.from(t.querySelectorAll('thead th')).map(th => (th.textContent||'').trim().slice(0,16))
  const selCols = Array.from(t.querySelectorAll('th.data-table__col--selectable, th[role="button"]'))
  const visible = t.offsetParent !== null && t.getBoundingClientRect().height > 5
  return {
    i, container, visible,
    rowsBody: t.querySelectorAll('tbody tr').length,
    headTxts: headTxts.slice(0, 14),
    selectableCols: selCols.map(th => ({ txt: (th.textContent||'').trim().slice(0,16), cls: th.className, pressed: th.getAttribute('aria-pressed') })),
  }
}))
// full text of any element mentioning selectable class
R.selectableClassCount = await page.evaluate(() => document.querySelectorAll('.data-table__col--selectable').length)
R.errs = errs
writeFileSync(OUT + '/_recon2.json', JSON.stringify(R, null, 1))
await page.screenshot({ path: OUT + '/recon2-stateB-table.png', fullPage: true })
console.log(JSON.stringify(R, null, 1))
await browser.close()
