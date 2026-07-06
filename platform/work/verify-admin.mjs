// Live verify @ prod :3002 after e354506 — geostat admin review (8 points).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/admin'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1536, height: 1080 }, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('C ' + m.text().slice(0,120)) })
page.on('pageerror', e => errors.push('P ' + String(e.message).slice(0,110)))
const report = {}

// ── 1) LANDING — slider first slide = GDP; card order + deflator ──
await page.goto(`${BASE}/ka`, { waitUntil: 'networkidle' }).catch(()=>{})
await page.waitForTimeout(1800)
report.landing_slide1 = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.featured-card')]
  return { labels: cards.map(c => (c.querySelector('.featured-card__label')?.textContent||'').trim().slice(0,30)),
    values: cards.map(c => (c.querySelector('.featured-card__value, [class*="value"]')?.textContent||'').trim().slice(0,14)),
    trends: cards.map(c => (c.querySelector('.featured-card__trend, [class*="trend"]')?.textContent||'').trim().slice(0,30)) }
})
await page.screenshot({ path: `${OUT}/1-landing-gdp-first.png` })
// advance to regional slide (slide 3) to check %
const next = page.getByRole('button', { name: 'შემდეგი' })
await next.click().catch(()=>{}); await page.waitForTimeout(600)
await next.click().catch(()=>{}); await page.waitForTimeout(600)
report.landing_regional = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.featured-card')]
  return { labels: cards.map(c => (c.querySelector('.featured-card__label')?.textContent||'').trim().slice(0,16)),
    trends: cards.map(c => (c.querySelector('.featured-card__trend, [class*="trend"]')?.textContent||'').trim().slice(0,30)) }
})
await page.screenshot({ path: `${OUT}/2-landing-regional-pct.png` })

// ── 2) GDP PAGE — donut subtitle + numbers, treemap numbers, bar tooltip ──
await page.goto(`${BASE}/ka/gdp`, { waitUntil: 'networkidle' }).catch(()=>{})
await page.waitForTimeout(1800)
report.gdp_page = await page.evaluate(() => {
  const subs = [...document.querySelectorAll('.section__subtitle, [class*="subtitle"]')].map(s => (s.textContent||'').trim().slice(0,40)).filter(Boolean).slice(0,8)
  const apexDataLabels = [...document.querySelectorAll('.apexcharts-datalabels text, .apexcharts-data-labels text')].map(t=>(t.textContent||'').trim()).filter(Boolean).slice(0,10)
  const treemapVals = [...document.querySelectorAll('[class*="treemap" i] [class*="value"], .treemap text')].map(t=>(t.textContent||'').trim()).filter(Boolean).slice(0,10)
  const bodyHasTemplate = /\{fromYear\}|\{toYear\}|\{spanFrom\}|\{spanTo\}|\{periodLabel\}/.test(document.body.innerText)
  return { subtitles: subs, apexDataLabels, bodyHasTemplateLeak: bodyHasTemplate }
})
await page.screenshot({ path: `${OUT}/3-gdp-page.png`, fullPage: true })

// ── 3) REGIONAL PAGE — KPIs (Share in GDP 100%, no double, no 637) ──
await page.goto(`${BASE}/ka/regional`, { waitUntil: 'networkidle' }).catch(()=>{})
await page.waitForTimeout(1800)
report.regional_page = await page.evaluate(() => {
  const kpis = [...document.querySelectorAll('.kpi-card, [class*="kpi-card"]')].map(k => (k.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)).slice(0,6)
  const has637 = /637/.test(document.body.innerText)
  const templateLeak = /\{fromYear\}|\{spanFrom\}|\{spanTo\}/.test(document.body.innerText)
  return { kpis, has637, templateLeak }
})
await page.screenshot({ path: `${OUT}/4-regional-kpis.png` })

report.errors = errors.slice(0, 20)
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
