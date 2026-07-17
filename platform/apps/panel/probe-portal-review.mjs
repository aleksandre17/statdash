// Portal-review live walk — card 0078, dev geostat :3012
// Run from platform/apps/panel:  node ../../../work/probe-portal-review.mjs
// Gesture-verify, not load-verify: screenshots + DOM facts per review note.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://192.168.1.199:3012'
const OUT = String.raw`C:/Users/Test-User/WebstormProjects/national-accounts/work/portal-walk/`
mkdirSync(OUT, { recursive: true })

const facts = []
const fact = (id, ok, detail) => { facts.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } })
page.setDefaultTimeout(20000)

const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200); for (let i=0;i<6;i++){ await page.mouse.wheel(0,700); await page.waitForTimeout(500) } await page.mouse.wheel(0,-4200); await page.waitForTimeout(800) }
const shot = (name) => page.screenshot({ path: OUT + name + '.png', fullPage: false })

// ── Landing: P1 title/logo · P2 code-free slider labels ─────────────
await page.goto(BASE + '/'); await settle()
await shot('01-landing')
const bodyText = await page.locator('body').innerText()
fact('P2-no-paren-codes', !/\([A-Z][A-Z0-9_.]{2,}\)/.test(bodyText), 'no (CODE)-style parens on landing')

// ── Sidebar hover-expand: P3–4 ──────────────────────────────────────
const nav = page.locator('nav, aside').first()
if (await nav.count()) {
  const before = (await nav.boundingBox())?.width ?? 0
  await nav.hover().catch(() => {})
  await page.waitForTimeout(600)
  const after = (await nav.boundingBox())?.width ?? 0
  fact('P3-sidebar-hover', after > before, `width ${before} → ${after} on hover`)
  await shot('02-sidebar-hover')
  await page.mouse.move(1400, 500); await page.waitForTimeout(600)
}

// ── /gdp: P14 title · P16 no-K axis · P12 brush · tooltip ───────────
await page.goto(BASE + '/ka/gdp'); await settle()
await page.mouse.wheel(0, 600); await page.waitForTimeout(800)
await shot('03-gdp')
const gdpText = await page.locator('body').innerText()
fact('P14-title', gdpText.includes('მთლიანი შიდა პროდუქტის წლიური დინამიკა'), 'GDP annual-dynamics title present')
const axisTexts = await page.locator('.apexcharts-yaxis-label, .apexcharts-yaxis text').allInnerTexts()
const kLabels = axisTexts.filter(t => /\d\s*[Kk]\b/.test(t))
fact('P16-no-K', kLabels.length === 0, kLabels.length ? `K labels: ${kLabels.slice(0, 3).join(', ')}` : `${axisTexts.length} axis labels, none with K`)

// brush companion (P12): a chart area with two apex svgs stacked
const apexCount = await page.locator('.apexcharts-canvas').count()
fact('P12-brush-present', apexCount >= 2, `${apexCount} apex canvases on /gdp`)

// brush drag → main range narrows (best effort)
const brush = page.locator('.apexcharts-canvas').last()
const bb = await brush.boundingBox().catch(() => null)
if (bb) {
  const catsBefore = (await page.locator('.apexcharts-xaxis text').allInnerTexts()).join(',')
  await page.mouse.move(bb.x + bb.width * 0.55, bb.y + bb.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(bb.x + bb.width * 0.85, bb.y + bb.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
  const catsAfter = (await page.locator('.apexcharts-xaxis text').allInnerTexts()).join(',')
  fact('P12-brush-sync', catsAfter !== catsBefore, `x-cats changed: ${catsAfter !== catsBefore}`)
  await shot('04-gdp-brush-dragged')
}

// tooltip: hover a bar on the FIRST (main) chart — series-name row suppressed
const bar = page.locator('.apexcharts-canvas').first().locator('.apexcharts-bar-area, .apexcharts-series path').first()
if (await bar.count()) {
  await bar.hover({ force: true }).catch(() => {})
  await page.waitForTimeout(500)
  const tipText = await page.locator('.apexcharts-tooltip').first().innerText().catch(() => '')
  fact('P14-tooltip', tipText.trim().length > 0, `tooltip: "${tipText.replace(/\n/g, ' | ').slice(0, 90)}"`)
  await shot('05-gdp-tooltip')
}

// ── /accounts: P15 negative floor ───────────────────────────────────
await page.goto(BASE + '/ka/accounts'); await settle()
await page.mouse.wheel(0, 600); await page.waitForTimeout(800)
await shot('06-accounts')

// ── /regional: P17 2010–2024 bars, no empty 2025 · P18 title · P5–9 palette ──
await page.goto(BASE + '/ka/regional'); await settle()
await page.mouse.wheel(0, 600); await page.waitForTimeout(1000)
await shot('07-regional')
const xcats = await page.locator('.apexcharts-xaxis text').allInnerTexts()
const years = xcats.filter(t => /^20\d\d$/.test(String(t||'').trim()))
fact('P17-from-2010', years.includes('2010'), `year cats: ${[...new Set(years)].sort().join(' ')}`)
fact('P17-no-2025', !years.includes('2025'), '2025 absent from category axes')
await page.mouse.wheel(0, 800); await page.waitForTimeout(800)
await shot('08-regional-lower')

console.log('\nFACTS:', JSON.stringify(facts))
await browser.close()
