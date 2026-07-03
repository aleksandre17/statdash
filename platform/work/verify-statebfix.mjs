// ACCEPTANCE probe for the regional cross-filter State-B fix (ba95362 / c0f70d0).
// LOCAL Playwright → live prod :3002. Captures State A + State B with explicit
// TEXT assertions: composition x-axis = SECTORS (not regions) in State B,
// series = the 2 selected regions, no [object Object], no duplicated region labels.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/statebfix'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)))

const HELPERS = () => {
  window.__x = {}
  const norm = els => Array.from(els).map(e => (e.textContent || '').trim()).filter(Boolean)
  window.__x.regionParam = () => new URLSearchParams(location.search).get('region') || ''
  window.__x.kpis = () => ({
    values: Array.from(document.querySelectorAll('.stats-value, [class*="kpi-value"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14),
    labels: Array.from(document.querySelectorAll('.stats-item-label, .stats-label, [class*="kpi-label"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 14),
    count: document.querySelectorAll('.stats-value, [class*="kpi-value"]').length,
  })
  window.__x.section = (id) => {
    const el = document.getElementById(id) || document.querySelector(id)
    if (!el) return { id, found: false }
    const title = el.querySelector('.section__title')?.textContent.trim().slice(0, 70) || null
    const apex = el.querySelector('.apexcharts-canvas')
    const donut = el.querySelector('.donut-legend')
    const wrap = el.querySelector('.chart-wrap')
    let kind = 'NONE', f = {}
    if (apex) {
      const q = s => Array.from(apex.querySelectorAll(s))
      const bars = q('.apexcharts-bar-area'), pie = q('.apexcharts-pie-area')
      kind = pie.length ? 'apex-pie' : bars.length ? 'apex-bar' : 'apex-other'
      f = {
        series: q('.apexcharts-series').map(s => s.getAttribute('seriesName')).filter(Boolean),
        legend: norm(apex.querySelectorAll('.apexcharts-legend-text')),
        barCount: bars.length, pieSlices: pie.length,
        xLabels: norm(apex.querySelectorAll('.apexcharts-xaxis-texts-g text')),
        yLabels: norm(apex.querySelectorAll('.apexcharts-yaxis-texts-g text')),
        dataLabels: norm(apex.querySelectorAll('.apexcharts-datalabels text, .apexcharts-data-labels text')),
      }
      f.seriesCount = f.series.length
    } else if (donut) {
      kind = 'svg-donut'
      const svg = el.querySelector('.chart-wrap svg')
      f = { sliceLegend: norm(el.querySelectorAll('.donut-legend__label')), svgTexts: svg ? norm(svg.querySelectorAll('text')) : [] }
      f.sliceCount = f.sliceLegend.length
    } else if (wrap) {
      kind = 'div-custom'
      const t = (wrap.innerText || '').replace(/\s+/g, ' ').trim()
      f = { tokens: t.slice(0, 240), pctCount: (t.match(/%/g) || []).length }
    }
    return { id, found: true, title, kind, tables: el.querySelectorAll('table').length, rows: el.querySelectorAll('tbody tr').length, ...f }
  }
  window.__x.scan = () => {
    const b = document.body.innerText || ''
    return {
      objObj: (b.match(/\[object Object\]/g) || []).length,
      failLoad: /Failed to load component/i.test(b),
      react31: /Minified React error #31|Objects are not valid as a React child/i.test(b),
      emptyStates: document.querySelectorAll('.empty-state, [class*="EmptyState"]').length,
      htmlLang: document.documentElement.lang || null,
    }
  }
  window.__x.mapHi = () => {
    const p = Array.from(document.querySelectorAll('.leaflet-container path.leaflet-interactive'))
    const sw = p.map(x => parseFloat(getComputedStyle(x).strokeWidth) || 0)
    const mx = Math.max(0, ...sw)
    return { total: p.length, maxStroke: mx, thickStroke: sw.filter(w => mx > 1.6 && w >= mx - 0.05).length }
  }
}
async function inject() { await page.evaluate(HELPERS) }
async function sec(id) { await page.evaluate(s => { const e = document.getElementById(s) || document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }) }, id); await page.waitForTimeout(1600); return page.evaluate(s => window.__x.section(s), id) }
async function shotSection(id, file) { try { const loc = page.locator('#' + id); if (await loc.count()) { await loc.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await loc.first().screenshot({ path: OUT + '/' + file }) } } catch { /* best-effort */ } }
async function settle(ms = 4000) { await page.waitForTimeout(ms) }
const R = { base: BASE, ts: new Date().toISOString() }

// ── STATE A — /ka/regional, no selection ──────────────────────────────────
errors.length = 0
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4500); await inject()
R.stateA = { kpis: await page.evaluate(() => window.__x.kpis()), composition: await sec('sectors'), regionsBar: await sec('regions-bar'), scan: await page.evaluate(() => window.__x.scan()), errors: [...errors] }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '/00-stateA-full.png', fullPage: true })
await shotSection('sectors', '00-stateA-composition.png')
await shotSection('regions-bar', '00-stateA-regionsbar.png')

