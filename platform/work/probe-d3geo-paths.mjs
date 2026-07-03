import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1700 }, locale: 'ka-GE' })).newPage()
const S = ms => page.waitForTimeout(ms)
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await S(4500)
await page.evaluate(() => document.querySelector('#geo-map')?.scrollIntoView({ block: 'center' })); await S(1200)
const out = await page.evaluate(() => {
  const svg = document.querySelector('#geo-map svg.geo-map__svg')
  const paths = [...svg.querySelectorAll('path.geo-map__region')]
  return {
    viewBox: svg.getAttribute('viewBox'),
    svgRect: (() => { const r = svg.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })(),
    paths: paths.map((p, i) => {
      let bb = null
      try { const b = p.getBBox(); bb = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } } catch {}
      const d = p.getAttribute('d') || ''
      return {
        i,
        iso: p.getAttribute('aria-label')?.slice(0, 18),
        fill: (p.getAttribute('fill') || '').toLowerCase(),
        occupied: p.getAttribute('data-occupied') != null,
        selected: p.getAttribute('data-selected') != null,
        dLen: d.length,
        dHead: d.slice(0, 40),
        bbox: bb,
      }
    }),
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
