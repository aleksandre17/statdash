// Focused A verify: map recovery after row-select-while-HIDDEN, on the real panel
// #geo-map ("GDP — by region"), toggle buttons რუქა (map) / ცხრილი (table).
// The bug: selecting a region while the map is display:none remounts <GeoJSON>
// against a 0x0 box → every path d="M0 0" (blank). RepairOnShow must re-project
// on toggle-back → paths REAL, overlay bbox non-zero. Storm it 3x.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/regression-fix'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })).newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
let errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)))

const H = () => {
  window.__m = {}
  window.__m.mapState = () => {
    const c = document.querySelector('#geo-map .leaflet-container')
    if (!c) return { present: false, mapVisible: false }
    const rect = c.getBoundingClientRect()
    const vis = rect.width > 0 && rect.height > 0 && c.offsetParent !== null
    const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
    const bad = d => !d || /^M0 0z?$/i.test(d.trim()) || d.trim().length < 12
    const ds = paths.map(p => p.getAttribute('d') || '')
    let bbox = null
    try { const g = c.querySelector('.leaflet-overlay-pane svg g') || c.querySelector('.leaflet-overlay-pane svg'); if (g?.getBBox) { const b = g.getBBox(); bbox = { w: Math.round(b.width), h: Math.round(b.height) } } } catch {}
    return { present: true, mapVisible: vis, containerRect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      pathCount: paths.length, realCount: ds.filter(d => !bad(d)).length, degenerateCount: ds.filter(bad).length,
      overlayBBox: bbox, sampleReal: ds.filter(d => !bad(d)).slice(0, 2).map(d => d.slice(0, 64)), sampleDegenerate: ds.filter(bad).slice(0, 5) }
  }
  window.__m.clickToggle = (reStr) => {
    const rx = new RegExp(reStr, 'i')
    const btns = Array.from(document.querySelectorAll('#geo-map .panel__view-btn, #geo-map button'))
    const b = btns.find(x => rx.test((x.textContent || '').trim()) || rx.test(x.getAttribute('aria-label') || ''))
    if (b) { const active = /active/.test(b.className); b.click(); return { clicked: true, label: (b.textContent || '').trim(), wasActive: active } }
    return { clicked: false, seen: btns.map(x => (x.textContent || '').trim()) }
  }
  window.__m.tableVisible = () => {
    const t = document.querySelector('#geo-map table')
    if (!t) return { hasTable: false }
    const r = t.getBoundingClientRect()
    return { hasTable: true, tableVisible: r.width > 0 && r.height > 0 && t.offsetParent !== null, rows: document.querySelectorAll('#geo-map tbody tr').length }
  }
  window.__m.clickRow = (i) => {
    const rows = Array.from(document.querySelectorAll('#geo-map tbody tr'))
    if (!rows.length) return { rows: 0 }
    const r = rows[i % rows.length]
    const label = (r.textContent || '').trim().slice(0, 40)
    ;(r.querySelector('a,button,[role="button"],td') || r).click()
    return { rows: rows.length, idx: i % rows.length, label }
  }
  window.__m.regionParam = () => new URLSearchParams(location.search).get('region') || ''
}
async function inj() { await page.evaluate(H) }
const settle = (ms = 2500) => page.waitForTimeout(ms)
const R = { storm: [] }
async function shot(path) {
  const clip = await page.evaluate(() => { const e = document.querySelector('#geo-map'); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return null; return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(1440 - Math.max(0, r.x), r.width), height: Math.min(1000 - Math.max(0, r.y), r.height) } })
  if (clip) await page.screenshot({ path, clip }); else await page.screenshot({ path, fullPage: true })
}

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message))
await settle(5000); await inj()
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1500)
R.baseline = await page.evaluate(() => window.__m.mapState())
await shot(OUT + '/A0-baseline-map.png')

for (let iter = 0; iter < 3; iter++) {
  errors = []; await inj()
  // 1) to TABLE (hide map)
  const toTable = await page.evaluate(() => window.__m.clickToggle('ცხრილ|table'))
  await settle(2200); await inj()
  const tableVis = await page.evaluate(() => window.__m.tableVisible())
  const mapHidden = await page.evaluate(() => window.__m.mapState())
  // 2) select a region via table row WHILE MAP HIDDEN (the bug trigger)
  const before = await page.evaluate(() => window.__m.regionParam())
  const row = await page.evaluate((i) => window.__m.clickRow(i), iter * 2 + 1)
  await settle(2000); await inj()
  const after = await page.evaluate(() => window.__m.regionParam())
  // 3) back to MAP (RepairOnShow must fire)
  const toMap = await page.evaluate(() => window.__m.clickToggle('რუქა|map'))
  await settle(2800); await inj()
  await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1200)
  const recovered = await page.evaluate(() => window.__m.mapState())
  await shot(OUT + `/A${iter + 1}-recovered-map.png`)
  R.storm.push({ iter: iter + 1, toTable, tableVisibleAfterToggle: tableVis, mapHiddenState: { mapVisible: mapHidden.mapVisible, rect: mapHidden.containerRect },
    selBefore: before, rowClicked: row, selAfter: after, selectionChangedWhileHidden: before !== after,
    toMap, recoveredMap: recovered, errors: [...errors] })
}
writeFileSync(OUT + '/_A_report.json', 'BASE ' + BASE + '\n' + JSON.stringify(R, null, 1))
console.log('DONE ' + OUT + '/_A_report.json')
await browser.close()
