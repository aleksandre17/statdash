// AR-39 — ONE consolidated data-integrity indicator per section (not scattered per-panel pills).
// Consolidated indicator = .section__integrity (header) + reachable disclosure via
// .section__icon-btn (aria-label=data-integrity) -> .section__methodology w/ .section__integrity-note.
// Per-panel prelim pills must be SUPPRESSED inside a section body.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/i18n-deploy'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const S = ms => new Promise(r => setTimeout(r, ms))

const probeSections = () => page => page.evaluate(() => {
  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sections = [...document.querySelectorAll('section.section, section[class*="section" i], .section__block')]
    .filter(s => s.querySelector('.section__head'))
  return sections.map(s => {
    const head = s.querySelector('.section__head')
    const integrityIndicators = [...s.querySelectorAll('.section__integrity')] // header consolidated
    const integrityInHeader = head ? [...head.querySelectorAll('.section__integrity')].length : 0
    const infoBtn = s.querySelector('.section__icon-btn')
    // per-panel scattered pills inside body: any prelim-labelled badge NOT the consolidated one
    const body = s.querySelector('.section__body')
    const scatteredPills = body ? [...body.querySelectorAll('[class*="badge" i],[class*="prelim" i],[class*="preliminary" i]')]
      .filter(e => !e.closest('.section__integrity') && /prelim|წინასწარ|провизор/i.test(txt(e))).length : 0
    return {
      title: txt(s.querySelector('.section__title')).slice(0, 40),
      consolidatedIndicators: integrityIndicators.length,
      integrityInHeader,
      indicatorLabel: txt(integrityIndicators[0]),
      hasInfoBtn: !!infoBtn,
      infoAriaLabel: infoBtn?.getAttribute('aria-label') || null,
      scatteredPrelimPills: scatteredPills,
    }
  })
})

const run = async (loc) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2000 }, locale: loc === 'ka' ? 'ka-GE' : 'en-US' })
  const page = await ctx.newPage()
  const R = { loc }
  await page.goto(`${BASE}/${loc}/regional`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{})
  await S(4000)
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)) } window.scrollTo(0, 0) })
  await S(1200)
  R.sections = await probeSections()(page)
  // pick a preliminary section (or any with an info btn) and open its disclosure
  const target = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('section')].filter(s => s.querySelector('.section__icon-btn'))
    const withPrelim = secs.find(s => s.querySelector('.section__integrity')) || secs[0]
    if (!withPrelim) return { found: false }
    withPrelim.querySelector('.section__icon-btn').scrollIntoView({ block: 'center' })
    withPrelim.querySelector('.section__icon-btn').click()
    return { found: true, title: (withPrelim.querySelector('.section__title')?.textContent||'').trim().slice(0,40) }
  })
  await S(1200)
  R.disclosureTarget = target
  R.disclosure = await page.evaluate(() => {
    const m = document.querySelector('.section__methodology')
    if (!m) return { open: false }
    return {
      open: true,
      hasIntegrityNote: !!m.querySelector('.section__integrity-note'),
      integrityNoteText: (m.querySelector('.section__integrity-note')?.textContent||'').replace(/\s+/g,' ').trim(),
      source: (m.querySelector('.section__methodology-note')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,80),
      metaRows: [...m.querySelectorAll('.section__methodology-meta')].map(p => (p.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)),
    }
  })
  await page.screenshot({ path: `${OUT}/ar39-integrity-${loc}.png`, fullPage: true }).catch(()=>{})
  await ctx.close()
  return R
}

const OUTALL = { ka: await run('ka'), en: await run('en') }
writeFileSync(`${OUT}/_ar39-report.json`, JSON.stringify(OUTALL, null, 1))
console.log(JSON.stringify(OUTALL, null, 1))
await browser.close()
