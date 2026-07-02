import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const browser = await chromium.launch({ headless: true })
// force Georgian locale to rule out Accept-Language artifact
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })

// ── A) LOCALE re-check on /ka/gdp ──
await page.goto(BASE + '/ka/gdp', { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(3500)
const loc = await page.evaluate(() => ({
  htmlLang: document.documentElement.lang,
  url: location.href,
  firstTitle: document.querySelector('.section__title')?.textContent.trim(),
  navText: Array.from(document.querySelectorAll('nav a, header a')).slice(0, 6).map(a => a.textContent.trim()).filter(Boolean),
}))
console.log('LOCALE /ka/gdp =>', JSON.stringify(loc))

// ── B) inner DOM of a "NONE" donut section (structural) + a bar section (growth-dynamics baseline) ──
async function dump(id) {
  await page.evaluate(s => { const e = document.getElementById(s); if (e) e.scrollIntoView({ block: 'center' }) }, id)
  await page.waitForTimeout(2500)
  return page.evaluate((s) => {
    const el = document.getElementById(s); if (!el) return { id: s, found: false }
    const q = (sel) => el.querySelectorAll(sel).length
    const toggles = Array.from(el.querySelectorAll('button, [role="tab"], [aria-pressed], [role="radio"]')).map(b => ({
      t: (b.textContent || '').trim().slice(0, 12), pressed: b.getAttribute('aria-pressed'), sel: b.getAttribute('aria-selected'), cls: b.className.slice(0, 40) }))
    return { id: s, found: true,
      apexCanvas: q('.apexcharts-canvas'), svg: q('svg'), canvas: q('canvas'),
      tables: q('table'), rows: q('tbody tr'), chartWrap: q('.chart-wrap'),
      skeleton: q('[class*="skeleton"], [class*="Skeleton"]'),
      emptyState: q('.empty-state, [class*="EmptyState"], [class*="empty"]'),
      toggles, innerLen: el.innerHTML.length,
      textSample: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160) }
  }, id)
}
console.log('SECTION structural =>', JSON.stringify(await dump('structural')))
console.log('SECTION production =>', JSON.stringify(await dump('production')))
console.log('SECTION income =>', JSON.stringify(await dump('income')))
console.log('SECTION growth-dynamics =>', JSON.stringify(await dump('growth-dynamics')))

// ── C) map region single-click diagnostic on /ka/regional ──
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(4000)
await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)
const pre = await page.evaluate(() => ({
  paths: document.querySelectorAll('.leaflet-container path.leaflet-interactive').length,
  mapBox: (() => { const m = document.querySelector('.leaflet-container'); if (!m) return null; const r = m.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
  overlays: Array.from(document.querySelectorAll('.leaflet-container')).map(m => m.querySelectorAll('.leaflet-interactive').length),
}))
console.log('MAP pre =>', JSON.stringify(pre))
// try Playwright locator click (does hit-testing + scroll) on nth path
async function tryLocator(i) {
  const before = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
  try { await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }) } catch (e) { return { i, err: e.message.split('\n')[0] } }
  await page.waitForTimeout(1200)
  const after = await page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
  const paths = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
  return { i, before, after, changed: before !== after, pathsNow: paths }
}
console.log('CLICK nth0 =>', JSON.stringify(await tryLocator(0)))
console.log('CLICK nth5 =>', JSON.stringify(await tryLocator(5)))
// inspect a path element for event wiring hints
const pinfo = await page.evaluate(() => {
  const p = document.querySelector('.leaflet-container path.leaflet-interactive')
  if (!p) return null
  const r = p.getBoundingClientRect()
  return { aria: p.getAttribute('aria-label'), cls: p.getAttribute('class'), pe: getComputedStyle(p).pointerEvents, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
})
console.log('PATH0 =>', JSON.stringify(pinfo))
await browser.close()
