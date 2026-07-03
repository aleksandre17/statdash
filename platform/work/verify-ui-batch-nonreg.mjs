import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'
const KA = /[Ⴀ-ჿ]/

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))

// ── i18n: /en English ──────────────────────────────────────────────────
await page.goto(BASE + '/en/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)
const en = await page.evaluate((KAsrc) => {
  const KA = new RegExp(KAsrc, 'u')
  const htmlLang = document.documentElement.lang
  const scan = (sel) => [...document.querySelectorAll(sel)].map(e => (e.textContent||'').trim()).filter(Boolean)
  const titles = scan('.section [class*="title"], h1, h2, .kpi-label, [class*="kpi"] [class*="label"]').slice(0, 20)
  const leaks = titles.filter(t => KA.test(t))
  return { htmlLang, sampleTitles: titles.slice(0, 8), georgianLeaks: leaks.slice(0, 6), leakCount: leaks.length }
}, KA.source)
console.log('EN /en/regional:', JSON.stringify(en, null, 2))
await page.screenshot({ path: SHOTS + '/05-regional-en.png' })

// ── i18n: /ka Georgian ─────────────────────────────────────────────────
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)
const ka = await page.evaluate(() => {
  const KA = /[Ⴀ-ჿ]/
  const titles = [...document.querySelectorAll('.section [class*="title"], h1, h2')].map(e => (e.textContent||'').trim()).filter(Boolean)
  return { htmlLang: document.documentElement.lang, georgian: titles.some(t => KA.test(t)), sample: titles.slice(0,4) }
})
console.log('KA /ka/regional:', JSON.stringify(ka))

// ── Map non-regression: table → select region while map HIDDEN → toggle back ──
// 1. switch the map/composition panel to TABLE view, 2. select a region, 3. toggle back to chart(map)
async function mapPathCount() {
  return await page.evaluate(() => {
    const paths = [...document.querySelectorAll('svg path[aria-label]')].filter(p => /·/.test(p.getAttribute('aria-label')||''))
    const real = paths.filter(p => { const d = p.getAttribute('d')||''; return d.length > 12 && !/^M0 0/.test(d) })
    return { total: paths.length, real: real.length }
  })
}
console.log('MAP fresh:', JSON.stringify(await mapPathCount()))

// Find the map section (has the geo map), toggle to table, select a region via table, toggle back.
const storm = await page.evaluate(() => {
  // find section containing an svg map (path with aria-label containing ·)
  const secs = [...document.querySelectorAll('.section')]
  const mapSec = secs.find(s => s.querySelector('svg path[aria-label]'))
  if (!mapSec) return { ok:false, reason:'no map section' }
  const tableBtn = [...mapSec.querySelectorAll('button')].find(b => /ცხრილი/.test(b.textContent||''))
  const chartBtn = [...mapSec.querySelectorAll('button')].find(b => /დიაგრამა/.test(b.textContent||''))
  if (tableBtn) tableBtn.click()
  return { ok:true, hadTable: !!tableBtn, hadChart: !!chartBtn }
})
console.log('toggle-to-table:', JSON.stringify(storm))
await page.waitForTimeout(1200)
// select a region while map hidden (click a table row if present)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr, [role="row"]')]
  const r = rows.find(x => /·|,/.test(x.textContent||'') && (x.textContent||'').length < 60) || rows[1] || rows[0]
  if (r) (r.querySelector('td,[role="cell"],button,a') || r).click()
})
await page.waitForTimeout(1000)
// toggle back to chart(map)
await page.evaluate(() => {
  const secs = [...document.querySelectorAll('.section')]
  const mapSec = secs.find(s => [...s.querySelectorAll('button')].some(b=>/დიაგრამა/.test(b.textContent||'')))
  const chartBtn = mapSec && [...mapSec.querySelectorAll('button')].find(b => /დიაგრამა/.test(b.textContent||''))
  if (chartBtn) chartBtn.click()
})
await page.waitForTimeout(2000)
const afterStorm = await mapPathCount()
console.log('MAP after table->select-hidden->toggle-back:', JSON.stringify(afterStorm))
await page.screenshot({ path: SHOTS + '/05-map-nonreg-after-hidden-select.png' })

console.log('ERRORS:', errs.length ? JSON.stringify(errs.slice(0,6)) : 'none')
await browser.close()
