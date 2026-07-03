// i18n LEAK-PROOF verify (AR-37 P1/P2). Headline: engine-resolved fields (KPI labels, units,
// section titles, badges) must TRACK the active locale. Previously they stayed Georgian-only
// regardless of /en vs /ka. Now: /en app content = NO Georgian codepoints; /ka = Georgian.
// Known residual (NOT a failure): de-tenanted RUNNER chrome (EmptyState "No data", ExportBar)
// still renders English on /ka — flagged owner-decision, excluded from the leak assertion.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
mkdirSync(OUT, { recursive: true })
const GEO = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/ // Georgian mkhedmuli + extended
const browser = await chromium.launch({ headless: true })
const S = ms => new Promise(r => setTimeout(r, ms))

// Probe the ENGINE-RESOLVED fields specifically (not the runner chrome).
const probeEngineFields = () => {
  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const uniq = a => [...new Set(a.filter(Boolean))]
  const GEOL = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
  // KPI cards: labels + units
  const kpiEls = [...document.querySelectorAll('[class*="kpi" i]')]
  const kpiLabels = uniq(kpiEls.flatMap(k => [...k.querySelectorAll('[class*="label" i],[class*="title" i],dt,.kpi-card__label')].map(txt)))
  const kpiUnits = uniq(kpiEls.flatMap(k => [...k.querySelectorAll('[class*="unit" i],[class*="suffix" i],[class*="caption" i]')].map(txt)))
  // Section titles (the section node header, not panel)
  const sectionTitles = uniq([...document.querySelectorAll('section > header h1, section > header h2, section > header h3, [class*="section" i] > header [class*="title" i], [class*="section-header" i] [class*="title" i], [class*="SectionHeader" i]')].map(txt))
  // Panel titles
  const panelTitles = uniq([...document.querySelectorAll('[class*="panel" i] header [class*="title" i], [class*="panel" i] > [class*="title" i], [class*="panel-header" i]')].map(txt))
  // Badges / integrity indicators / methodology disclosure
  const badges = uniq([...document.querySelectorAll('[class*="badge" i],[class*="integrity" i],[class*="status" i],[class*="prelim" i],[class*="methodology" i]')].map(txt).filter(t => t.length < 60))
  // Generic headings in main content (excluding chrome header/footer/nav + emptystate/exportbar)
  const mainHeadings = uniq([...document.querySelectorAll('main h1, main h2, main h3, main h4')]
    .filter(h => !h.closest('header[class*="app" i], nav, footer, [class*="empty" i], [class*="export" i], [class*="EmptyState" i]'))
    .map(txt))
  const collect = { kpiLabels, kpiUnits, sectionTitles, panelTitles, badges, mainHeadings }
  // Georgian-codepoint audit per field group
  const geoAudit = {}
  for (const [k, arr] of Object.entries(collect)) geoAudit[k] = arr.filter(t => GEOL.test(t))
  return { fields: collect, geoAudit }
}

const flip = (page, to) => page.evaluate((to) => {
  // find locale switcher control; click the option matching target locale
  const btns = [...document.querySelectorAll('button, a, [role="button"], select')]
  const want = to === 'en' ? /^en$|english|ინგლ/i : /^ka$| georgian|ქართ/i
  for (const b of btns) { if (want.test((b.textContent || '').trim()) || want.test(b.getAttribute('aria-label') || '')) { b.click(); return 'clicked:' + (b.textContent||'').trim() } }
  // fallback: a <select> locale switcher
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => /^(en|ka)$/i.test(o.value)))
  if (sel) { const o = [...sel.options].find(o => o.value.toLowerCase() === to); if (o) { const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set; setter.call(sel,o.value); sel.dispatchEvent(new Event('change',{bubbles:true})); return 'select:' + o.value } }
  return 'not-found'
}, to)

const run = async (route) => {
  const R = { route }
  for (const loc of ['ka', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1900 }, locale: loc === 'ka' ? 'ka-GE' : 'en-US' })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', e => errs.push('PE ' + String(e.message).slice(0, 100)))
    await page.goto(`${BASE}/${loc}${route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{})
    await S(4000)
    // scroll to hydrate lazy panels
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)) } window.scrollTo(0, 0) })
    await S(1500)
    R[loc] = await page.evaluate(probeEngineFields)
    R[loc].htmlLang = await page.evaluate(() => document.documentElement.lang)
    R[loc].errs = errs.slice(0, 5)
    const shot = `${OUT}/${route.replace(/\//g,'_')||'_root'}-${loc}.png`
    await page.screenshot({ path: shot, fullPage: true }).catch(()=>{})
    R[loc].shot = shot
    await ctx.close()
  }
  return R
}

// toggle test on /regional: load /ka, flip to en, assert engine fields flip
const toggleTest = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1900 }, locale: 'ka-GE' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{})
  await S(3500)
  const before = await page.evaluate(probeEngineFields)
  const flipRes = await flip(page, 'en')
  await S(3000)
  const url = page.url()
  const after = await page.evaluate(probeEngineFields)
  await page.screenshot({ path: `${OUT}/toggle-ka-to-en.png`, fullPage: true }).catch(()=>{})
  await ctx.close()
  return { flipRes, urlAfter: url, beforeKpi: before.fields.kpiLabels, afterKpi: after.fields.kpiLabels, beforeGeoLeak: before.geoAudit, afterGeoLeak: after.geoAudit }
}

const OUTALL = { regional: await run('/regional'), gdp: await run('/gdp'), accounts: await run('/accounts'), toggle: await toggleTest() }
writeFileSync(`${OUT}/_i18n-leak-report.json`, JSON.stringify(OUTALL, null, 1))
// Compact verdict
const verdict = {}
for (const r of ['regional','gdp','accounts']) {
  const en = OUTALL[r].en, ka = OUTALL[r].ka
  const enLeaks = Object.entries(en.geoAudit).filter(([,v])=>v.length).map(([k,v])=>`${k}:${v.length}`)
  const kaHasGeo = Object.entries(ka.geoAudit).filter(([,v])=>v.length).map(([k])=>k)
  verdict[r] = { en_georgianLeaks: enLeaks.length?enLeaks:'NONE', en_leakSamples: Object.values(en.geoAudit).flat().slice(0,4), ka_georgianFields: kaHasGeo, htmlLang: {ka:ka.htmlLang, en:en.htmlLang} }
}
console.log(JSON.stringify({ verdict, toggle: { flipRes: OUTALL.toggle.flipRes, urlAfter: OUTALL.toggle.urlAfter, afterEnGeoLeak: Object.entries(OUTALL.toggle.afterGeoLeak).filter(([,v])=>v.length) } }, null, 1))
await browser.close()
