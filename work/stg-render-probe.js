// Staging render probe — verifies the front DRAWS the real canonical data (ADR-0032 acceptance gate).
// Runs inside mcr.microsoft.com/playwright attached to statdash-stg-net → hits statdash-stg-geostat.
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://statdash-stg-geostat'
const PAGES = ['gdp', 'accounts', 'regional']

;(async () => {
  const browser = await chromium.launch()
  const report = {}
  for (const slug of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 } })
    const page = await ctx.newPage()
    const consoleErrors = []
    const pageErrors = []
    const obs = [] // { url, rows, distinctTimes, fanout }
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))
    const apiCalls = []
    page.on('response', async (r) => {
      const u = r.url()
      if (u.includes('/api/')) apiCalls.push(u.split('/api/')[1].split('?')[0])
      if (u.includes('/api/stats/observations') || u.includes('/observations')) {
        try {
          const j = await r.json()
          const rows = Array.isArray(j.data) ? j.data : []
          const times = new Set(rows.map((x) => x.time_period))
          obs.push({ url: u.split('?')[1]?.slice(0, 90) || '', rows: rows.length, distinctTimes: times.size, fanout: rows.length > times.size })
        } catch { /* non-json */ }
      }
    })
    try {
      await page.goto(`${BASE}/en/${slug}`, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(4000)
    } catch (e) { pageErrors.push('NAV: ' + String(e).slice(0, 150)) }
    const svg = await page.locator('svg').count()
    const canvas = await page.locator('canvas').count()
    // KPI heuristic: elements whose text looks like a formatted number
    const numericTexts = await page.evaluate(() => {
      const out = []
      for (const el of Array.from(document.querySelectorAll('*'))) {
        if (el.children.length === 0) {
          const t = (el.textContent || '').trim()
          if (/^[-+]?[\d\s.,]+%?$/.test(t) && /\d/.test(t) && t.length <= 14) out.push(t)
        }
      }
      return out.slice(0, 12)
    })
    const bodyLen = (await page.evaluate(() => document.body.innerText.length)) || 0
    await page.screenshot({ path: `/out/${slug}.png`, fullPage: true }).catch(() => {})
    report[slug] = { svg, canvas, kpiSamples: numericTexts, bodyTextLen: bodyLen, obsCalls: obs.length,
      obsEmpty: obs.filter((o) => o.rows === 0).length, obsFanout: obs.filter((o) => o.fanout).map((o) => o.url),
      apiCalls: [...new Set(apiCalls)].slice(0, 10),
      consoleErrors: consoleErrors.slice(0, 6), pageErrors: pageErrors.slice(0, 6) }
    await ctx.close()
  }
  await browser.close()
  require('fs').writeFileSync('/out/result.json', JSON.stringify(report, null, 2))
  console.log('PROBE_RESULT ' + JSON.stringify(report, null, 2))
})().catch((e) => { console.error('PROBE_FATAL', e); process.exit(1) })
