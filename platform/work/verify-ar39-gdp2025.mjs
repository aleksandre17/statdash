// AR-39 consolidated integrity indicator — the ONLY preliminary slice in prod is
// GDP_ANNUAL/2025 (24 'P' obs). Navigate /gdp, select year 2025 -> a section rendering
// 2025 must show ONE .section__integrity (header), NO scattered per-panel pills, and a
// reachable disclosure (.section__methodology w/ .section__integrity-note).
// ALSO: in-app locale toggle using the real 'ENG'/'ქარ' short labels.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const S = ms => new Promise(r => setTimeout(r, ms))

const setYear = (yr) => page => page.evaluate((yr) => {
  const selects = [...document.querySelectorAll('select')]
  for (const s of selects) {
    const opt = [...s.options].find(o => (o.value === yr || (o.textContent||'').trim() === yr))
    if (opt) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(s, opt.value); s.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true, chosen: opt.value }
    }
  }
  return { ok: false, selects: selects.map(s => [...s.options].map(o=>o.value).slice(0,10)) }
}, yr)

const probeIntegrity = () => page => page.evaluate(() => {
  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sections = [...document.querySelectorAll('section')].filter(s => s.querySelector('.section__head'))
  return sections.map(s => {
    const head = s.querySelector('.section__head')
    const body = s.querySelector('.section__body')
    const consolidated = [...(head?.querySelectorAll('.section__integrity')||[])]
    // scattered = any preliminary badge inside body that is NOT a section__integrity
    const scattered = body ? [...body.querySelectorAll('[class*="badge" i],[class*="prelim" i]')].filter(e => /prelim|წინასწარ/i.test(txt(e))).length : 0
    // the integrity/info disclosure button: aria-label mentions integrity/data (not permalink)
    const infoBtns = [...(head?.querySelectorAll('.section__icon-btn')||[])].map(b => b.getAttribute('aria-label'))
    return {
      title: txt(s.querySelector('.section__title')).slice(0,44),
      consolidatedCount: consolidated.length,
      consolidatedLabel: txt(consolidated[0]),
      scatteredPrelimPills: scattered,
      infoBtnAriaLabels: infoBtns,
    }
  })
})

const R = {}
// ── AR-39 on GDP 2025 ──
for (const loc of ['ka','en']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2100 }, locale: loc==='ka'?'ka-GE':'en-US' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/${loc}/gdp`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{})
  await S(3800)
  const yr = await setYear('2025')(page)
  await S(3000)
  await page.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80))} window.scrollTo(0,0) })
  await S(1200)
  const sections = await probeIntegrity()(page)
  // open the disclosure on a section that HAS a consolidated indicator
  const opened = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find(s => s.querySelector('.section__head .section__integrity'))
    if (!sec) return { found:false }
    // find the info button whose aria-label is the integrity disclosure (not permalink)
    const btn = [...sec.querySelectorAll('.section__head .section__icon-btn')].find(b => /integ|data|инфо|Information|ინფორ|მთლიან|მონაცემ/i.test(b.getAttribute('aria-label')||'')) || sec.querySelector('.section__head .section__icon-btn')
    if (!btn) return { found:true, btn:false }
    btn.scrollIntoView({ block:'center' }); btn.click()
    return { found:true, clickedAria: btn.getAttribute('aria-label'), title:(sec.querySelector('.section__title')?.textContent||'').trim().slice(0,44) }
  })
  await S(1200)
  const disclosure = await page.evaluate(() => {
    const m = document.querySelector('.section__methodology')
    if (!m) return { open:false }
    return { open:true, hasIntegrityNote: !!m.querySelector('.section__integrity-note'),
      integrityNoteText: (m.querySelector('.section__integrity-note')?.textContent||'').replace(/\s+/g,' ').trim() }
  })
  await page.screenshot({ path: `${OUT}/ar39-gdp2025-${loc}.png`, fullPage: true }).catch(()=>{})
  R[loc] = { yearSet: yr, sections, opened, disclosure }
  await ctx.close()
}

// ── in-app locale TOGGLE (real labels ENG / ქარ) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 }, locale: 'ka-GE' })
  const page = await ctx.newPage()
  const G = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
  const snap = () => page.evaluate(() => {
    const txt = el => (el?.textContent||'').replace(/\s+/g,' ').trim()
    return { htmlLang: document.documentElement.lang,
      kpi: [...new Set([...document.querySelectorAll('[class*="kpi" i] [class*="label" i]')].map(txt).filter(Boolean))].slice(0,5),
      active: ([...document.querySelectorAll('.locale-switcher__btn')].find(b=>b.getAttribute('aria-current')==='true')||{}).textContent }
  })
  await page.goto(`${BASE}/ka/regional`, { waitUntil:'networkidle', timeout:45000 }); await S(3800)
  const before = await snap()
  const clickEng = await page.evaluate(() => { const b=[...document.querySelectorAll('.locale-switcher__btn')].find(x=>/eng|^en$|ინგ/i.test((x.textContent||'').trim())); if(!b)return{ok:false}; b.click(); return {ok:true} })
  await S(3200)
  const afterEng = await snap(); const urlEng = page.url()
  const clickKa = await page.evaluate(() => { const b=[...document.querySelectorAll('.locale-switcher__btn')].find(x=>/^ka$|ქარ/i.test((x.textContent||'').trim())); if(!b)return{ok:false}; b.click(); return {ok:true} })
  await S(3200)
  const afterKa = await snap()
  R.toggle = { before, clickEng, afterEng: { ...afterEng, url: urlEng, kpiHasGeorgian: afterEng.kpi.some(t=>G.test(t)) }, clickKa, afterKa: { ...afterKa, kpiHasGeorgian: afterKa.kpi.some(t=>G.test(t)) } }
  await ctx.close()
}

writeFileSync(`${OUT}/_ar39-gdp2025-report.json`, JSON.stringify(R, null, 1))
console.log(JSON.stringify(R, null, 1))
await browser.close()
