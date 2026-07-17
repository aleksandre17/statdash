// FINAL WALK — card 0078 close-out. Run from platform/apps/panel after the dev redeploy.
// Covers: landing (3 slides, codes) · rail (flush + no-reflow) · gdp year+dynamics (retitle, no-K,
// brush present+drag, tooltip, legend font) · regional (multiselect dupes, dynamics 2010–2024) · accounts.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://192.168.1.199:3012'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/work/portal-walk/final/'
mkdirSync(OUT, { recursive: true })
const facts = []
const fact = (id, ok, detail) => { facts.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } })
page.setDefaultTimeout(20000)
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0, 120)))
const settle = async (ms = 2000) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms) }
const shot = n => page.screenshot({ path: OUT + n + '.png' })

// ── Landing: all 3 slides ─────────────────────────────────────────────
await page.goto(BASE + '/'); await settle()
for (let s = 1; s <= 3; s++) {
  const codes = [...new Set((await page.locator('body').innerText()).match(/\([A-Z][A-Z0-9_.]{1,6}\)/g) || [])]
  fact(`landing-slide${s}-no-codes`, codes.length === 0, codes.join(',') || 'clean')
  await shot(`landing-s${s}`)
  const next = page.locator('button[aria-label*=next], [class*=arrow]').last()
  if (await next.count()) { await next.click().catch(() => {}); await page.waitForTimeout(1000) }
}

// ── Rail: flush + no reflow ──────────────────────────────────────────
await page.goto(BASE + '/ka/gdp'); await settle()
const rail = page.locator('aside, nav').first()
const rb = await rail.boundingBox()
fact('rail-flush', rb.x === 0, `rail x=${rb.x}`)
const h1b = await page.locator('h1').first().boundingBox()
await rail.hover(); await page.waitForTimeout(700)
const h1a = await page.locator('h1').first().boundingBox()
fact('rail-no-reflow', Math.abs(h1a.x - h1b.x) < 1, `h1 dx=${h1a.x - h1b.x}`)
await shot('rail-hovered')
await page.mouse.move(1400, 500); await page.waitForTimeout(500)

// ── GDP year mode: legend font uniformity ────────────────────────────
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(400) }
const fonts = await page.evaluate(() =>
  [...new Set([...document.querySelectorAll('.apexcharts-legend-text, .donut-legend__label')]
    .map(el => getComputedStyle(el).fontSize))])
fact('legend-font-uniform', fonts.length <= 1, `sizes: ${fonts.join(',') || 'none mounted'}`)
await shot('gdp-year')

// ── GDP dynamics: retitle · no-K · brush present + drag narrows ──────
await page.mouse.wheel(0, -3500); await page.waitForTimeout(500)
await page.locator('text=დინამიკა').first().click(); await settle(3500)
fact('gdp-retitle', (await page.locator('text=მთლიანი შიდა პროდუქტის წლიური დინამიკა').count()) > 0, 'retitled chart present')
const axisTexts = await page.locator('.apexcharts-yaxis text').allInnerTexts()
fact('no-K-axis', axisTexts.filter(t => /\d\s*[Kk]\b/.test(t || '')).length === 0, `${axisTexts.length} labels`)
const canv = await page.locator('.apexcharts-canvas').count()
fact('gdp-dyn-charts', canv >= 4, `${canv} canvases`)
const grip = page.locator('.apexcharts-selection-rect ~ g .svg_select_points_r, .svg_select_points_r').last()
if (await grip.count()) {
  const ticksBefore = (await page.locator('.apexcharts-xaxis text').allInnerTexts()).length
  const gb = await grip.boundingBox()
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2)
  await page.mouse.down(); await page.mouse.move(gb.x - 200, gb.y + gb.height / 2, { steps: 8 }); await page.mouse.up()
  await page.waitForTimeout(1200)
  const ticksAfter = (await page.locator('.apexcharts-xaxis text').allInnerTexts()).length
  fact('brush-narrows', ticksAfter < ticksBefore, `x-ticks ${ticksBefore}→${ticksAfter}`)
} else fact('brush-narrows', false, 'no brush grip found')
await shot('gdp-dynamics')

// ── Regional: multiselect + dynamics ─────────────────────────────────
await page.goto(BASE + '/ka/regional'); await settle()
const msTrigger = page.locator('main').locator('text=ყველა').first()
if (await msTrigger.count()) {
  await msTrigger.click().catch(() => {}); await page.waitForTimeout(800)
  const opts = (await page.locator('[role=option]').allInnerTexts()).map(o => o.trim()).filter(Boolean)
  const dup = opts.filter((o, i) => opts.indexOf(o) !== i)
  fact('multiselect-no-dupes', opts.length > 0 && dup.length === 0, `${opts.length} options, dupes: ${dup.join(',') || 'none'}`)
  await shot('regional-multiselect')
  await page.keyboard.press('Escape')
}
await page.locator('text=დინამიკა').first().click(); await settle(3000)
const txt = await page.locator('body').innerText()
fact('regional-2010', txt.includes('2010'), '2010 visible in dynamics')
fact('regional-no-2025-badge', !/2010–2025/.test(txt), 'range badge ends 2024')
await shot('regional-dynamics')

// ── Accounts (0079 watch) ────────────────────────────────────────────
await page.goto(BASE + '/ka/accounts'); await settle(3000)
await page.locator('text=დინამიკა').first().click().catch(() => {}); await settle(3000)
fact('accounts-dyn-charts', (await page.locator('.apexcharts-canvas').count()) > 0, `${await page.locator('.apexcharts-canvas').count()} canvases (0079 pre-existing if 0 in year mode)`)
await shot('accounts')

fact('zero-pageerrors', errs.length === 0, errs.join(' | ') || 'clean')
console.log('\nSUMMARY:', facts.filter(f => f.ok).length + '/' + facts.length, 'pass')
await browser.close()
