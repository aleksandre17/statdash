// Patient in-app toggle: /ka/regional -> click ENG -> wait -> screenshot + full content scan.
// Determines whether client-side locale nav re-resolves engine panel content (KPI labels).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
const browser = await chromium.launch({ headless: true })
const S = ms => new Promise(r => setTimeout(r, ms))
const G = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, locale: 'ka-GE' })
const page = await ctx.newPage()
const scan = () => page.evaluate(() => {
  const txt = el => (el?.textContent||'').replace(/\s+/g,' ').trim()
  const kpi = [...new Set([...document.querySelectorAll('[class*="kpi" i] [class*="label" i]')].map(txt).filter(Boolean))]
  const sect = [...new Set([...document.querySelectorAll('.section__title')].map(txt).filter(Boolean))]
  const nav = [...new Set([...document.querySelectorAll('nav a, header a')].map(txt).filter(Boolean))].slice(0,4)
  return { htmlLang: document.documentElement.lang, url: location.href, kpi, sect, nav }
})
await page.goto(`${BASE}/ka/regional`, { waitUntil:'networkidle', timeout:45000 }); await S(4000)
const before = await scan()
await page.evaluate(() => { const b=[...document.querySelectorAll('.locale-switcher__btn')].find(x=>/eng|ინგ/i.test((x.textContent||'').trim())); b && b.click() })
await S(6000)
const after = await scan()
await page.screenshot({ path: `${OUT}/toggle-patient-after-EN.png`, fullPage: false }).catch(()=>{})
const G2 = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
console.log(JSON.stringify({
  before: { lang: before.htmlLang, url: before.url, kpiGeo: before.kpi.some(t=>G2.test(t)), nav: before.nav },
  after: { lang: after.htmlLang, url: after.url, kpi: after.kpi, kpiGeo: after.kpi.some(t=>G2.test(t)), sect: after.sect, sectGeo: after.sect.some(t=>G2.test(t)), nav: after.nav, navGeo: after.nav.some(t=>G2.test(t)) },
}, null, 1))
await browser.close()
