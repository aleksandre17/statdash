// Non-regression (item 3): State-B region multi-select on the d3-geo map, distinct region
// colours, FiraGO Georgian glyphs, <html lang> flip, /ka/accounts scroll, comparison hbar ~560.
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
const R = { errs: [] }

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4500)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await S(1000)

// FiraGO fonts + <html lang>
R.fonts = await page.evaluate(() => ({
  firago400: document.fonts.check('16px FiraGO'),
  firago700: document.fonts.check('700 16px FiraGO'),
  bodyFF: getComputedStyle(document.body).fontFamily,
  htmlLang: document.documentElement.lang,
  htmlDir: document.documentElement.dir,
}))

// State-B multi-select on the d3-geo map: click two region paths -> region param = 2 codes
const clickRegionNth = n => page.evaluate(i => {
  const ps = [...document.querySelectorAll('#geo-map svg.geo-map__svg path.geo-map__region[role="button"]')]
  ps[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}, n)
await clickRegionNth(3); await S(1200)
const r1 = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
await clickRegionNth(6); await S(1200)
const r2 = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
R.multiSelect = { afterFirst: r1, afterSecond: r2, isMulti: r2.split(',').filter(Boolean).length >= 2 }

// distinct region fills census (real paths only) + selected/occupied
R.mapColours = await page.evaluate(() => {
  const ps = [...document.querySelectorAll('#geo-map svg.geo-map__svg path.geo-map__region')]
  const badf = d => !d || /^M0 0z?$/i.test((d || '').trim()) || (d || '').trim().length < 12
  const real = ps.filter(p => !badf(p.getAttribute('d')))
  const fills = {}
  real.forEach(p => { const f = (p.getAttribute('fill') || '').toLowerCase(); fills[f] = (fills[f] || 0) + 1 })
  return {
    realPaths: real.length,
    distinctFills: Object.keys(fills).length,
    selected: ps.filter(p => p.getAttribute('data-selected') != null).length,
    occupied: ps.filter(p => p.getAttribute('data-occupied') != null).length,
    occFill: ps.filter(p => p.getAttribute('data-occupied') != null).map(p => (p.getAttribute('fill') || '').toLowerCase())[0] || null,
    selFill: ps.filter(p => p.getAttribute('data-selected') != null).map(p => (p.getAttribute('fill') || '').toLowerCase())[0] || null,
  }
})
await page.locator('#geo-map').screenshot({ path: OUT + '/06-map-multiselect-colours.png' }).catch(() => {})

// comparison hbar height (~560): find the horizontal bar chart canvas height
R.hbar = await page.evaluate(() => {
  const cs = [...document.querySelectorAll('.apexcharts-canvas')]
  const heights = cs.map(c => Math.round(c.getBoundingClientRect().height)).filter(h => h > 100)
  return { canvasHeights: heights, maxHeight: Math.max(0, ...heights) }
})

// <html lang> flip ka -> en
await page.goto(BASE + '/en/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(2500)
R.langFlip = await page.evaluate(() => ({ htmlLang: document.documentElement.lang, url: location.pathname }))

// /ka/accounts scroll
await page.goto(BASE + '/ka/accounts', { waitUntil: 'networkidle', timeout: 45000 }); await S(3500)
R.accounts = await page.evaluate(() => {
  const before = window.scrollY; window.scrollTo(0, 400)
  return { scrollH: document.body.scrollHeight, clientH: document.documentElement.clientHeight, scrolled: window.scrollY - before }
})

R.errs = errs.slice(0, 8)
console.log(JSON.stringify(R, null, 1))
await browser.close()
