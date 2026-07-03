// Acceptance verify for the map setStyle root-fix (f763053).
// THE path that crashed before: /ka/regional → panel "GDP — by region" →
// switch to TABLE view → click a table ROW (selects a region WHILE map hidden)
// → toggle BACK to map view → map MUST render real region paths, NOT the
// "Failed to load component / Invalid LatLng (NaN,NaN)" crash card, NOT blank.
// Also: choropleth colours preserved (occupied RED, selected AMBER, base ramp),
// in BOTH the table-select path AND the map-CLICK path. Storm the toggle.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/map-setstyle'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })).newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
let errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)))

const H = () => {
  window.__m = {}
  const hexToRgb = (s) => {
    if (!s) return null
    s = s.trim()
    let m = s.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    m = s.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
    if (m) return { r: +m[1], g: +m[2], b: +m[3] }
    return null
  }
  const classify = (fill) => {
    const c = hexToRgb(fill)
    if (!c) return 'unknown'
    const { r, g, b } = c
    // occupied = red: high R, low G & low B
    if (r > 150 && g < 90 && b < 90) return 'red'
    // selected/amber: high R, mid G, low B, and clearly warmer than red (G notably > red-G)
    if (r > 180 && g >= 120 && g < 200 && b < 110) return 'amber'
    return 'ramp'
  }
  window.__m.cssTokens = () => {
    const cs = getComputedStyle(document.documentElement)
    return { occupied: cs.getPropertyValue('--color-geo-occupied').trim(), selected: cs.getPropertyValue('--color-geo-selected').trim() }
  }
  window.__m.mapState = () => {
    const panel = document.querySelector('#geo-map')
    // error-boundary / crash card detection
    const panelText = (panel?.textContent || '')
    const crashCard = /Failed to load component|Invalid LatLng|error-boundary/i.test(panelText) ||
      !!panel?.querySelector('[class*="error" i], [class*="boundary" i]')
    const c = document.querySelector('#geo-map .leaflet-container')
    if (!c) return { present: false, mapVisible: false, crashCard, panelSnippet: panelText.slice(0, 120) }
    const rect = c.getBoundingClientRect()
    const vis = rect.width > 0 && rect.height > 0 && c.offsetParent !== null
    const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
    const bad = d => !d || /^M0 0z?$/i.test(d.trim()) || d.trim().length < 12
    const ds = paths.map(p => p.getAttribute('d') || '')
    const fills = paths.map(p => p.getAttribute('fill') || p.style.fill || '')
    const fillClass = fills.map(classify)
    const tally = fillClass.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {})
    let bbox = null
    try { const g = c.querySelector('.leaflet-overlay-pane svg g') || c.querySelector('.leaflet-overlay-pane svg'); if (g?.getBBox) { const b = g.getBBox(); bbox = { w: Math.round(b.width), h: Math.round(b.height) } } } catch {}
    return { present: true, crashCard, mapVisible: vis, containerRect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      pathCount: paths.length, realCount: ds.filter(d => !bad(d)).length, degenerateCount: ds.filter(bad).length,
      overlayBBox: bbox, fillTally: tally, distinctFills: [...new Set(fills)].slice(0, 14),
      sampleReal: ds.filter(d => !bad(d)).slice(0, 2).map(d => d.slice(0, 56)), sampleDegenerate: ds.filter(bad).slice(0, 5) }
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
  // Click a real polygon on the MAP (the map-CLICK selection path)
  window.__m.clickPolygon = (i) => {
    const c = document.querySelector('#geo-map .leaflet-container')
    if (!c) return { ok: false }
    const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
      .filter(p => { const d = p.getAttribute('d') || ''; return d.trim().length > 12 && !/^M0 0/i.test(d.trim()) })
    if (!paths.length) return { ok: false, paths: 0 }
    const p = paths[i % paths.length]
    const bb = p.getBoundingClientRect()
    const ev = (t) => p.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: bb.x + bb.width / 2, clientY: bb.y + bb.height / 2, view: window }))
    ev('mouseover'); ev('mousedown'); ev('mouseup'); ev('click')
    return { ok: true, paths: paths.length, idx: i % paths.length }
  }
  window.__m.regionParam = () => new URLSearchParams(location.search).get('region') || ''
  window.__m.kpiSnippet = () => {
    const k = document.querySelector('[class*="kpi" i]')
    return (k?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  }
}
async function inj() { await page.evaluate(H) }
const settle = (ms = 2500) => page.waitForTimeout(ms)
const R = { base: BASE, storm: [] }
async function shot(path) {
  const clip = await page.evaluate(() => { const e = document.querySelector('#geo-map'); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return null; return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(1440 - Math.max(0, r.x), r.width), height: Math.min(1000 - Math.max(0, r.y), r.height) } })
  if (clip) await page.screenshot({ path, clip }); else await page.screenshot({ path, fullPage: true })
}

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message))
await settle(5000); await inj()
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1500)
R.cssTokens = await page.evaluate(() => window.__m.cssTokens())
R.baseline = await page.evaluate(() => window.__m.mapState())
await shot(OUT + '/A0-baseline-map.png')

