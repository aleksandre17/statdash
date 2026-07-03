import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'

const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/relocalize'
const hasKa = (s) => /[Ⴀ-ჿ]/.test(s || '')
const onlyLatin = (s) => !hasKa(s) && /[A-Za-z]/.test(s || '')
const out = {}
const log = (k, v) => { out[k] = v; console.log(k, '=>', typeof v === 'object' ? JSON.stringify(v) : v) }

const waitApp = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForSelector('.kpi-strip, .geo-map, .section__head', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e)))

try {
  // ─────────── ITEM 1: HEADLINE — locale re-localize on CLIENT TOGGLE ───────────
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  // sentinel to prove NO full reload happened across the toggle
  await page.evaluate(() => { window.__noReload = 'SENTINEL_' + Date.now() })
  const sentinelBefore = await page.evaluate(() => window.__noReload)

  const capture = async () => page.evaluate(() => {
    const mapLabels = [...document.querySelectorAll('.geo-map path[aria-label]')]
      .map(p => p.getAttribute('aria-label')).filter(Boolean)
    const kpiLabels = [...document.querySelectorAll('.kpi-label')].map(e => e.textContent.trim())
    const kpiUnits  = [...document.querySelectorAll('.kpi-unit')].map(e => e.textContent.trim())
    const kpiSubs   = [...document.querySelectorAll('.kpi-trend-sub, .kpi-note')].map(e => e.textContent.trim())
    const legend    = [...document.querySelectorAll('.apexcharts-legend-text')].map(e => e.textContent.trim())
    const cats      = [...document.querySelectorAll('.apexcharts-xaxis-texts-g text, .apexcharts-yaxis-texts-g text')].map(e => e.textContent.trim())
    return { mapLabels, kpiLabels, kpiUnits, kpiSubs, legend, cats }
  })

  const before = await capture()
  await page.screenshot({ path: `${SHOTS}/01a-toggle-before-ka.png`, fullPage: true })
  log('1.before.mapLabel[0]', before.mapLabels[0])
  log('1.before.kpiLabel[0]', before.kpiLabels[0])
  log('1.before.kpiUnit[0]',  before.kpiUnits[0])
  log('1.before.legend',      before.legend.slice(0, 4))
  log('1.before.kpiSub[0]',   before.kpiSubs[0])

  // click the ENG (english) locale button — client-side nav, NO reload
  const btns = await page.$$('.locale-switcher__btn')
  let engBtn = null
  for (const b of btns) {
    const txt = (await b.textContent()).trim()
    if (/eng|en/i.test(txt) && !hasKa(txt)) engBtn = b
  }
  log('1.locale-switcher.labels', await Promise.all(btns.map(async b => (await b.textContent()).trim())))
  if (!engBtn) throw new Error('ENG locale button not found')
  await engBtn.click()
  await page.waitForTimeout(2000) // client re-localize, no reload
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)

  const sentinelAfter = await page.evaluate(() => window.__noReload)
  const noReload = sentinelBefore && sentinelBefore === sentinelAfter
  log('1.NO_RELOAD (sentinel survived toggle)', noReload)

  const after = await capture()
  await page.screenshot({ path: `${SHOTS}/01b-toggle-after-en.png`, fullPage: true })
  log('1.after.mapLabel[0]', after.mapLabels[0])
  log('1.after.kpiLabel[0]', after.kpiLabels[0])
  log('1.after.kpiUnit[0]',  after.kpiUnits[0])
  log('1.after.legend',      after.legend.slice(0, 4))
  log('1.after.kpiSub[0]',   after.kpiSubs[0])

  // ASSERTIONS — the three headline groups must flip ka→en IN PLACE
  const mapFlipped   = before.mapLabels.some(hasKa) && after.mapLabels.length > 0 && after.mapLabels.every(l => !hasKa(l))
  const kpiFlipped   = before.kpiLabels.some(hasKa) && after.kpiLabels.length > 0 && after.kpiLabels.every(l => !hasKa(l))
  const unitFlipped  = before.kpiUnits.join('') !== after.kpiUnits.join('')
  const legendFlipped = before.legend.length && after.legend.length
        ? (before.legend.some(hasKa) ? after.legend.every(l => !hasKa(l)) : 'no-ka-legend-before')
        : 'no-legend'
  const catsFlipped  = before.cats.length && after.cats.length
        ? (before.cats.some(hasKa) ? after.cats.every(l => !hasKa(l)) : 'no-ka-cats-before')
        : 'no-cats'
  log('1.ASSERT.map_label_flipped_no_reload', mapFlipped)
  log('1.ASSERT.kpi_label_flipped_no_reload', kpiFlipped)
  log('1.ASSERT.kpi_unit_flipped', unitFlipped)
  log('1.ASSERT.chart_legend_flipped', legendFlipped)
  log('1.ASSERT.chart_category_flipped', catsFlipped)

  // ─────────── ITEM 2: perspective-tab-group flush LEFT ───────────
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  const persp = await page.evaluate(() => {
    const g = document.querySelector('.perspective-tab-group')
    if (!g) return null
    const gb = g.getBoundingClientRect()
    // nearest layout container above it
    let p = g.parentElement
    const pb = p.getBoundingClientRect()
    const cs = getComputedStyle(g)
    return { groupLeft: Math.round(gb.left), groupWidth: Math.round(gb.width),
             parentLeft: Math.round(pb.left), parentWidth: Math.round(pb.width),
             alignSelf: cs.alignSelf, justify: cs.justifyContent, marginInlineStart: cs.marginInlineStart }
  })
  log('2.perspective', persp)
  log('2.ASSERT.flush_left (group hugs left, not right-anchored)',
    persp ? (persp.groupLeft - persp.parentLeft) < (persp.parentWidth - persp.groupWidth) / 2 : 'no-perspective-bar')
  await page.screenshot({ path: `${SHOTS}/02-perspective-flush-left.png`, fullPage: true })

  // ─────────── ITEM 3: KPI-strip ONE freshness badge, no per-card P pills ───────────
  // GDP page has the only preliminary slice (2025) → the strip-level freshness badge shows
  await page.goto(`${BASE}/ka/gdp`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  const kpiKa = await page.evaluate(() => ({
    freshnessBadges: document.querySelectorAll('.kpi-strip__freshness').length,
    freshnessLabel: document.querySelector('.kpi-strip__freshness-label')?.textContent?.trim() || null,
    perCardPills: document.querySelectorAll('.kpi-card .kpi-prelim, .kpi-card .kpi-pill, .kpi-card [data-prelim]').length,
    cards: document.querySelectorAll('.kpi-card').length,
  }))
  log('3.kpi.ka', kpiKa)
  await page.screenshot({ path: `${SHOTS}/03a-kpi-freshness-ka.png`, fullPage: true })
  // dark mode
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/03b-kpi-freshness-dark.png`, fullPage: true })
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.classList.remove('dark') })
  log('3.ASSERT.one_freshness_badge_no_percard_pill', kpiKa.freshnessBadges <= 1 && kpiKa.perCardPills === 0)

  // ─────────── ITEM 4: section header order link · info · preliminary · toggle ───────────
  const secOrder = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.section__head')]
    // pick a head that has a view-toggle (interactive section)
    for (const h of heads) {
      const actions = h.querySelector('.section__actions')
      if (!actions) continue
      const kids = [...actions.children].map(c => {
        if (c.classList.contains('section__view-toggle')) return 'toggle'
        if (c.classList.contains('section__integrity')) return 'preliminary'
        if (c.classList.contains('section__icon-btn')) return 'info'
        if (c.tagName === 'BUTTON' || c.querySelector('a,button')) return 'link'
        return c.className || c.tagName
      })
      if (kids.includes('toggle')) return kids
    }
    return null
  })
  log('4.section.actions.order', secOrder)
  log('4.ASSERT.toggle_is_last', secOrder ? secOrder[secOrder.length - 1] === 'toggle' : 'no-toggle-section')
  log('4.ASSERT.prelim_before_toggle', secOrder && secOrder.includes('preliminary')
      ? secOrder.indexOf('preliminary') < secOrder.indexOf('toggle') : 'no-prelim-on-page')

  // ─────────── ITEM 5: range from→to template ───────────
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  // enter dynamics/range perspective
  const dynBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('.perspective-tab-btn')]
    return btns.find(b => /დინამ|dynam/i.test(b.textContent)) || btns[btns.length - 1] || null
  })
  const dynEl = dynBtn.asElement()
  let rangeKa = null, rangeEn = null
  if (dynEl) {
    await dynEl.click()
    await page.waitForTimeout(1500)
    rangeKa = await page.evaluate(() => {
      const r = document.querySelector('.filter-control__range')
      if (!r) return null
      return { text: r.textContent.trim(),
               words: [...r.querySelectorAll('.filter-range-word')].map(w => w.textContent.trim()) }
    })
    log('5.range.ka', rangeKa)
    await page.screenshot({ path: `${SHOTS}/05a-range-ka.png`, fullPage: true })
    // toggle to EN in place
    const btns2 = await page.$$('.locale-switcher__btn')
    for (const b of btns2) { const t = (await b.textContent()).trim(); if (/eng|en/i.test(t) && !hasKa(t)) { await b.click(); break } }
    await page.waitForTimeout(1800)
    rangeEn = await page.evaluate(() => {
      const r = document.querySelector('.filter-control__range')
      if (!r) return null
      return { text: r.textContent.trim(),
               words: [...r.querySelectorAll('.filter-range-word')].map(w => w.textContent.trim()) }
    })
    log('5.range.en', rangeEn)
    await page.screenshot({ path: `${SHOTS}/05b-range-en.png`, fullPage: true })
  }
  log('5.ASSERT.ka_postposition_dan_mde', rangeKa ? (rangeKa.words.includes('დან') && rangeKa.words.includes('მდე')) : 'no-range-control')
  log('5.ASSERT.en_preposition_from_to', rangeEn ? (rangeEn.words.some(w => /from/i.test(w)) && rangeEn.words.some(w => /^to$/i.test(w))) : 'no-range-control')

  // ─────────── ITEM 6: hero title one line + spacing ───────────
  await page.goto(`${BASE}/ka`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const hero = await page.evaluate(() => {
    const t = document.querySelector('.hero__title, .hero-title, [class*="hero"] h1, h1')
    if (!t) return null
    const cs = getComputedStyle(t)
    const rect = t.getBoundingClientRect()
    const lh = parseFloat(cs.lineHeight) || rect.height
    return { text: t.textContent.trim(), height: Math.round(rect.height),
             lineHeight: Math.round(lh), whiteSpace: cs.whiteSpace,
             lines: Math.round(rect.height / (lh || rect.height)) }
  })
  log('6.hero', hero)
  log('6.ASSERT.title_one_line', hero ? hero.lines <= 1 : 'no-hero-title')
  await page.screenshot({ path: `${SHOTS}/06-hero.png`, fullPage: true })

  // ─────────── ITEM 7: NON-REGRESSION ───────────
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  const mapReg = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('.geo-map path')]
    const real = paths.filter(p => { const d = p.getAttribute('d') || ''; return d.length > 8 && d !== 'M0 0' && !/^M0 0/.test(d) })
    return { total: paths.length, real: real.length, degenerate: paths.length - real.length }
  })
  log('7.map.regional', mapReg)
  log('7.ASSERT.map_renders', mapReg.real >= 10)
  await page.screenshot({ path: `${SHOTS}/07a-map-regional.png`, fullPage: true })

  await page.goto(`${BASE}/ka/gdp`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  const treemap = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.apexcharts-treemap rect, .apexcharts-series-treemap rect').length,
    dataLabels: [...document.querySelectorAll('.apexcharts-treemap text, .apexcharts-datalabels text')].map(t => t.textContent.trim()).filter(Boolean).slice(0, 6),
  }))
  log('7.treemap.gdp', treemap)
  log('7.ASSERT.income_treemap_renders', treemap.tiles >= 4)
  await page.screenshot({ path: `${SHOTS}/07b-income-treemap-gdp.png`, fullPage: true })

  await page.goto(`${BASE}/en/regional`, { waitUntil: 'domcontentloaded' })
  await waitApp(page)
  const enRoute = await page.evaluate(() => {
    const bag = [...document.querySelectorAll('.kpi-label, .section__title, .kpi-unit, .apexcharts-legend-text')].map(e => e.textContent.trim())
    const kaLeak = bag.filter(t => /[Ⴀ-ჿ]/.test(t))
    return { htmlLang: document.documentElement.lang, sampled: bag.length, kaLeak, kaLeakCount: kaLeak.length }
  })
  log('7.en-route.load', enRoute)
  log('7.ASSERT.en_route_no_ka_leak', enRoute.kaLeakCount === 0 && enRoute.htmlLang === 'en')
  await page.screenshot({ path: `${SHOTS}/07c-en-regional-route.png`, fullPage: true })

  log('pageErrors', pageErrors)
} catch (e) {
  console.error('FATAL', e)
  log('FATAL', String(e))
} finally {
  await browser.close()
  console.log('\n=====RESULT_JSON=====')
  console.log(JSON.stringify(out, null, 0))
}
