// Live-DISPLAY verify for the regression-fix deploy (675d948) @ :3002.
// A (MOST IMPORTANT): map recovers after table-row-select while hidden — region
//   paths must have REAL d (not "M0 0"), overlay bbox non-zero, across a toggle storm.
// B: /ka/accounts horizontal chart now SCROLLS (scrollHeight>clientHeight, scrollable).
// C: /ka/regional State-B comparison hbar ~380px min (not a 240px sliver).
// Re-confirm prior wins: FiraGO glyphs, State-B distinct sector colours, <html lang> flips.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/regression-fix'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
let errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)))

const HELPERS = () => {
  window.__x = {}
  window.__x.doc = () => ({ lang: document.documentElement.lang || null, dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction || null })
  window.__x.fonts = () => {
    const loaded = []
    try { document.fonts.forEach(f => loaded.push(f.family + ' ' + f.weight + ' ' + f.status)) } catch {}
    const geoEl = Array.from(document.querySelectorAll('h1,h2,.section__title,button,a,span'))
      .find(e => /[Ⴀ-ჿ]/.test(e.textContent || ''))
    return {
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      firaGoLoaded: (() => { try { return document.fonts.check('16px "FiraGO"') } catch { return null } })(),
      firaGoEntries: loaded.filter(f => /FiraGO/i.test(f)),
      geoSample: geoEl ? (geoEl.textContent || '').trim().slice(0, 40) : null,
      geoFontFamily: geoEl ? getComputedStyle(geoEl).fontFamily : null,
    }
  }
  window.__x.scan = () => { const b = document.body.innerText || ''
    return { objObj: (b.match(/\[object Object\]/g) || []).length,
      react31: /Minified React error #31|Objects are not valid as a React child/i.test(b),
      nanText: /\bNaN\b/.test(b) } }

  // ── MAP (defect A) — classify region-path `d` attributes ────────────────
  //  Degenerate = "M0 0" (blank/broken projection). Real = a genuine multi-coord path.
  window.__x.mapState = () => {
    const container = document.querySelector('.leaflet-container')
    if (!container) return { present: false }
    const rect = container.getBoundingClientRect()
    const paths = Array.from(container.querySelectorAll('path.leaflet-interactive'))
    const isDegenerate = d => !d || /^M0 0z?$/i.test(d.trim()) || d.trim().length < 12
    const ds = paths.map(p => (p.getAttribute('d') || ''))
    const degenerate = ds.filter(isDegenerate)
    const real = ds.filter(d => !isDegenerate(d))
    // overlay bbox — the <g> holding the projected geometry
    let bbox = null
    try {
      const g = container.querySelector('.leaflet-overlay-pane svg g') || container.querySelector('.leaflet-overlay-pane svg')
      if (g && g.getBBox) { const b = g.getBBox(); bbox = { w: Math.round(b.width), h: Math.round(b.height) } }
    } catch {}
    return {
      present: true,
      containerRect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      pathCount: paths.length,
      realCount: real.length,
      degenerateCount: degenerate.length,
      overlayBBox: bbox,
      sampleReal: real.slice(0, 2).map(d => d.slice(0, 70)),
      sampleDegenerate: degenerate.slice(0, 3),
    }
  }
  // Tag the section/panel that contains the leaflet map so we can toggle its views.
  window.__x.tagMapPanel = () => {
    const container = document.querySelector('.leaflet-container')
    if (!container) return { tagged: false }
    // climb to the nearest section-like panel ancestor
    let el = container
    for (let i = 0; i < 8 && el && el.parentElement; i++) {
      el = el.parentElement
      if (/section|panel/i.test(el.className || '') || el.tagName === 'SECTION' || el.querySelector('.section__title, [class*="section__title"]')) break
    }
    el.setAttribute('data-verify-mappanel', '1')
    return { tagged: true, tag: el.tagName + '.' + (el.className || '').split(' ')[0], title: (el.querySelector('.section__title, [class*="title"]')?.textContent || '').trim().slice(0, 50) }
  }
  window.__x.clickView = (sel, re) => {
    const el = document.querySelector(sel)
    if (!el) return { found: false }
    const rx = new RegExp(re, 'i')
    const btn = Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"],a')).find(b => rx.test(b.textContent || '') || rx.test(b.getAttribute('aria-label') || '') || rx.test(b.getAttribute('title') || ''))
    if (btn) { btn.click(); return { clicked: true, label: (btn.textContent || btn.getAttribute('aria-label') || '').trim().slice(0, 30) } }
    return { clicked: false, controls: Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"]')).map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 10) }
  }
  // click a table row inside the map panel (selects a region → cross-filter)
  window.__x.clickTableRow = (idx) => {
    const el = document.querySelector('[data-verify-mappanel="1"]')
    if (!el) return { found: false }
    const rows = Array.from(el.querySelectorAll('tbody tr'))
    if (!rows.length) return { found: true, rows: 0 }
    const r = rows[Math.min(idx, rows.length - 1)]
    const clickable = r.querySelector('a,button,[role="button"],td') || r
    const label = (r.textContent || '').trim().slice(0, 40)
    clickable.click()
    return { found: true, rows: rows.length, clickedRowIdx: Math.min(idx, rows.length - 1), rowLabel: label }
  }
  window.__x.regionParam = () => new URLSearchParams(location.search).get('region') || ''
  window.__x.hasApex = (sel) => { const el = document.querySelector(sel); return el ? !!el.querySelector('.apexcharts-canvas svg') : false }

  // ── SCROLL (defect B) — find a scrollable chart container on the page ───
  window.__x.scrollProbe = () => {
    const wraps = Array.from(document.querySelectorAll('.chart-wrap[data-content="chart"], .chart-wrap'))
    const results = []
    const seen = new Set()
    const consider = (n, origin) => {
      if (!n || seen.has(n)) return; seen.add(n)
      const s = getComputedStyle(n)
      const scrolly = /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflow)
      if (n.scrollHeight > n.clientHeight + 4) {
        results.push({ origin, cls: (n.className || '').toString().slice(0, 40), scrollH: n.scrollHeight, clientH: n.clientHeight, overflowY: s.overflowY, maxHeight: s.maxHeight, canScroll: scrolly })
      }
    }
    wraps.forEach(w => { consider(w, 'chart-wrap'); w.querySelectorAll('*').forEach(c => consider(c, 'child')) })
    return { candidates: results.filter(r => r.canScroll || r.overflowY !== 'visible'), rawTallCount: results.length }
  }
  // measure the comparison hbar (apex) rendered height for defect C
  window.__x.apexHeights = () => {
    return Array.from(document.querySelectorAll('.apexcharts-canvas')).map(c => {
      const r = c.getBoundingClientRect()
      const sec = c.closest('section, [class*="section"], [class*="panel"]')
      const title = (sec?.querySelector('.section__title, [class*="title"]')?.textContent || '').trim().slice(0, 40)
      const horiz = !!c.querySelector('.apexcharts-bar-series path.apexcharts-bar-area')
      // detect horizontal by comparing a bar's width>height on first bar
      const bar = c.querySelector('path.apexcharts-bar-area')
      let barShape = null
      if (bar) { const b = bar.getBoundingClientRect(); barShape = { w: Math.round(b.width), h: Math.round(b.height) } }
      return { title, height: Math.round(r.height), width: Math.round(r.width), barShape }
    })
  }
  window.__x.apexColours = (sel) => {
    const el = document.querySelector(sel); if (!el) return { found: false }
    const apex = el.querySelector('.apexcharts-canvas'); if (!apex) return { found: true, apex: false }
    const bars = Array.from(apex.querySelectorAll('.apexcharts-series path.apexcharts-bar-area, .apexcharts-series path.apexcharts-pie-area'))
    const fills = Array.from(new Set(bars.map(p => (p.getAttribute('fill') || '').toLowerCase()).filter(Boolean)))
    const seriesNames = Array.from(apex.querySelectorAll('.apexcharts-series')).map(s => s.getAttribute('seriesName')).filter(Boolean)
    return { found: true, apex: true, seriesNames, fillsDistinct: fills, fillCount: fills.length }
  }
  window.__x.tagPanelByTitle = (reStr, attr) => {
    const rx = new RegExp(reStr, 'i')
    const secs = Array.from(document.querySelectorAll('section, [class*="section"], [class*="panel"]'))
    const hit = secs.find(s => rx.test((s.querySelector('.section__title, [class*="title"]')?.textContent || '')))
    if (hit) { hit.setAttribute(attr, '1'); return { tagged: true, title: (hit.querySelector('.section__title, [class*="title"]')?.textContent || '').trim().slice(0, 50) } }
    return { tagged: false, titles: secs.map(s => (s.querySelector('.section__title, [class*="title"]')?.textContent || '').trim()).filter(Boolean).slice(0, 12) }
  }
}
async function inject() { await page.evaluate(HELPERS) }
async function settle(ms = 3500) { await page.waitForTimeout(ms) }
const R = {}

