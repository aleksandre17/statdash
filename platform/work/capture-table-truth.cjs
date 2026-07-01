// Ground-truth capture: MAIN table on /ka/accounts
// Saves to platform/work/table-truth/
// CJS to avoid Windows ESM path resolution issues
'use strict'

const playwright = require('C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const { mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

const BASE = 'http://192.168.1.199:3002'
const OUT = join(__dirname, 'table-truth')
mkdirSync(OUT, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadPage(browser, width, height) {
  height = height || 900
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1
  })
  const page = await ctx.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  try {
    await page.goto(BASE + '/ka/accounts', { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    console.warn('WARN goto timeout —', e.message.split('\n')[0])
  }

  // Wait for charts / tables to settle
  await sleep(2500)
  return { ctx, page, errs }
}

async function ensureTableView(page) {
  // If a chart/table toggle exists with text "ცხრილი" (Georgian: table), click it
  const toggleBtns = await page.$$('button.panel__view-btn, [class*="view-btn"], [class*="panel__tab"]')
  for (const btn of toggleBtns) {
    const text = await btn.innerText().catch(() => '')
    if (text.includes('ცხრილი') || text.toLowerCase().includes('table')) {
      await btn.click()
      await sleep(800)
      console.log('  toggled to table view, btn text:', text.trim())
      break
    }
  }
}

async function collectDomFacts(page) {
  return await page.evaluate(() => {
    // ── locate main table wrap ────────────────────────────────────────────
    var wrap = document.querySelector('.data-table__wrap')
        || document.querySelector('[class*="data-table__wrap"]')
        || document.querySelector('[class*="table-wrap"]')

    if (!wrap) {
      // fallback: find the table's nearest horizontally-scrollable ancestor
      var t = document.querySelector('table')
      if (t) {
        var node = t.parentElement
        while (node && node !== document.body) {
          var s = getComputedStyle(node)
          if (s.overflowX === 'auto' || s.overflowX === 'scroll') { wrap = node; break }
          node = node.parentElement
        }
        if (!wrap) wrap = t.parentElement
      }
    }

    var table = document.querySelector('table')
    var thead = table && table.querySelector('thead')
    var theadRows = thead ? thead.querySelectorAll('tr').length : 0
    var thCount = thead ? thead.querySelectorAll('th').length : 0

    // ── overflow ──────────────────────────────────────────────────────────
    var scrollWidth = wrap ? wrap.scrollWidth : document.documentElement.scrollWidth
    var clientWidth = wrap ? wrap.clientWidth : document.documentElement.clientWidth
    var overflows = scrollWidth > clientWidth
    var computedOverflowX = wrap ? getComputedStyle(wrap).overflowX : 'n/a'
    var hasScrollFancy = wrap ? wrap.classList.contains('scroll-fancy') : false
    var wrapClass = wrap ? wrap.className : 'NOT_FOUND'

    // ── sticky header ─────────────────────────────────────────────────────
    var firstTh = thead && thead.querySelector('th')
    var thPosition = firstTh ? getComputedStyle(firstTh).position : 'n/a'
    var thTopBefore = firstTh ? Math.round(firstTh.getBoundingClientRect().top) : null

    // ── component type: SimpleTable (1 row) vs PivotTable (2 rows) ───────
    var componentType = theadRows === 2 ? 'PivotTable (2 thead rows)'
        : theadRows === 1 ? 'SimpleTable (1 thead row)'
        : 'UNKNOWN (' + theadRows + ' thead rows)'

    // ── column alignment: col[1] and widest col ───────────────────────────
    var tbody = table && table.querySelector('tbody')
    var col1HeaderLeft = null, col1BodyLeft = null
    var widestHeaderLeft = null, widestBodyLeft = null
    var widestColIdx = null

    if (thead && tbody) {
      var headerCols = Array.from(thead.querySelector('tr:last-child')
          ? thead.querySelectorAll('tr:last-child th')
          : thead.querySelectorAll('th'))
      var bodyFirstRow = tbody.querySelector('tr')
      var bodyCols = bodyFirstRow ? Array.from(bodyFirstRow.querySelectorAll('td')) : []

      if (headerCols[1]) col1HeaderLeft = Math.round(headerCols[1].getBoundingClientRect().left)
      if (bodyCols[1]) col1BodyLeft = Math.round(bodyCols[1].getBoundingClientRect().left)

      var maxW = 0
      headerCols.forEach(function(th, i) {
        if (th.offsetWidth > maxW) { maxW = th.offsetWidth; widestColIdx = i }
      })
      if (widestColIdx !== null && headerCols[widestColIdx])
        widestHeaderLeft = Math.round(headerCols[widestColIdx].getBoundingClientRect().left)
      if (widestColIdx !== null && bodyCols[widestColIdx])
        widestBodyLeft = Math.round(bodyCols[widestColIdx].getBoundingClientRect().left)
    }

    return {
      wrapClass: wrapClass,
      scrollWidth: scrollWidth,
      clientWidth: clientWidth,
      overflows: overflows,
      computedOverflowX: computedOverflowX,
      hasScrollFancy: hasScrollFancy,
      thPosition: thPosition,
      thTopBefore: thTopBefore,
      theadRows: theadRows,
      thCount: thCount,
      componentType: componentType,
      col1HeaderLeft: col1HeaderLeft,
      col1BodyLeft: col1BodyLeft,
      col1Aligned: (col1HeaderLeft !== null && col1BodyLeft !== null)
          ? (col1HeaderLeft === col1BodyLeft)
          : 'n/a',
      widestColIdx: widestColIdx,
      widestHeaderLeft: widestHeaderLeft,
      widestBodyLeft: widestBodyLeft,
      widestAligned: (widestHeaderLeft !== null && widestBodyLeft !== null)
          ? (widestHeaderLeft === widestBodyLeft)
          : 'n/a'
    }
  })
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
let facts1440, thTopAfter

;(async () => {
  const browser = await playwright.chromium.launch({ headless: true })

  // ── [1/4] 1440 light ────────────────────────────────────────────────────────
  console.log('\n--- [1/4] 1440 light ---')
  const { ctx: ctx1, page: page1, errs: errs1 } = await loadPage(browser, 1440)
  await ensureTableView(page1)

  await page1.screenshot({ path: join(OUT, 'accounts_main_1440.png'), fullPage: true })
  console.log('  saved accounts_main_1440.png')

  facts1440 = await collectDomFacts(page1)
  console.log('  DOM facts (pre-scroll):', JSON.stringify(facts1440, null, 2))
  console.log('  errs:', errs1.slice(0, 3))

  // ── [2/4] scroll 180px → screenshot (header freeze test) ─────────────────
  console.log('\n--- [2/4] 1440 scrolled 180px ---')
  thTopAfter = await page1.evaluate(() => {
    var wrap = document.querySelector('.data-table__wrap')
        || document.querySelector('[class*="data-table__wrap"]')
        || document.querySelector('[class*="table-wrap"]')

    if (wrap) {
      wrap.scrollTop += 180
    } else {
      window.scrollBy(0, 180)
    }

    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        var th = document.querySelector('thead th')
        resolve(th ? Math.round(th.getBoundingClientRect().top) : null)
      })
    })
  })

  await sleep(300)
  // viewport-only screenshot to show the actual visible frozen header state
  await page1.screenshot({ path: join(OUT, 'accounts_main_1440_scrolled.png'), fullPage: false })
  console.log('  saved accounts_main_1440_scrolled.png')
  console.log('  th.top BEFORE scroll:', facts1440.thTopBefore)
  console.log('  th.top AFTER  scroll:', thTopAfter)
  const frozen = (facts1440.thTopBefore !== null && thTopAfter !== null)
      ? (Math.abs(facts1440.thTopBefore - thTopAfter) < 5 ? 'YES (frozen)' : 'NO (moved ' + Math.abs(facts1440.thTopBefore - thTopAfter) + 'px)')
      : 'UNKNOWN'
  console.log('  header frozen:', frozen)

  await ctx1.close()

  // ── [3/4] 768 viewport ──────────────────────────────────────────────────────
  console.log('\n--- [3/4] 768 light ---')
  const { ctx: ctx3, page: page3, errs: errs3 } = await loadPage(browser, 768)
  await ensureTableView(page3)
  await page3.screenshot({ path: join(OUT, 'accounts_main_768.png'), fullPage: true })
  console.log('  saved accounts_main_768.png')
  await ctx3.close()

  // ── [4/4] 1440 dark ─────────────────────────────────────────────────────────
  console.log('\n--- [4/4] 1440 dark ---')
  const { ctx: ctx4, page: page4, errs: errs4 } = await loadPage(browser, 1440)
  await ensureTableView(page4)

  // Try theme switcher first; fall back to data-theme dataset
  await page4.evaluate(() => {
    var switcher = document.querySelector(
      '[class*="theme-switch"] button,[class*="theme-toggle"],[data-testid*="theme"],[aria-label*="theme"],[aria-label*="dark"]'
    )
    if (switcher) {
      switcher.click()
    } else {
      document.documentElement.dataset.theme = 'dark'
    }
  })
  await sleep(800)

  await page4.screenshot({ path: join(OUT, 'accounts_main_dark_1440.png'), fullPage: true })
  console.log('  saved accounts_main_dark_1440.png')
  console.log('  errs:', errs4.slice(0, 3))
  await ctx4.close()

  // ── Final: write facts JSON ───────────────────────────────────────────────
  const frozen2 = (facts1440.thTopBefore !== null && thTopAfter !== null)
      ? (Math.abs(facts1440.thTopBefore - thTopAfter) < 5 ? 'YES' : 'NO')
      : 'UNKNOWN'

  const report = {
    capturedAt: new Date().toISOString(),
    files: [
      join(OUT, 'accounts_main_1440.png'),
      join(OUT, 'accounts_main_1440_scrolled.png'),
      join(OUT, 'accounts_main_768.png'),
      join(OUT, 'accounts_main_dark_1440.png')
    ],
    facts1440,
    thTopBefore: facts1440.thTopBefore,
    thTopAfter,
    headerFrozen: frozen2
  }
  writeFileSync(join(OUT, 'accounts_main_facts.json'), JSON.stringify(report, null, 2))
  console.log('\nFACTS JSON → table-truth/accounts_main_facts.json')

  await browser.close()
  console.log('\nALL_DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
