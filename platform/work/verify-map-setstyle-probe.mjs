// Diagnostic: after the blank toggle-back, does a window resize (→ Leaflet
// invalidateSize) re-project the paths? Isolates "needs a re-projection nudge"
// vs "permanently blank". Also tests toggle-back WITHOUT any select (old P1).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/map-setstyle'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
let errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 160)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)))
const mapState = () => {
  const c = document.querySelector('#geo-map .leaflet-container')
  if (!c) return { present: false }
  const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
  const bad = d => !d || /^M0 0z?$/i.test((d||'').trim()) || (d||'').trim().length < 12
  const ds = paths.map(p => p.getAttribute('d') || '')
  return { pathCount: paths.length, real: ds.filter(d => !bad(d)).length, degen: ds.filter(bad).length }
}
const click = (reStr) => {
  const rx = new RegExp(reStr, 'i')
  const b = Array.from(document.querySelectorAll('#geo-map button')).find(x => rx.test((x.textContent||'').trim()))
  if (b) { b.click(); return true } return false
}
const clickRow = (i) => { const rows = Array.from(document.querySelectorAll('#geo-map tbody tr')); if(!rows.length) return false; (rows[i%rows.length].querySelector('td')||rows[i%rows.length]).click(); return true }
const settle = ms => page.waitForTimeout(ms)
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await settle(5000)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1500)
const R = {}
R.baseline = await page.evaluate(mapState)

// --- Case 1: toggle WITHOUT select (old-P1 equivalent) ---
await page.evaluate(() => window.__c = null)
await page.evaluate(click, 'ცხრილ|table'); await settle(1800)
await page.evaluate(click, 'რუქა|map'); await settle(2500)
R.toggleNoSelect = await page.evaluate(mapState)

// --- Case 2: reload, table→select-while-hidden→map (blank path) ---
await page.reload({ waitUntil: 'networkidle' }); await settle(5000)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1200)
await page.evaluate(click, 'ცხრილ|table'); await settle(1800)
await page.evaluate(clickRow, 1); await settle(1500)
await page.evaluate(click, 'რუქა|map'); await settle(2800)
R.afterSelectToggle = await page.evaluate(mapState)

// --- Case 3: now nudge with a real window resize (→ Leaflet invalidateSize) ---
await page.setViewportSize({ width: 1441, height: 1000 }); await settle(1200)
await page.setViewportSize({ width: 1440, height: 1000 }); await settle(1800)
R.afterResizeNudge = await page.evaluate(mapState)

// --- Case 4: explicit imperative invalidateSize via leaflet (does it heal?) ---
R.hasLeafletHandle = await page.evaluate(() => {
  const c = document.querySelector('#geo-map .leaflet-container')
  return !!(c && c._leaflet_id)
})
await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await settle(1500)
R.afterResizeEvent = await page.evaluate(mapState)

console.log('baseline', JSON.stringify(R.baseline))
console.log('toggleNoSelect (old-P1)', JSON.stringify(R.toggleNoSelect))
console.log('afterSelectToggle (blank path)', JSON.stringify(R.afterSelectToggle))
console.log('afterResizeNudge (setViewport)', JSON.stringify(R.afterResizeNudge))
console.log('afterResizeEvent (dispatch resize)', JSON.stringify(R.afterResizeEvent))
console.log('errors', errors.length, errors.slice(0,4))
await browser.close()
