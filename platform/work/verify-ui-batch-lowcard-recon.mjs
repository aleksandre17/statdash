import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'

const BASE = 'http://192.168.1.199:3002'
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)

// Recon: filter bar controls, section titles, apex bar geometry
const recon = await page.evaluate(() => {
  const controls = [...document.querySelectorAll('select, [role="combobox"], [role="listbox"], button')]
    .map(el => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), cls: (el.className||'').toString().slice(0,40), txt: (el.textContent||'').trim().slice(0,30) }))
    .filter(c => c.txt || c.role)
    .slice(0, 40)
  const sections = [...document.querySelectorAll('.section')].map(s => {
    const t = s.querySelector('[class*="title"], h2, h3')
    return (t ? (t.textContent||'').trim().slice(0,40) : '?')
  })
  // apex bars
  const barGroups = [...document.querySelectorAll('.apexcharts-bar-series, .apexcharts-bar-area')].length
  const rects = [...document.querySelectorAll('.apexcharts-bar-area')].slice(0,10).map(r => ({
    w: +(+r.getAttribute('barWidth') || r.getBBox?.().width || 0).toFixed(0),
    h: +(+r.getAttribute('barHeight') || r.getBBox?.().height || 0).toFixed(0),
  }))
  return { url: location.href, controls, sections, barGroups, rects }
})
console.log('REGIONAL RECON:', JSON.stringify(recon, null, 2))

// Look for map region paths (d3-geo) to enable click-select
const mapInfo = await page.evaluate(() => {
  const paths = [...document.querySelectorAll('svg path[data-geo], svg path[data-region], .geo-region, path[aria-label]')]
  return { count: paths.length, sample: paths.slice(0,3).map(p => ({ al: p.getAttribute('aria-label'), dg: p.getAttribute('data-geo'), dr: p.getAttribute('data-region') })) }
})
console.log('MAP PATHS:', JSON.stringify(mapInfo))
await browser.close()