// ── STATE B — select 2 regions via real map polygon clicks ─────────────────
errors.length = 0
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push('GOTO ' + e.message.split('\n')[0]))
await settle(4500); await inject()
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const mapTotal = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
const clicks = []
async function clk(i) {
  const before = await page.evaluate(() => window.__x.regionParam())
  const name = await page.evaluate(idx => document.querySelectorAll('.leaflet-container path.leaflet-interactive')[idx]?.getAttribute('aria-label') || null, i)
  try { await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }) } catch (e) { return { i, err: e.message.split('\n')[0] } }
  await page.waitForTimeout(1200)
  const after = await page.evaluate(() => window.__x.regionParam())
  return { i, name, before, after, changed: before !== after }
}
let cnt = 0
for (let i = 0; i < mapTotal && cnt < 2; i++) { const r = await clk(i); if (r.changed) { clicks.push(r); cnt = (r.after ? r.after.split(',').filter(Boolean).length : 0) } }
await settle(4500); await inject()
const regionParam = await page.evaluate(() => window.__x.regionParam())
R.stateB = {
  mapPaths: mapTotal, regionParam, selectedRegions: regionParam.split(',').filter(Boolean),
  selectedNames: clicks.map(c => c.name).filter(Boolean), registeredClicks: clicks,
  kpis: await page.evaluate(() => window.__x.kpis()),
  composition: await sec('sectors'), regionsBar: await sec('regions-bar'),
  mapHighlight: await page.evaluate(() => window.__x.mapHi()),
  scan: await page.evaluate(() => window.__x.scan()), errors: [...errors],
}
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500)
await page.screenshot({ path: OUT + '/01-stateB-full.png', fullPage: true })
await shotSection('sectors', '01-stateB-composition.png')
await shotSection('regions-bar', '01-stateB-regionsbar.png')

// ── ASSERTIONS ─────────────────────────────────────────────────────────────
const A = R.stateA, B = R.stateB
const aComp = A.composition || {}, bComp = B.composition || {}
const selNames = B.selectedNames || []
const bx = (bComp.xLabels || [])
const bxSet = [...new Set(bx)]
// region-name universe: State-A composition slice/x labels (all 11 regions) — used to
// decide whether State-B x-axis still shows regions (BUG) or sectors (CORRECT).
const regionUniverse = new Set([...(aComp.sliceLegend || []), ...(aComp.xLabels || []), ...(aComp.series || [])])
const bxAreRegions = bxSet.length > 0 && bxSet.every(l => regionUniverse.has(l))
const bSeries = bComp.series || bComp.legend || []
const seriesMatchesSelected = selNames.length === 2 && selNames.every(n => bSeries.some(s => s && (s.includes(n) || n.includes(s))))
const dupRegionLabel = (() => { const c = {}; for (const l of bx) c[l] = (c[l] || 0) + 1; return Object.entries(c).filter(([, n]) => n > 1).map(([l]) => l) })()

R.assertions = {
  stateA_composition_kind: aComp.kind,
  stateA_kpi_count: A.kpis?.count,
  stateB_selected_count: B.selectedRegions.length,
  stateB_selected_names: selNames,
  stateB_composition_kind: bComp.kind,
  stateB_xAxis_labels: bxSet,
  stateB_distinct_bar_categories: bxSet.length,
  stateB_series: bSeries,
  stateB_series_count: bSeries.length,
  // acceptance gates
  PASS_xAxis_is_sectors_not_regions: bComp.kind === 'apex-bar' && bxSet.length > 0 && !bxAreRegions,
  FAIL_xAxis_still_regions: bxAreRegions,
  PASS_series_are_2_selected_regions: seriesMatchesSelected,
  PASS_no_objectObject: (A.scan?.objObj || 0) === 0 && (B.scan?.objObj || 0) === 0,
  PASS_no_duplicated_region_labels: dupRegionLabel.length === 0,
  duplicated_labels: dupRegionLabel,
  PASS_map_highlights_2: (B.mapHighlight?.thickStroke || 0) === 2,
  errorsA: A.errors, errorsB: B.errors,
}
R.assertions.OVERALL_PASS =
  R.assertions.PASS_xAxis_is_sectors_not_regions &&
  !R.assertions.FAIL_xAxis_still_regions &&
  R.assertions.PASS_series_are_2_selected_regions &&
  R.assertions.PASS_no_objectObject &&
  R.assertions.PASS_no_duplicated_region_labels

writeFileSync(OUT + '/_report.json', JSON.stringify(R, null, 1))
console.log(JSON.stringify(R.assertions, null, 1))
console.log('DONE ' + OUT + '/_report.json')
await browser.close()
