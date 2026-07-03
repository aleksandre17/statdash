// Verify ea30c0e LIVE on prod :3002 — d3-geo SVG choropleth + AR-38 directional sector.
// Item 1 (headline): #geo-map panel -> TABLE view -> click a row (select region while map
//   hidden) -> toggle back to MAP -> the SVG <path.geo-map__region> must have REAL d attrs
//   (never M0 0) + non-zero bbox. By construction (data-driven projection) it must ALWAYS
//   render. Run 3x. Occupied=red #dc2626 (data-occupied), selected=amber #e8a33d (data-selected).
// Item 2 (AR-38): select a SECTOR via the filter bar -> "GDP — by region" composition
//   re-orients to x=regions with the sector pinned (a bar, not the donut).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/d3geo-ar38'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1700 }, locale: 'ka-GE' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PE ' + String(e.message).slice(0, 120)))
const S = ms => page.waitForTimeout(ms)

// ── d3-geo map probe: read the SVG paths, NOT any leaflet container ────────────
const probeMap = () => page.evaluate(() => {
  const panel = document.querySelector('#geo-map')
  if (!panel) return { present: false }
  const svg = panel.querySelector('svg.geo-map__svg')
  if (!svg) return { present: true, svg: false }
  const paths = [...svg.querySelectorAll('path.geo-map__region')]
  const badf = d => !d || /^M0 0z?$/i.test((d || '').trim()) || (d || '').trim().length < 12
  const ds = paths.map(p => p.getAttribute('d') || '')
  const r = svg.getBoundingClientRect()
  let bbox = { w: 0, h: 0 }
  try { const b = svg.getBBox(); if (b) bbox = { w: Math.round(b.width), h: Math.round(b.height) } } catch {}
  const fills = {}
  paths.forEach(p => { const f = (p.getAttribute('fill') || '').toLowerCase(); fills[f] = (fills[f] || 0) + 1 })
  const selected = paths.filter(p => p.getAttribute('data-selected') != null).length
  const occupied = paths.filter(p => p.getAttribute('data-occupied') != null).length
  const selFills = paths.filter(p => p.getAttribute('data-selected') != null).map(p => (p.getAttribute('fill') || '').toLowerCase())
  const occFills = paths.filter(p => p.getAttribute('data-occupied') != null).map(p => (p.getAttribute('fill') || '').toLowerCase())
  const crash = /failed to load|invalid latlng|retry|shell crashed/i.test(document.body.innerText || '')
  const real = ds.filter(d => !badf(d)).length
  const degen = ds.filter(badf).length
  return {
    present: true, svg: true, total: paths.length, real, degen,
    svgW: Math.round(r.width), svgH: Math.round(r.height), bbox,
    viewBox: svg.getAttribute('viewBox'),
    sampleD: (ds.find(d => !badf(d)) || ds[0] || '').slice(0, 56),
    selected, occupied, selFills, occFills, fills, crash,
  }
})
const clickToggle = rx => page.evaluate(s => {
  const re = new RegExp(s, 'i')
  const b = [...document.querySelectorAll('#geo-map button')].find(x => re.test((x.textContent || '').trim()))
  if (b) { b.click(); return (b.textContent || '').trim() }
  return null
}, rx)
const scrollMap = () => page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' }))

const R = { servedHash: null, item1: {}, item2: {}, errs: [] }
R.servedHash = await page.evaluate(async b => {
  const h = await (await fetch(b + '/', { cache: 'no-store' })).text()
  return (h.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0] || null
}, BASE).catch(() => null)
// confirm NO leaflet chunk is even referenced by the served bundle graph
R.leafletInHtml = await page.evaluate(async b => {
  const h = await (await fetch(b + '/', { cache: 'no-store' })).text()
  return /leaflet/i.test(h)
}, BASE).catch(() => null)

// ══ ITEM 1 — THE MAP (select-while-hidden → toggle → must render) ══════════════
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4500)
await scrollMap(); await S(1200)
R.item1.baseline = await probeMap()

const iters = []
for (let i = 1; i <= 3; i++) {
  await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4000)
  await scrollMap(); await S(1000)
  const toTable = await clickToggle('ცხრილ|table'); await S(1600)
  const rowIdx = 1 + i
  await page.evaluate(ri => {
    const rows = [...document.querySelectorAll('#geo-map tbody tr')];
    (rows[ri]?.querySelector('td') || rows[ri])?.click()
  }, rowIdx); await S(1400)
  const region = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
  const toMap = await clickToggle('რუქა|map'); await S(2200)
  const m1 = await probeMap()
  await S(2500)
  const m2 = await probeMap()
  iters.push({ iter: i, rowIdx, toTable, toMap, region, at2s: m1, at5s: m2 })
  if (i === 1) {
    await scrollMap(); await S(500)
    await page.locator('#geo-map').screenshot({ path: OUT + '/01-map-after-select-hidden-toggle.png' }).catch(() => {})
  }
}
R.item1.iterations = iters

// hover a region to confirm tooltip works, then screenshot fresh map
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4000)
await scrollMap(); await S(1000)
await page.evaluate(() => {
  const p = document.querySelector('#geo-map svg.geo-map__svg path.geo-map__region')
  if (p) { const r = p.getBoundingClientRect(); const ev = new MouseEvent('mouseenter', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); p.dispatchEvent(ev) }
}); await S(600)
R.item1.tooltip = await page.evaluate(() => {
  const t = document.querySelector('#geo-map .geo-map__tooltip')
  return t ? (t.textContent || '').trim().slice(0, 60) : null
})
// map-click selects
await page.evaluate(() => document.querySelector('#geo-map svg.geo-map__svg path.geo-map__region[role="button"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await S(1200)
R.item1.mapClickRegion = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
await scrollMap(); await S(400)
await page.locator('#geo-map').screenshot({ path: OUT + '/02-map-fresh-hover-click.png' }).catch(() => {})

console.log(JSON.stringify(R, null, 1))
await browser.close()
