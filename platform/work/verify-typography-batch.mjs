// Live-DISPLAY verify for the typography/i18n/low-cardinality batch (b5ae777) @ :3002.
// Acceptance items: FiraGO glyph render, <html lang>/dir, locale toggle no-mix,
// State-B distinct series colours + thick hbar, table-view NaN-gate + repaint,
// banded table scroll + frozen header, hero subtitle hidden, 0 errors.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/typography-batch'
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
  const norm = els => Array.from(els).map(e => (e.textContent || '').trim()).filter(Boolean)
  window.__x.fonts = () => {
    const loaded = []
    try { document.fonts.forEach(f => loaded.push(f.family + ' ' + f.weight + ' ' + f.status)) } catch {}
    // pick a visibly Georgian text node to inspect its resolved font
    const geoEl = Array.from(document.querySelectorAll('h1,h2,.section__title,.stats-item-label,button,a,span'))
      .find(e => /[Ⴀ-ჿ]/.test(e.textContent || ''))
    const geoStyle = geoEl ? getComputedStyle(geoEl) : null
    return {
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      firaGoLoaded: (() => { try { return document.fonts.check('16px "FiraGO"') } catch { return null } })(),
      firaGoEntries: loaded.filter(f => /FiraGO/i.test(f)),
      geoSample: geoEl ? (geoEl.textContent || '').trim().slice(0, 40) : null,
      geoFontFamily: geoStyle ? geoStyle.fontFamily : null,
    }
  }
  window.__x.doc = () => ({ lang: document.documentElement.lang || null, dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction || null })
  window.__x.chromeText = () => {
    // sample nav/header chrome text to detect locale + mixed-locale
    const els = Array.from(document.querySelectorAll('nav a, header a, nav button, header button, .app-nav *, [class*="nav"] a')).slice(0, 40)
    const txt = norm(els)
    const geo = txt.filter(t => /[Ⴀ-ჿ]/.test(t)).length
    const lat = txt.filter(t => /[A-Za-z]/.test(t) && !/[Ⴀ-ჿ]/.test(t)).length
    return { sample: txt.slice(0, 12), geoCount: geo, latCount: lat }
  }
  window.__x.scan = () => { const b = document.body.innerText || ''
    return { objObj: (b.match(/\[object Object\]/g) || []).length,
      react31: /Minified React error #31|Objects are not valid as a React child/i.test(b),
      nanText: /NaN/.test(b),
      emptyStates: document.querySelectorAll('.empty-state, [class*="EmptyState"]').length } }
  window.__x.regionParam = () => new URLSearchParams(location.search).get('region') || ''
  // colour extraction for an apex panel by section id
  window.__x.apexColours = (id) => {
    const el = document.getElementById(id) || document.querySelector(id)
    if (!el) return { found: false }
    const apex = el.querySelector('.apexcharts-canvas')
    if (!apex) return { found: true, apex: false, title: el.querySelector('.section__title')?.textContent.trim() || null }
    const seriesPaths = Array.from(apex.querySelectorAll('.apexcharts-series path.apexcharts-bar-area, .apexcharts-series path.apexcharts-pie-area'))
    const fills = seriesPaths.map(p => (p.getAttribute('fill') || '').toLowerCase()).filter(Boolean)
    const legendFills = Array.from(apex.querySelectorAll('.apexcharts-legend-marker')).map(m => getComputedStyle(m).background.match(/rgb[^)]*\)/)?.[0] || '')
    const seriesNames = Array.from(apex.querySelectorAll('.apexcharts-series')).map(s => s.getAttribute('seriesName')).filter(Boolean)
    // bar geometry: measure rendered bar rect thickness
    const bars = Array.from(apex.querySelectorAll('path.apexcharts-bar-area'))
    const barBoxes = bars.slice(0, 12).map(b => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
    return { found: true, apex: true, title: el.querySelector('.section__title')?.textContent.trim() || null,
      seriesNames, seriesCount: seriesNames.length,
      fillsDistinct: Array.from(new Set(fills)), fillCount: fills.length,
      legendFillsDistinct: Array.from(new Set(legendFills.filter(Boolean))),
      barBoxes }
  }
  window.__x.tableInfo = (id) => {
    const el = document.getElementById(id) || document.querySelector(id)
    if (!el) return { found: false }
    const tbl = el.querySelector('table')
    // find scroll container (nearest ancestor/descendant with overflow)
    const cands = Array.from(el.querySelectorAll('*')).filter(n => { const s = getComputedStyle(n); return /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflow) })
    const scroller = cands.find(n => n.scrollHeight > n.clientHeight + 4) || cands[0] || null
    const thead = el.querySelector('thead')
    const theadPos = thead ? getComputedStyle(thead.querySelector('th') || thead).position : null
    return { found: true, hasTable: !!tbl, rows: el.querySelectorAll('tbody tr').length,
      scrollable: scroller ? { scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, canScroll: scroller.scrollHeight > scroller.clientHeight + 4 } : null,
      theadStickyPos: theadPos,
      exportBarPresent: !!el.querySelector('[class*="export"], [class*="Export"], .section__actions') }
  }
  // find a view-toggle control (table/chart) within a section
  window.__x.clickView = (id, re) => {
    const el = document.getElementById(id) || document.querySelector(id)
    if (!el) return { found: false }
    const rx = new RegExp(re, 'i')
    const btn = Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"],a,[class*="toggle"] *')).find(b => rx.test(b.textContent || '') || rx.test(b.getAttribute('aria-label') || '') || rx.test(b.getAttribute('title') || ''))
    if (btn) { btn.click(); return { clicked: true, label: (btn.textContent || btn.getAttribute('aria-label') || '').trim().slice(0, 30) } }
    return { clicked: false, controls: Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"]')).map(b => (b.textContent || '').trim()).slice(0, 8) }
  }
  window.__x.hasApex = (id) => { const el = document.getElementById(id) || document.querySelector(id); return el ? !!el.querySelector('.apexcharts-canvas svg') : false }
}
async function inject() { await page.evaluate(HELPERS) }
async function settle(ms = 3500) { await page.waitForTimeout(ms) }
const R = {}