// ══ 1: /ka landing — fonts + lang/dir (re-confirm prior wins) ══════════════
errors = []
await page.goto(BASE + '/ka', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
R.landing = { fonts: await page.evaluate(() => window.__x.fonts()), doc: await page.evaluate(() => window.__x.doc()), scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }
// locale flip check
const toEn = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button,a,[role="button"]')).find(x => /^\s*(en|eng|english)\s*$/i.test((x.textContent || '').trim())); if (b) { b.click(); return (b.textContent || '').trim() } return null })
await settle(2500); await inject()
R.localeFlip = { toggledVia: toEn, docEn: await page.evaluate(() => window.__x.doc()), url: page.url() }

// ══ 2: /ka/accounts — B (horizontal chart scroll) ══════════════════════════
errors = []
await page.goto(BASE + '/ka/accounts', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4500); await inject()
const scroll1 = await page.evaluate(() => window.__x.scrollProbe())
// actually try to scroll the tallest candidate and confirm scrollTop moves
const scrolled = await page.evaluate(() => {
  const wraps = Array.from(document.querySelectorAll('.chart-wrap[data-content="chart"], .chart-wrap'))
  let target = null
  const all = []
  wraps.forEach(w => { all.push(w); w.querySelectorAll('*').forEach(c => all.push(c)) })
  target = all.filter(n => { const s = getComputedStyle(n); return (/auto|scroll/.test(s.overflowY)) && n.scrollHeight > n.clientHeight + 4 }).sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]
  if (!target) return { found: false }
  const before = target.scrollTop
  target.scrollTop = target.scrollHeight
  const after = target.scrollTop
  return { found: true, cls: (target.className || '').toString().slice(0, 40), scrollH: target.scrollHeight, clientH: target.clientHeight, maxHeight: getComputedStyle(target).maxHeight, before, after, moved: after > before }
})
R.accountsScroll = { probe: scroll1, scrolled, errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/02-accounts-scroll.png', fullPage: true })

// ══ 3: /ka/regional — A (map recovery storm) + C (hbar height) + colours ═══
errors = []
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(5000); await inject()
const mapPanel = await page.evaluate(() => window.__x.tagMapPanel())
// baseline: fresh map should be real
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const mapBaseline = await page.evaluate(() => window.__x.mapState())
await page.screenshot({ path: OUT + '/03a-regional-map-baseline.png', fullPage: true })

// ── A STORM: table-view → click row (select region while map hidden) → map back
const storm = []
for (let iter = 0; iter < 3; iter++) {
  errors = []
  await inject()
  const toTable = await page.evaluate(() => window.__x.clickView('[data-verify-mappanel="1"]', 'ცხრილ|table'))
  await settle(2200); await inject()
  const beforeSel = await page.evaluate(() => window.__x.regionParam())
  const rowClick = await page.evaluate((i) => window.__x.clickTableRow(i), iter + 1)
  await settle(2200); await inject()
  const afterSel = await page.evaluate(() => window.__x.regionParam())
  const toMap = await page.evaluate(() => window.__x.clickView('[data-verify-mappanel="1"]', 'რუკა|map|დიაგრამ|chart|გრაფიკ'))
  await settle(2800); await inject()
  await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1200)
  const mapAfter = await page.evaluate(() => window.__x.mapState())
  await page.screenshot({ path: OUT + `/03b-storm-${iter + 1}-map-recovered.png`, fullPage: true })
  storm.push({ iter: iter + 1, toTable, beforeSel, rowClick, afterSel, selectionChanged: beforeSel !== afterSel, toMap, mapAfter, errors: [...errors] })
}
R.mapPanel = mapPanel
R.mapBaseline = mapBaseline
R.mapRecoveryStorm = storm

// ── C: comparison hbar height + State-B colours (measure current State B) ──
errors = []
await inject()
await page.evaluate(() => window.__x.tagPanelByTitle('comparison|შედარებ|comparison|regional comparison', 'data-verify-hbar'))
const apexHeights = await page.evaluate(() => window.__x.apexHeights())
// tag the composition/sectors panel for colour re-confirm
await page.evaluate(() => window.__x.tagPanelByTitle('sector|დარგ|structure|composition|by region|რეგიონ', 'data-verify-comp'))
const compColours = await page.evaluate(() => window.__x.apexColours('[data-verify-comp="1"]'))
R.hbarHeight = { currentRegionParam: await page.evaluate(() => window.__x.regionParam()), apexHeights, compColours, errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/04-regional-stateB-full.png', fullPage: true })

const out = JSON.stringify(R, null, 1)
writeFileSync(OUT + '/_report.json', 'BASE ' + BASE + '\n' + out)
console.log('DONE ' + OUT + '/_report.json')
await browser.close()
