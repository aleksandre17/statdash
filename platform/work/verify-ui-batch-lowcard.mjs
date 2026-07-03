import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'

const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)

// Measure bars inside the "comparison" section (title contains 'შედარე').
async function measureComparison(tag) {
  return await page.evaluate((tag) => {
    const secs = [...document.querySelectorAll('.section')]
    const comp = secs.find(s => (s.querySelector('[class*="title"], h2, h3')?.textContent || '').includes('შედარე'))
      || secs[secs.length - 1]
    if (!comp) return { tag, found: false }
    const rects = [...comp.querySelectorAll('.apexcharts-bar-area')]
    const plot = comp.querySelector('.apexcharts-inner, .apexcharts-graphical')
    const pbb = plot ? plot.getBBox?.() : null
    const info = rects.slice(0, 6).map(r => {
      const bb = r.getBBox()
      return { w: Math.round(bb.width), h: Math.round(bb.height) }
    })
    // orientation: if bars wider than tall => horizontal (thickness=h); else vertical (thickness=w)
    const first = info[0]
    const horizontal = first ? first.w > first.h : null
    const thickness = first ? (horizontal ? first.h : first.w) : null
    const plotDim = pbb ? (horizontal ? Math.round(pbb.height) : Math.round(pbb.width)) : null
    return { tag, found: true, barCount: rects.length, horizontal, thickness, plotDim,
             fillRatio: (thickness && plotDim) ? +(thickness / plotDim).toFixed(2) : null, bars: info }
  }, tag)
}

console.log('DEFAULT (0 selected):', JSON.stringify(await measureComparison('default')))

// ── Select 1 region: click a map path (Tbilisi if present, else first) ──
async function clickRegion(nameFrag) {
  return await page.evaluate((frag) => {
    const paths = [...document.querySelectorAll('svg path[aria-label]')].filter(p => /·/.test(p.getAttribute('aria-label')||''))
    let target = frag ? paths.find(p => (p.getAttribute('aria-label')||'').includes(frag)) : null
    target = target || paths[0]
    if (!target) return null
    const bb = target.getBoundingClientRect()
    const al = target.getAttribute('aria-label')
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: bb.x + bb.width/2, clientY: bb.y + bb.height/2 }))
    return al
  }, nameFrag)
}

const r1 = await clickRegion('თბილისი')
await page.waitForTimeout(1800)
console.log('SELECTED 1:', r1, '| url:', page.url())
const one = await measureComparison('1-region')
console.log('1 REGION:', JSON.stringify(one))

// screenshot the comparison section at 1-region
const compEl = await page.evaluateHandle(() => {
  const secs = [...document.querySelectorAll('.section')]
  return secs.find(s => (s.querySelector('[class*="title"],h2,h3')?.textContent||'').includes('შედარე')) || secs[secs.length-1]
})
if (compEl.asElement()) { await compEl.asElement().screenshot({ path: SHOTS + '/04-comparison-1region.png' }); console.log('SHOT 04-comparison-1region.png') }

// ── Select 2nd region ──
const r2 = await clickRegion('იმერეთი')
await page.waitForTimeout(1800)
console.log('SELECTED 2:', r2, '| url:', page.url())
const two = await measureComparison('2-region')
console.log('2 REGIONS:', JSON.stringify(two))
if (compEl.asElement()) { await compEl.asElement().screenshot({ path: SHOTS + '/04-comparison-2region.png' }); console.log('SHOT 04-comparison-2region.png') }

// ── Re-capture perspective-tab-group tightly (item 3) on this page ──
const persp = await page.$('.perspective-tab-group')
if (persp) { await persp.screenshot({ path: SHOTS + '/03-perspective-tab-group.png' }); console.log('SHOT 03-perspective-tab-group.png') }

console.log('ERRORS:', errs.length ? JSON.stringify(errs.slice(0,6)) : 'none')
await browser.close()