// ── 1: /ka landing — fonts, lang/dir, hero subtitle hidden ──────────────────
errors = []
await page.goto(BASE + '/ka', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
R.landing = {
  fonts: await page.evaluate(() => window.__x.fonts()),
  doc: await page.evaluate(() => window.__x.doc()),
  chrome: await page.evaluate(() => window.__x.chromeText()),
  heroSubtitle: await page.evaluate(() => {
    const hero = document.querySelector('[class*="hero"], [class*="Hero"], header')
    const sub = hero ? Array.from(hero.querySelectorAll('p, [class*="subtitle"], [class*="sub"]')).map(e => ({ t: (e.textContent || '').trim().slice(0, 60), vis: e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' })).filter(x => x.t) : []
    return { visibleSubs: sub.filter(s => s.vis), allSubs: sub.slice(0, 8) }
  }),
  scan: await page.evaluate(() => window.__x.scan()), errors: [...errors]
}
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/01-landing-ka.png', fullPage: true })

// ── 2: locale toggle en <-> ka (no mixed-locale) ────────────────────────────
errors = []
// switch to EN
const toEn = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button,a,[role="button"]')).find(x => /^\s*(en|eng|english)\s*$/i.test((x.textContent || '').trim()))
  if (b) { b.click(); return (b.textContent || '').trim() } return null
})
await settle(2500); await inject()
R.localeEn = { toggledVia: toEn, doc: await page.evaluate(() => window.__x.doc()), chrome: await page.evaluate(() => window.__x.chromeText()), url: page.url(), scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }
await page.screenshot({ path: OUT + '/02-landing-en.png', fullPage: true })
// back to KA
errors = []
const toKa = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button,a,[role="button"]')).find(x => /^\s*(ka|geo|ქარ|ქართ)/i.test((x.textContent || '').trim()))
  if (b) { b.click(); return (b.textContent || '').trim() } return null
})
await settle(2500); await inject()
R.localeKaBack = { toggledVia: toKa, doc: await page.evaluate(() => window.__x.doc()), chrome: await page.evaluate(() => window.__x.chromeText()), url: page.url(), scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }

