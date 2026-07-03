// Fresh-load map-CLICK selection path: click a polygon on the rendered map,
// assert selection (region param) + highlight change. No table involved.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/map-setstyle'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' })).newPage()
let errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0,140)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0,140)))
const settle = ms => page.waitForTimeout(ms)
const region = () => page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await settle(5000)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await settle(1500)
const before = await region()
// pick a real polygon and its center in page coords
const target = await page.evaluate(() => {
  const c = document.querySelector('#geo-map .leaflet-container')
  const paths = Array.from(c.querySelectorAll('path.leaflet-interactive')).filter(p => { const d = p.getAttribute('d')||''; return d.length > 12 && !/^M0 0/i.test(d) })
  if (!paths.length) return null
  // choose a mid-size polygon to hit reliably
  const p = paths[Math.floor(paths.length/2)]
  const b = p.getBoundingClientRect()
  return { x: Math.round(b.x + b.width/2), y: Math.round(b.y + b.height/2), n: paths.length }
})
let clickState = { target }
if (target) {
  await page.mouse.click(target.x, target.y); await settle(2500)
  const after = await region()
  const fills = await page.evaluate(() => {
    const c = document.querySelector('#geo-map .leaflet-container')
    const paths = Array.from(c.querySelectorAll('path.leaflet-interactive'))
    const f = paths.map(p => p.getAttribute('fill') || '')
    const tally = f.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{})
    const bad = d => !d || /^M0 0/i.test((d||'').trim()) || (d||'').trim().length<12
    return { tally, real: paths.map(p=>p.getAttribute('d')||'').filter(d=>!bad(d)).length, total: paths.length }
  })
  clickState = { target, before, after, selectionChanged: before !== after, fills }
  const clip = await page.evaluate(() => { const e = document.querySelector('#geo-map'); const r = e.getBoundingClientRect(); return { x: Math.max(0,r.x), y: Math.max(0,r.y), width: Math.min(1440-Math.max(0,r.x), r.width), height: Math.min(1000-Math.max(0,r.y), r.height) } })
  await page.screenshot({ path: OUT + '/D-mapclick-fresh.png', clip })
}
console.log('mapClickFresh', JSON.stringify(clickState))
console.log('errors', errors.length, errors.slice(0,3))
await browser.close()
