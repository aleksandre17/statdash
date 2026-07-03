// CAPTURE-ONLY re-probe of live prod (:3002) after rebuild @ 428783e.
// Adapted from verify-shipped.mjs: sectors-multi folded into ONE pivot panel `sectors`
// (State B now expected: x-axis=SECTORS, series=selected regions, stacked bar).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/after'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)))

const HELPERS = () => {
  window.__x = {}
  const norm = els => Array.from(els).map(e => (e.textContent || '').trim()).filter(Boolean)
  window.__x.section = (id) => {
    const el = document.getElementById(id) || document.querySelector(id)
    if (!el) return { id, found: false }
    const title = el.querySelector('.section__title')?.textContent.trim().slice(0, 60) || null
    const empty = el.querySelector('.empty-state, [class*="EmptyState"], [class*="empty-state"]')
    const wrap = el.querySelector('.chart-wrap')
    const apex = el.querySelector('.apexcharts-canvas')
    const donutLegend = el.querySelector('.donut-legend')
    let kind = 'NONE', facts = {}
    if (apex) {
      const q = s => Array.from(apex.querySelectorAll(s))
      const bars = q('.apexcharts-bar-area'), pie = q('.apexcharts-pie-area')
      kind = pie.length ? 'apex-pie' : bars.length ? 'apex-bar' : 'apex-other'
      facts = { series: q('.apexcharts-series').map(s => s.getAttribute('seriesName')).filter(Boolean),
        barCount: bars.length, pieSlices: pie.length,
        dataLabels: norm(apex.querySelectorAll('.apexcharts-datalabels text, .apexcharts-data-labels text')),
        xLabels: norm(apex.querySelectorAll('.apexcharts-xaxis-texts-g text')),
        yLabels: norm(apex.querySelectorAll('.apexcharts-yaxis-texts-g text')) }
      facts.seriesCount = facts.series.length
    } else if (donutLegend) {
      kind = 'svg-donut'
      const svg = el.querySelector('.chart-wrap svg')
      const arcs = svg ? Array.from(svg.querySelectorAll('path')).filter(p => { const f = p.getAttribute('fill'); return f && f !== 'none' }) : []
      facts = { sliceLegend: norm(el.querySelectorAll('.donut-legend__label')),
        arcCount: arcs.length,
        svgTexts: svg ? norm(svg.querySelectorAll('text')) : [],
        ariaLabel: svg?.getAttribute('aria-label') || null }
      facts.sliceCount = facts.sliceLegend.length
    } else if (wrap) {
      kind = 'div-custom(treemap?)'
      const txt = (wrap.innerText || '').replace(/\s+/g, ' ').trim()
      facts = { tokens: txt.slice(0, 220), pctCount: (txt.match(/%/g) || []).length, wrapChildren: wrap.querySelectorAll('div').length }
    }
    return { id, found: true, title, kind, empty: empty ? empty.textContent.trim().slice(0, 80) : null,
      tables: el.querySelectorAll('table').length, rows: el.querySelectorAll('tbody tr').length, ...facts }
  }
  window.__x.kpis = () => ({
    values: Array.from(document.querySelectorAll('.stats-value, [class*="kpi-value"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14),
    labels: Array.from(document.querySelectorAll('.stats-item-label, .stats-label, [class*="kpi-label"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14) })
  window.__x.scan = () => { const b = document.body.innerText || ''
    return { objObj: (b.match(/\[object Object\]/g) || []).length, failLoad: /Failed to load component/i.test(b),
      react31: /Minified React error #31|Objects are not valid as a React child/i.test(b),
      emptyStates: document.querySelectorAll('.empty-state, [class*="EmptyState"]').length,
      htmlLang: document.documentElement.lang || null, firstSectionTitle: document.querySelector('.section__title')?.textContent.trim().slice(0, 45) || null } }
  window.__x.regionParam = () => new URLSearchParams(location.search).get('region') || ''
}
async function inject() { await page.evaluate(HELPERS) }
async function sec(id) { await page.evaluate(s => { const e = document.getElementById(s) || document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }) }, id); await page.waitForTimeout(1800); return page.evaluate(s => window.__x.section(s), id) }
async function kpis() { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); return page.evaluate(() => window.__x.kpis()) }
async function scan() { return page.evaluate(() => window.__x.scan()) }
async function settle(ms = 3500) { await page.waitForTimeout(ms) }
const R = {}

// 1: /ka/regional STATE A (no selection)
errors.length = 0
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
R.regionalA = { kpis: await kpis(), regionsBar: await sec('regions-bar'), sectors: await sec('sectors'), scan: await scan(), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/regional-A.png', fullPage: true })

// 2: /ka/regional STATE B — select 2 regions via real map click gesture.
// NOTE: fresh navigation required — a prior fullPage screenshot resets the Leaflet
// pane transform (resize event) and subsequent force-clicks silently miss their target.
errors.length = 0
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4000); await inject()
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const mapTotal = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
const clicks = []
async function clk(i) { const before = await page.evaluate(() => window.__x.regionParam()); try { await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }) } catch (e) { return { i, err: e.message.split('\n')[0] } } await page.waitForTimeout(1100); const after = await page.evaluate(() => window.__x.regionParam()); return { i, before, after, changed: before !== after } }
let cnt = 0
for (let i = 0; i < mapTotal && cnt < 2; i++) { const r = await clk(i); if (r.changed) { clicks.push(r); cnt = (r.after ? r.after.split(',').filter(Boolean).length : 0) } }
await settle(4000); await inject()
const regionParam = await page.evaluate(() => window.__x.regionParam())
const mapHi = await page.evaluate(() => { const p = Array.from(document.querySelectorAll('.leaflet-container path.leaflet-interactive')); const sw = p.map(x => parseFloat(getComputedStyle(x).strokeWidth) || 0); const mx = Math.max(0, ...sw); return { total: p.length, maxStroke: mx, thickStroke: sw.filter(w => mx > 1.6 && w >= mx - 0.05).length } })
R.regionalB = { mapPaths: mapTotal, regionParam, selectedRegions: regionParam.split(',').filter(Boolean), registeredClicks: clicks,
  kpis: await kpis(), sectors: await sec('sectors'), regionsBar: await sec('regions-bar'), mapHighlight: mapHi, scan: await scan(), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500)
await page.screenshot({ path: OUT + '/regional-B.png', fullPage: true })

// 3: /ka/gdp YEAR
errors.length = 0
await page.goto(BASE + '/ka/gdp', { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(); await inject()
R.gdpYear = { kpis: await kpis(), structural: await sec('structural'), income: await sec('income'), scan: await scan(), errors: [...errors] }
// same-row check: structural vs income bounding boxes
R.gdpYear.sameRow = await page.evaluate(() => { const a = document.getElementById('structural')?.getBoundingClientRect(); const b = document.getElementById('income')?.getBoundingClientRect(); if (!a || !b) return null; return { structuralTop: Math.round(a.top), incomeTop: Math.round(b.top), overlap: Math.abs(a.top - b.top) < 40 } })
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/gdp-year.png', fullPage: true })

// 4: /ka/gdp RANGE
errors.length = 0
const toggled = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button,[role="tab"],[role="radio"],a')).find(x => /დინამიკა|Dynamics/i.test(x.textContent || '')); if (b) { b.click(); return b.textContent.trim().slice(0, 30) } return null })
await settle(); await inject()
R.gdpRange = { toggledVia: toggled, noeShare: await sec('noe-share'), scan: await scan(), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/gdp-range.png', fullPage: true })

// 5: dark theme on /ka/gdp
errors.length = 0
await page.evaluate(() => localStorage.setItem('statdash-theme', 'dark'))
await page.goto(BASE + '/ka/gdp', { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(); await inject()
R.dark = { htmlDataTheme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')), scan: await scan(), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/dark.png', fullPage: true })

const out = JSON.stringify(R, null, 1)
writeFileSync(OUT + '/_report.json', 'BASE ' + BASE + '\n' + out)
console.log('DONE ' + OUT + '/_report.json')
await browser.close()