// ── 3: /ka/regional STATE A ─────────────────────────────────────────────────
errors = []
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
R.regionalA = { sectors: await page.evaluate(() => window.__x.apexColours('sectors')), regionsBar: await page.evaluate(() => window.__x.apexColours('regions-bar')), scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/03-regional-A.png', fullPage: true })

// ── 4: /ka/regional STATE B — select 2 regions via map click ────────────────
errors = []
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const mapTotal = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
async function clk(i) { const before = await page.evaluate(() => window.__x.regionParam()); try { await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }) } catch (e) { return { i, err: e.message.split('\n')[0] } } await page.waitForTimeout(1100); const after = await page.evaluate(() => window.__x.regionParam()); return { i, before, after, changed: before !== after } }
const clicks = []; let cnt = 0
for (let i = 0; i < mapTotal && cnt < 2; i++) { const r = await clk(i); if (r.changed) { clicks.push(r); cnt = (r.after ? r.after.split(',').filter(Boolean).length : 0) } }
await settle(4000); await inject()
const regionParam = await page.evaluate(() => window.__x.regionParam())
R.regionalB = { mapPaths: mapTotal, regionParam, selectedRegions: regionParam.split(',').filter(Boolean), registeredClicks: clicks,
  sectors: await page.evaluate(() => window.__x.apexColours('sectors')),
  regionsBar: await page.evaluate(() => window.__x.apexColours('regions-bar')),
  scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500)
await page.screenshot({ path: OUT + '/04-regional-B.png', fullPage: true })
// focused screenshot of the sectors composition panel
await page.evaluate(() => (document.getElementById('sectors') || document.querySelector('#sectors'))?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT + '/04b-regional-B-sectors.png' })

// ── 5: composition TABLE-view NaN gate + repaint on toggle-back ─────────────
errors = []
await inject()
const toTable = await page.evaluate(() => window.__x.clickView('sectors', 'ცხრილ|table'))
await settle(2500); await inject()
const tableInfo = await page.evaluate(() => window.__x.tableInfo('sectors'))
await page.evaluate(() => (document.getElementById('sectors'))?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(800)
await page.screenshot({ path: OUT + '/05-sectors-table.png' })
// change selection while in table view (deselect one region via re-click of a highlighted path)
const changeSel = await page.evaluate(() => window.__x.regionParam())
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(1000)
// click a third region to change selection while table view active
for (let i = 0; i < mapTotal; i++) { const r = await clk(i); if (r.changed) break }
await settle(2500); await inject()
const errAfterSelChange = [...errors]
// toggle back to chart
const toChart = await page.evaluate(() => window.__x.clickView('sectors', 'დიაგრამ|chart|გრაფიკ'))
await settle(3000); await inject()
const apexRepainted = await page.evaluate(() => window.__x.hasApex('sectors'))
R.tableGate = { toTable, tableInfo, selBeforeChange: changeSel, selAfterChange: await page.evaluate(() => window.__x.regionParam()),
  toChart, apexRepaintedOnToggleBack: apexRepainted,
  nanErrorsDuringSelChange: errAfterSelChange.filter(e => /nan/i.test(e)),
  allErrorsThisStep: [...errors], scan: await page.evaluate(() => window.__x.scan()) }
await page.evaluate(() => (document.getElementById('sectors'))?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '/06-sectors-chart-repaint.png' })

const out = JSON.stringify(R, null, 1)
writeFileSync(OUT + '/_report.json', 'BASE ' + BASE + '\n' + out)
console.log('DONE ' + OUT + '/_report.json')
await browser.close()
