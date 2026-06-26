// Discover nav routes + capture every page of a version (old reference :5171 or new :3002).
// Usage: BASE=http://127.0.0.1:5171 LOCALE=ka TAG=old node compare-probe.js
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5171'
const LOCALE = process.env.LOCALE || 'ka'
const TAG = process.env.TAG || 'old'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2400 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 160)) })

  await page.goto(`${BASE}/${LOCALE}`, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errs.push('NAV:' + e))
  await page.waitForTimeout(3500)
  // discover in-app nav routes
  const routes = await page.evaluate((loc) => {
    const out = new Set()
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const h = a.getAttribute('href') || ''
      if (h.startsWith(`/${loc}/`) && !h.includes('#')) out.add(h)
    }
    return [...out]
  }, LOCALE)
  await page.screenshot({ path: `/out/${TAG}-landing.png`, fullPage: true }).catch(() => {})

  const report = { tag: TAG, base: BASE, routes, landingErrs: [...errs], pages: {} }
  for (const r of routes.slice(0, 12)) {
    const p = await ctx.newPage()
    const pe = []
    p.on('pageerror', (e) => pe.push(String(e).slice(0, 160)))
    p.on('console', (m) => { if (m.type() === 'error') pe.push('C:' + m.text().slice(0, 160)) })
    const obs = { empty: 0, total: 0 }
    p.on('response', async (rp) => {
      if (rp.url().includes('/observations')) { try { const j = await rp.json(); const n = (j.data || []).length; obs.total++; if (n === 0) obs.empty++ } catch {} }
    })
    try { await p.goto(`${BASE}${r}`, { waitUntil: 'networkidle', timeout: 45000 }); await p.waitForTimeout(3500) } catch (e) { pe.push('NAV:' + e) }
    const svg = await p.locator('svg').count()
    const noData = await p.evaluate(() => (document.body.innerText.match(/No data|არ არის|მონაცემები არ/gi) || []).length)
    const slug = r.replace(/\//g, '_')
    await p.screenshot({ path: `/out/${TAG}${slug}.png`, fullPage: true }).catch(() => {})
    report.pages[r] = { svg, noDataMarkers: noData, obsEmpty: obs.empty, obsTotal: obs.total, errs: pe.slice(0, 4) }
    await p.close()
  }
  await browser.close()
  require('fs').writeFileSync(`/out/${TAG}-report.json`, JSON.stringify(report, null, 2))
  console.log(`REPORT_${TAG} ` + JSON.stringify(report, null, 2))
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
