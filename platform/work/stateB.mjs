// STATE B only: fresh load of /ka/regional, select 2 regions via real map clicks
// (locator.click on leaflet paths — proven working), then capture facts + shot.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots'
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
  window.__x.regionParam = () => new URLSearchParams(location.search).get('region') || ''
  window.__x.kpis = () => ({ values: Array.from(document.querySelectorAll('.stats-value, [class*="kpi-value"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14),
    labels: Array.from(document.querySelectorAll('.stats-item-label, .stats-label, [class*="kpi-label"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14) })
  window.__x.section = (id) => {
    const el = document.getElementById(id); if (!el) return { id, found: false }
    const apex = el.querySelector('.apexcharts-canvas'); const donut = el.querySelector('.donut-legend'); const wrap = el.querySelector('.chart-wrap')
    const title = el.querySelector('.section__title')?.textContent.trim().slice(0, 60) || null
    let kind = 'NONE', f = {}
    if (apex) { const q = s => Array.from(apex.querySelectorAll(s)); const bars = q('.apexcharts-bar-area'), pie = q('.apexcharts-pie-area')
      kind = pie.length ? 'apex-pie' : 'apex-bar'
      f = { series: q('.apexcharts-series').map(s => s.getAttribute('seriesName')).filter(Boolean), barCount: bars.length,
        legend: norm(apex.querySelectorAll('.apexcharts-legend-text')),
        dataLabels: norm(apex.querySelectorAll('.apexcharts-datalabels text, .apexcharts-data-labels text')),
        xLabels: norm(apex.querySelectorAll('.apexcharts-xaxis-texts-g text')), yLabels: norm(apex.querySelectorAll('.apexcharts-yaxis-texts-g text')) }
      f.seriesCount = f.series.length }
    else if (donut) { kind = 'svg-donut'; f = { sliceLegend: norm(el.querySelectorAll('.donut-legend__label')), svgTexts: norm(el.querySelectorAll('.chart-wrap svg text')) }; f.sliceCount = f.sliceLegend.length }
    else if (wrap) { const t = (wrap.innerText || '').replace(/\s+/g, ' ').trim(); kind = 'div-custom'; f = { tokens: t.slice(0, 200), pctCount: (t.match(/%/g) || []).length } }
    return { id, found: true, title, kind, rows: el.querySelectorAll('tbody tr').length, ...f }
  }
  window.__x.scan = () => { const b = document.body.innerText || ''; return { objObj: (b.match(/\[object Object\]/g) || []).length, failLoad: /Failed to load component/i.test(b), react31: /React error #31|not valid as a React child/i.test(b), emptyStates: document.querySelectorAll('.empty-state, [class*="EmptyState"]').length } }
}
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(4500)
await page.evaluate(HELPERS)
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const mapTotal = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
const clicks = []
async function clk(i) { const before = await page.evaluate(() => window.__x.regionParam()); try { await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }) } catch (e) { return { i, err: e.message.split('\n')[0] } } await page.waitForTimeout(1200); const after = await page.evaluate(() => window.__x.regionParam()); return { i, before, after, changed: before !== after, name: await page.evaluate(idx => document.querySelectorAll('.leaflet-container path.leaflet-interactive')[idx]?.getAttribute('aria-label') || null, i) } }
let cnt = 0
for (let i = 0; i < mapTotal && cnt < 2; i++) { const r = await clk(i); if (r.changed) { clicks.push(r); cnt = (r.after ? r.after.split(',').filter(Boolean).length : 0) } }
await page.waitForTimeout(4000); await page.evaluate(HELPERS)
const regionParam = await page.evaluate(() => window.__x.regionParam())
const mapHi = await page.evaluate(() => { const p = Array.from(document.querySelectorAll('.leaflet-container path.leaflet-interactive')); const sw = p.map(x => parseFloat(getComputedStyle(x).strokeWidth) || 0); const fills = p.map(x => x.getAttribute('fill-opacity') || getComputedStyle(x).fillOpacity); const mx = Math.max(0, ...sw); return { total: p.length, maxStroke: mx, thickStroke: sw.filter(w => mx > 1.6 && w >= mx - 0.05).length, distinctStroke: [...new Set(sw.map(w => Math.round(w * 10) / 10))], distinctFillOpacity: [...new Set(fills)].slice(0, 6) } })
const R = { url: page.url(), mapPaths: mapTotal, regionParam, selectedRegions: regionParam.split(',').filter(Boolean), registeredClicks: clicks,
  kpis: await page.evaluate(() => { window.scrollTo(0, 0); return window.__x.kpis() }) }
async function sec(id) { await page.evaluate(s => { const e = document.getElementById(s); if (e) e.scrollIntoView({ block: 'center' }) }, id); await page.waitForTimeout(1800); return page.evaluate(s => window.__x.section(s), id) }
R.sectorsMulti = await sec('sectors-multi')
R.regionsBar = await sec('regions-bar')
R.sectors = await sec('sectors')
R.mapHighlight = mapHi
R.scan = await page.evaluate(() => window.__x.scan())
R.errors = errors
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '/regional-stateB-2regions.png', fullPage: true })
writeFileSync(OUT + '/_stateB.json', JSON.stringify(R, null, 1))
console.log(JSON.stringify(R, null, 1))
await browser.close()
