// Probe: how does State-B multi-select from the composition PIVOT behave?
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
const region = () => page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
const R = { steps: [] }
const log = (label, extra = {}) => R.steps.push({ label, ...extra })

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(5000)

// Enumerate every panel's view-toggle buttons
R.panelToggles = await page.evaluate(() => Array.from(document.querySelectorAll('.panel')).map((p, i) => ({
  i, title: (p.querySelector('[class*="title"],h2,h3')?.textContent||'').trim().slice(0,40),
  buttons: Array.from(p.querySelectorAll('button')).map(b => (b.textContent||'').trim().slice(0,14)).filter(Boolean),
})))

// Select region #1 via a map path
await page.evaluate(() => document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({ block:'center' })); await page.waitForTimeout(700)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({ force:true, timeout:5000 }) } catch{}
await page.waitForTimeout(2500)
log('after map-click #1', { region: await region() })

// Select region #2 via a different map path
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(7).click({ force:true, timeout:5000 }) } catch{}
await page.waitForTimeout(2500)
log('after map-click #2', { region: await region() })

// Now make EVERY panel that has a table-view toggle switch to table, so the pivot shows
await page.evaluate(() => {
  document.querySelectorAll('.panel').forEach(p => {
    const btn = Array.from(p.querySelectorAll('button')).find(b => /ცხრილ|table/i.test(b.textContent||''))
    if (btn) btn.click()
  })
})
await page.waitForTimeout(2500)

// Find pivots with selectable region columns
R.pivotsNow = await page.evaluate(() => Array.from(document.querySelectorAll('table')).map((t,i) => {
  const sel = Array.from(t.querySelectorAll('th.data-table__col--selectable'))
  return {
    i, visible: t.offsetParent !== null,
    panelTitle: (t.closest('.panel')?.querySelector('[class*="title"],h2,h3')?.textContent||'').trim().slice(0,40),
    selectableCols: sel.map(th => ({ txt:(th.textContent||'').trim().slice(0,16), pressed: th.getAttribute('aria-pressed') })),
  }
}).filter(x => x.selectableCols.length))

// Click the SECOND selectable region column header → expect toggle (deselect)
R.clickResult = await page.evaluate(() => {
  const cols = Array.from(document.querySelectorAll('th.data-table__col--selectable'))
  if (cols.length < 2) return { found: cols.length, note: 'fewer than 2 selectable cols' }
  const before = new URLSearchParams(location.search).get('region') || ''
  cols[1].click()
  return { found: cols.length, before, clickedText: (cols[1].textContent||'').trim().slice(0,16) }
})
await page.waitForTimeout(2000)
log('after pivot col click (toggle off?)', { region: await region(), clickResult: R.clickResult })

// Click it again → re-add
R.reclick = await page.evaluate(() => {
  const cols = Array.from(document.querySelectorAll('th.data-table__col--selectable'))
  const target = cols.find(c => c.getAttribute('aria-pressed') === 'false') || cols[cols.length-1]
  if (!target) return { note: 'no target' }
  target.click(); return { clickedText: (target.textContent||'').trim().slice(0,16) }
})
await page.waitForTimeout(2000)
log('after pivot col re-click (re-add?)', { region: await region(), reclick: R.reclick })

R.errs = errs
await page.screenshot({ path: OUT + '/probe-pivot.png', fullPage: true })
writeFileSync(OUT + '/_probe.json', JSON.stringify(R, null, 1))
console.log(JSON.stringify(R, null, 1))
await browser.close()
