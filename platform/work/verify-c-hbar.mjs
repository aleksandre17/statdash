// Focused C: comparison hbar height ~380 (not a 240 sliver). Select a region via
// MAP CLICK (keeps map alive — avoids the A crash path), expand panels, measure the
// "regional comparison" apex hbar height + screenshot. Also re-confirm sector colours.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/regression-fix'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1400 }, locale: 'ka-GE' })).newPage()
const R = {}
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(5000)
// select a region by clicking a map path (State B) — does NOT hide the map
await page.evaluate(() => document.querySelector('#geo-map .leaflet-container')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(1000)
try { await page.locator('#geo-map .leaflet-container path.leaflet-interactive').nth(4).click({ force: true, timeout: 5000 }) } catch {}
await page.waitForTimeout(2500)
R.regionParam = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
// expand any collapsed panels (click panel headers whose body is collapsed)
await page.evaluate(() => {
  document.querySelectorAll('.panel').forEach(p => {
    const head = p.querySelector('.panel__head, [class*="head"]')
    const collapsed = p.querySelector('[class*="collapsed"]') || (p.className.includes('collapsed'))
    // click the collapse chevron if the panel body is not visible
    const body = p.querySelector('.panel__body, [class*="body"]')
    if (body && (body.offsetParent === null || body.getBoundingClientRect().height < 20)) {
      const chevron = head?.querySelector('button:last-of-type, [class*="collapse"], [aria-label*="expand"], [aria-label*="collapse"]')
      if (chevron) chevron.click()
    }
  })
})
await page.waitForTimeout(2000)
// measure every apex canvas + its owning panel title + horizontal detection
R.apex = await page.evaluate(() => Array.from(document.querySelectorAll('.apexcharts-canvas')).map(c => {
  const rect = c.getBoundingClientRect()
  const panel = c.closest('.panel')
  const title = (panel?.querySelector('.panel__title, [class*="title"], h2, h3')?.textContent || '').trim().slice(0, 50)
  const bar = c.querySelector('path.apexcharts-bar-area')
  let barShape = null, horizontal = null
  if (bar) { const b = bar.getBoundingClientRect(); barShape = { w: Math.round(b.width), h: Math.round(b.height) }; horizontal = b.width > b.height }
  const wrap = c.closest('.chart-wrap')
  const wrapStyle = wrap ? { maxHeight: getComputedStyle(wrap).maxHeight, overflowY: getComputedStyle(wrap).overflowY, height: Math.round(wrap.getBoundingClientRect().height) } : null
  const seriesFills = Array.from(new Set(Array.from(c.querySelectorAll('.apexcharts-series path.apexcharts-bar-area')).map(p => (p.getAttribute('fill') || '').toLowerCase()).filter(Boolean)))
  return { title, canvasHeight: Math.round(rect.height), canvasWidth: Math.round(rect.width), horizontal, barShape, wrapStyle, seriesFillsDistinct: seriesFills }
}))
// full-page + focused comparison panel screenshot
await page.evaluate(() => { const els = Array.from(document.querySelectorAll('.panel')); const cmp = els.find(p => /comparison|შედარ/i.test(p.textContent || '')); cmp?.scrollIntoView({ block: 'center' }) })
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT + '/C-comparison-hbar.png', fullPage: true })
writeFileSync(OUT + '/_C_report.json', JSON.stringify(R, null, 1))
console.log('DONE'); console.log(JSON.stringify(R.apex, null, 1))
await browser.close()