// ── A: table → select-while-hidden → toggle-back storm (THE crash path) ──
for (let iter = 0; iter < 4; iter++) {
  errors = []; await inj()
  const toTable = await page.evaluate(() => window.__m.clickToggle('ცხრილ|table'))
  await settle(2200); await inj()
  const tableVis = await page.evaluate(() => window.__m.tableVisible())
  const mapHidden = await page.evaluate(() => window.__m.mapState())
  const before = await page.evaluate(() => window.__m.regionParam())
  const row = await page.evaluate((i) => window.__m.clickRow(i), iter * 2 + 1)
  await settle(2000); await inj()
  const after = await page.evaluate(() => window.__m.regionParam())
  const toMap = await page.evaluate(() => window.__m.clickToggle('რუქა|map'))
  await settle(2800); await inj()
  await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1200)
  const recovered = await page.evaluate(() => window.__m.mapState())
  await shot(OUT + `/A${iter + 1}-recovered-map.png`)
  R.storm.push({ iter: iter + 1, toTable, tableVisibleAfterToggle: tableVis,
    mapHiddenState: { mapVisible: mapHidden.mapVisible, rect: mapHidden.containerRect, crashCard: mapHidden.crashCard },
    selBefore: before, rowClicked: row, selAfter: after, selectionChangedWhileHidden: before !== after,
    toMap, recoveredMap: recovered, invalidLatLngErrors: errors.filter(e => /Invalid LatLng|NaN/i.test(e)), errors: [...errors] })
}

// ── B: map-CLICK selection path (select by clicking polygons directly) ──
errors = []; await inj()
const clickBefore = await page.evaluate(() => window.__m.regionParam())
const kpiBefore = await page.evaluate(() => window.__m.kpiSnippet())
const poly = await page.evaluate(() => window.__m.clickPolygon(3))
await settle(2500); await inj()
const clickAfter = await page.evaluate(() => window.__m.regionParam())
const kpiAfter = await page.evaluate(() => window.__m.kpiSnippet())
const clickMapState = await page.evaluate(() => window.__m.mapState())
await shot(OUT + '/B-map-click-select.png')
R.mapClickPath = { polyClicked: poly, selBefore: clickBefore, selAfter: clickAfter, selectionChanged: clickBefore !== clickAfter,
  kpiBefore, kpiAfter, kpiChanged: kpiBefore !== kpiAfter, mapState: clickMapState, errors: [...errors] }

// ── C: non-regression — accounts chart scroll + comparison hbar ──
errors = []
await page.goto(BASE + '/ka/accounts', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message))
await settle(4000)
const acc = await page.evaluate(() => {
  const sc = Array.from(document.querySelectorAll('*')).find(e => { const s = getComputedStyle(e); return s.overflowY === 'auto' && e.scrollHeight > e.clientHeight + 20 })
  const hbar = document.querySelector('.apexcharts-canvas')
  return { hasScroller: !!sc, scrollH: sc?.scrollHeight || 0, clientH: sc?.clientHeight || 0,
    apexCanvasH: hbar ? Math.round(hbar.getBoundingClientRect().height) : 0 }
})
await shot(OUT + '/C-accounts.png')
R.nonRegression = { accounts: acc, errors: [...errors] }

writeFileSync(OUT + '/_report.json', JSON.stringify(R, null, 1))
console.log('DONE ' + OUT + '/_report.json')
console.log('cssTokens', JSON.stringify(R.cssTokens))
console.log('baseline crashCard=' + R.baseline.crashCard + ' real=' + R.baseline.realCount + '/' + R.baseline.pathCount + ' bbox=' + JSON.stringify(R.baseline.overlayBBox) + ' fills=' + JSON.stringify(R.baseline.fillTally))
for (const s of R.storm) console.log(`A${s.iter} selChangedHidden=${s.selectionChangedWhileHidden} recovered: crashCard=${s.recoveredMap.crashCard} real=${s.recoveredMap.realCount}/${s.recoveredMap.pathCount} degen=${s.recoveredMap.degenerateCount} bbox=${JSON.stringify(s.recoveredMap.overlayBBox)} fills=${JSON.stringify(s.recoveredMap.fillTally)} invalidLatLng=${s.invalidLatLngErrors.length} errs=${s.errors.length}`)
console.log('B map-click: selChanged=' + R.mapClickPath.selectionChanged + ' kpiChanged=' + R.mapClickPath.kpiChanged + ' crashCard=' + R.mapClickPath.mapState.crashCard + ' fills=' + JSON.stringify(R.mapClickPath.mapState.fillTally) + ' errs=' + R.mapClickPath.errors.length)
console.log('C accounts: scroller=' + R.nonRegression.accounts.hasScroller + ' scrollH=' + R.nonRegression.accounts.scrollH + '>' + R.nonRegression.accounts.clientH + ' apexH=' + R.nonRegression.accounts.apexCanvasH)
await browser.close()
