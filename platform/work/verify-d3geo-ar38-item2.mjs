// AR-38 directional sector — verify the "GDP — by region" composition re-orients when a
// SECTOR is selected (no region): 4-state truth table. State-A (no sector/region)=donut over
// regions. Select a sector -> _mark=bar, _xDim=geoLabel (x=regions), _seriesDim=sectorLabel
// (the pinned sector). Compound region+sector -> intersection.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/d3geo-ar38'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1700 }, locale: 'ka-GE' })).newPage()
const errs = []
page.on('pageerror', e => errs.push('PE ' + String(e.message).slice(0, 120)))
const S = ms => page.waitForTimeout(ms)

// Read the composition panel: mark type (donut vs bar) + x-axis categories + series names.
// Identify the composition panel by its title text (GDP — by region / მშპ ... რეგიონების).
const readComposition = () => page.evaluate(() => {
  // find the panel whose header mentions region composition but is NOT the #geo-map
  const panels = [...document.querySelectorAll('.panel, section, [class*="panel" i]')]
  const isComp = el => /რეგიონების|by region|რეგიონულ/i.test(el.textContent || '') && !el.closest('#geo-map') && !el.querySelector('#geo-map')
  let panel = panels.find(p => {
    const h = p.querySelector('h1,h2,h3,h4,[class*="title" i]')
    return h && /რეგიონების|by region|მშპ/i.test(h.textContent || '') && !p.closest('#geo-map') && p.id !== 'geo-map'
  })
  // fallback: any apex chart not inside #geo-map
  const charts = [...document.querySelectorAll('.apexcharts-canvas')].filter(c => !c.closest('#geo-map'))
  const pick = panel && panel.querySelector('.apexcharts-canvas') ? panel.querySelector('.apexcharts-canvas') : charts[0]
  if (!pick) return { found: false, chartsOutsideMap: charts.length }
  const svg = pick.querySelector('svg')
  const donutSlices = pick.querySelectorAll('.apexcharts-pie-series path, .apexcharts-radialbar-series path').length
  const bars = pick.querySelectorAll('.apexcharts-bar-series path, .apexcharts-bar-area').length
  const xlabels = [...pick.querySelectorAll('.apexcharts-xaxis-texts-g text, .apexcharts-xaxis-label')].map(t => (t.textContent || '').trim()).filter(Boolean)
  const legend = [...pick.querySelectorAll('.apexcharts-legend-text')].map(t => (t.textContent || '').trim()).filter(Boolean)
  const panelTitle = (panel?.querySelector('h1,h2,h3,h4,[class*="title" i]')?.textContent || '').trim().slice(0, 50)
  return {
    found: true, panelTitle,
    mark: donutSlices > 0 && bars === 0 ? 'donut' : bars > 0 ? 'bar' : 'unknown',
    donutSlices, bars, xlabels: xlabels.slice(0, 15), xCount: xlabels.length, legend: legend.slice(0, 8),
  }
})

// Find the sector <select> and set it to a non-total sector by matching the label "სექტორ"/"Sector".
const selectSector = () => page.evaluate(() => {
  const selects = [...document.querySelectorAll('select')]
  // the sector select's options exclude _T; match by an option that is not the emptyLabel
  let target = null
  for (const s of selects) {
    const lblEl = s.closest('label') || document.querySelector(`label[for="${s.id}"]`)
    const near = (lblEl?.textContent || s.getAttribute('aria-label') || '')
    const opts = [...s.options].map(o => (o.textContent || '').trim())
    if (/სექტორ|sector/i.test(near) || (opts.length > 2 && /ყველა|all/i.test(opts[0] || ''))) { target = s; break }
  }
  if (!target) return { ok: false, selectCount: selects.length, dump: selects.map(s => [...s.options].slice(0,3).map(o=>o.textContent)) }
  // choose the 2nd option (first non-empty sector)
  const opt = [...target.options].find((o, i) => i > 0 && o.value && o.value !== '_T' && o.value !== '')
  if (!opt) return { ok: false, reason: 'no non-total option', opts: [...target.options].map(o => o.value) }
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  nativeSetter.call(target, opt.value)
  target.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, chosenValue: opt.value, chosenLabel: (opt.textContent || '').trim() }
})

const R = { errs: [] }
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4500)
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)) } window.scrollTo(0, 0) }); await S(1200)

R.stateA = await readComposition()
await page.evaluate(() => document.querySelector('.apexcharts-canvas:not(#geo-map *)')?.closest('.panel,section')?.scrollIntoView({ block: 'center' })); await S(500)
await page.screenshot({ path: OUT + '/03-composition-stateA-donut.png', fullPage: true }).catch(() => {})

// ── select a SECTOR ──
R.sectorSelect = await selectSector(); await S(2500)
R.urlAfterSector = await page.evaluate(() => location.search)
R.afterSector = await readComposition()
await page.screenshot({ path: OUT + '/04-composition-sector-directional.png', fullPage: true }).catch(() => {})

// ── compound: sector + a region (click a map region) ──
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await S(600)
await page.evaluate(() => document.querySelector('#geo-map svg.geo-map__svg path.geo-map__region[role="button"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await S(2000)
R.urlCompound = await page.evaluate(() => location.search)
R.compound = await readComposition()
await page.screenshot({ path: OUT + '/05-composition-sector-plus-region.png', fullPage: true }).catch(() => {})

R.errs = errs.slice(0, 8)
console.log(JSON.stringify(R, null, 1))
await browser.close()
