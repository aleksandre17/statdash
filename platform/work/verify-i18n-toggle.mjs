// In-app locale TOGGLE (AR-37): click .locale-switcher__btn EN while on /ka/regional,
// assert engine fields flip Georgian->English (and back). Complements the route-level proof.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const S = ms => new Promise(r => setTimeout(r, ms))
const GEOL = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/

const snap = () => page => page.evaluate(() => {
  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const kpiLabels = [...new Set([...document.querySelectorAll('[class*="kpi" i] [class*="label" i],[class*="kpi" i] [class*="title" i]')].map(txt).filter(Boolean))]
  const panelTitles = [...new Set([...document.querySelectorAll('[class*="panel" i] [class*="title" i]')].map(txt).filter(Boolean))]
  const switcher = [...document.querySelectorAll('.locale-switcher__btn')].map(b => ({ txt:(b.textContent||'').trim(), active: b.getAttribute('aria-current')==='true' }))
  return { htmlLang: document.documentElement.lang, kpiLabels: kpiLabels.slice(0,6), panelTitles: panelTitles.slice(0,4), switcher }
})
const G = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
const anyGeo = arr => arr.some(t => G.test(t))

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 }, locale: 'ka-GE' })
const page = await ctx.newPage()
const R = {}
await page.goto(`${BASE}/ka/regional`, { waitUntil: 'networkidle', timeout: 45000 })
await S(4000)
R.beforeKa = await snap()(page)
R.beforeKa_hasGeo = { kpi: anyGeo(R.beforeKa.kpiLabels), panels: anyGeo(R.beforeKa.panelTitles) }

// click EN
R.clickEn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.locale-switcher__btn')].find(x => /^en$/i.test((x.textContent||'').trim()))
  if (!b) return { ok:false, found:[...document.querySelectorAll('.locale-switcher__btn')].map(x=>x.textContent.trim()) }
  b.click(); return { ok:true }
})
await S(3500)
R.afterEn = await snap()(page)
R.afterEn_url = page.url()
R.afterEn_hasGeo = { kpi: anyGeo(R.afterEn.kpiLabels), panels: anyGeo(R.afterEn.panelTitles) }
await page.screenshot({ path: `${OUT}/toggle-after-EN.png`, fullPage: true }).catch(()=>{})

// click KA back
R.clickKa = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.locale-switcher__btn')].find(x => /^ka$/i.test((x.textContent||'').trim()))
  if (!b) return { ok:false }
  b.click(); return { ok:true }
})
await S(3500)
R.afterKa = await snap()(page)
R.afterKa_hasGeo = { kpi: anyGeo(R.afterKa.kpiLabels), panels: anyGeo(R.afterKa.panelTitles) }

console.log(JSON.stringify(R, null, 1))
await ctx.close(); await browser.close()
