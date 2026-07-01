// Ground-truth capture: MAIN table on /ka/accounts
// Saves to platform/work/table-truth/
import { chromium } from 'C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE = 'http://192.168.1.199:3002'
const OUT = new URL('./table-truth/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadPage(browser, width, height = 900) {
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
  await page.waitForTimeout(2500)
  return { ctx, page, errs }
}

async function ensureTableView(page) {
  // If there's a chart/table toggle button showing "ცხრილი" (table), click it
  // Selector: panel__view-btn containing "ცხრილი"
  const toggleBtns = await page.$$('button.panel__view-btn, [class*="view-btn"]')
  for (const btn of toggleBtns) {
    const text = await btn.innerText().catch(() => '')
    if (text.includes('ცხრილი') || text.toLowerCase().includes('table')) {
      await btn.click()
      await page.waitForTimeout(600)
      break
    }
  }
}

async function findMainTableContainer(page) {
  // Strategy: find the panel with the largest / first data table
  // Look for .data-table__wrap, or the first <table> inside a panel
  const wrap = await page.$('.data-table__wrap')
  if (wrap) return wrap

  // fallback: first table element
  const tbl = await page.$('table')
  if (tbl) {
    // Return the nearest scrollable ancestor
    return await page.evaluateHandle(el => {
      let node = el.parentElement
      while (node && node !== document.body) {
        const s = getComputedStyle(node)
        if (s.overflowX === 'auto' || s.overflowX === 'scroll' ||
            s.overflowY === 'auto' || s.overflowY === 'scroll') return node
        node = node.parentElement
      }
      return el.closest('[class*="panel__body"],[class*="panel-body"]') || el.parentElement
    }, tbl)
  }
  return null
}

async function collectDomFacts(page) {
  return await page.evaluate(() => {
    // ── find main table wrap ──────────────────────────────────────────────
    const wrap = document.querySelector('.data-table__wrap')
        || document.querySelector('[class*="data-table"]')
        || document.querySelector('[class*="table-wrap"]')
        || (() => {
          const t = document.querySelector('table')
          if (!t) return null
          let node = t.parentElement
          while (node && node !== document.body) {
            const s = getComputedStyle(node)
            if (s.overflowX === 'auto' || s.overflowX === 'scroll') return node
            node = node.parentElement
          }
          return t.parentElement
        })()

    const table = document.querySelector('table')
    const thead = table?.querySelector('thead')
    const theadRows = thead ? thead.querySelectorAll('tr').length : 0
    const thCount = thead ? thead.querySelectorAll('th').length : 0

    // ── overflow ──────────────────────────────────────────────────────────
    const scrollWidth = wrap?.scrollWidth ?? document.documentElement.scrollWidth
    const clientWidth = wrap?.clientWidth ?? document.documentElement.clientWidth
    const overflows = scrollWidth > clientWidth
    const computedOverflowX = wrap ? getComputedStyle(wrap).overflowX : 'n/a'
    const hasScrollFancy = wrap?.classList.contains('scroll-fancy') ?? false
    const wrapClass = wrap?.className ?? 'NOT_FOUND'

    // ── sticky header ────────────────────────────────────────────────────
    const firstTh = thead?.querySelector('th')
    const thPosition = firstTh ? getComputedStyle(firstTh).position : 'n/a'
    const thTopBefore = firstTh?.getBoundingClientRect().top ?? null

    // ── component type ────────────────────────────────────────────────────
    // SimpleTable = 1 thead row; PivotTable = 2 thead rows (grouped header)
    const componentType = theadRows === 2 ? 'PivotTable (2 thead rows)'
        : theadRows === 1 ? 'SimpleTable (1 thead row)'
        : `UNKNOWN (${theadRows} thead rows)`

    // ── column alignment col[1] and widest ────────────────────────────────
    const tbody = table?.querySelector('tbody')
    let col1HeaderLeft = null, col1BodyLeft = null
    let widestHeaderLeft = null, widestBodyLeft = null

    if (thead && tbody) {
      // Column 1 (index 1, 0-based)
      const headerCols = Array.from(thead.querySelectorAll('tr:last-child th'))
      const bodyFirstRow = tbody.querySelector('tr')
      const bodyCols = bodyFirstRow ? Array.from(bodyFirstRow.querySelectorAll('td')) : []

      if (headerCols[1]) col1HeaderLeft = Math.round(headerCols[1].getBoundingClientRect().left)
      if (bodyCols[1]) col1BodyLeft = Math.round(bodyCols[1].getBoundingClientRect().left)

      // Widest column (by offsetWidth)
      let maxW = 0, maxIdx = 0
      headerCols.forEach((th, i) => { if (th.offsetWidth > maxW) { maxW = th.offsetWidth; maxIdx = i } })
      if (headerCols[maxIdx]) widestHeaderLeft = Math.round(headerCols[maxIdx].getBoundingClientRect().left)
      if (bodyCols[maxIdx]) widestBodyLeft = Math.round(bodyCols[maxIdx].getBoundingClientRect().left)
    }

    return {
      wrapClass,
      scrollWidth,
      clientWidth,
      overflows,
      computedOverflowX,
      hasScrollFancy,
      thPosition,
      thTopBefore,
      theadRows,
      thCount,
      componentType,
      col1HeaderLeft,
      col1BodyLeft,
      col1Aligned: col1HeaderLeft !== null && col1BodyLeft !== null
          ? col1HeaderLeft === col1BodyLeft
          : 'n/a',
      widestHeaderLeft,
      widestBodyLeft,
      widestAligned: widestHeaderLeft !== null && widestBodyLeft !== null
          ? widestHeaderLeft === widestBodyLeft
          : 'n/a'
    }
  })
}

// ── 1. CAPTURE: 1440 light ────────────────────────────────────────────────────
console.log('\n--- [1/4] 1440 light ---')
const { ctx: ctx1, page: page1, errs: errs1 } = await loadPage(browser, 1440)
await ensureTableView(page1)

// Screenshot the FULL page (to capture the whole panel)
await page1.screenshot({ path: join(OUT, 'accounts_main_1440.png'), fullPage: true })
console.log('  saved accounts_main_1440.png')

// Collect DOM facts BEFORE scroll
const facts1440 = await collectDomFacts(page1)
console.log('  DOM facts (pre-scroll):', JSON.stringify(facts1440, null, 2))

// ── 2. SCROLL 180px and screenshot ───────────────────────────────────────────
console.log('\n--- [2/4] 1440 scrolled ---')

// Scroll the wrap or body by 180px
const thTopAfter = await page1.evaluate(() => {
  const wrap = document.querySelector('.data-table__wrap')
      || document.querySelector('[class*="data-table"]')
      || document.querySelector('[class*="table-wrap"]')

  if (wrap) {
    wrap.scrollTop += 180
  } else {
    window.scrollBy(0, 180)
  }

  // Wait a tick, then report th position
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      const th = document.querySelector('thead th')
      resolve(th ? Math.round(th.getBoundingClientRect().top) : null)
    })
  })
})

await page1.waitForTimeout(300)
await page1.screenshot({ path: join(OUT, 'accounts_main_1440_scrolled.png'), fullPage: false })
console.log('  saved accounts_main_1440_scrolled.png')
console.log('  th.top before scroll:', facts1440.thTopBefore, '  th.top after scroll:', thTopAfter)
console.log('  header frozen:', facts1440.thTopBefore !== null && thTopAfter !== null
    ? (Math.abs(facts1440.thTopBefore - thTopAfter) < 5 ? 'YES (frozen)' : 'NO (moved)')
    : 'UNKNOWN')

await ctx1.close()

// ── 3. CAPTURE: 768 ──────────────────────────────────────────────────────────
console.log('\n--- [3/4] 768 light ---')
const { ctx: ctx3, page: page3, errs: errs3 } = await loadPage(browser, 768)
await ensureTableView(page3)
await page3.screenshot({ path: join(OUT, 'accounts_main_768.png'), fullPage: true })
console.log('  saved accounts_main_768.png')
await ctx3.close()

// ── 4. CAPTURE: 1440 dark ────────────────────────────────────────────────────
console.log('\n--- [4/4] 1440 dark ---')
const { ctx: ctx4, page: page4, errs: errs4 } = await loadPage(browser, 1440)
await ensureTableView(page4)

// Toggle dark via dataset (same approach as other capture scripts)
await page4.evaluate(() => {
  // First try theme switcher click
  const switcher = document.querySelector('[class*="theme-switch"],[class*="theme-toggle"],[data-testid*="theme"]')
  if (switcher) {
    switcher.click()
    return
  }
  // Fallback: set data-theme directly
  document.documentElement.dataset.theme = 'dark'
})
await page4.waitForTimeout(700)

await page4.screenshot({ path: join(OUT, 'accounts_main_dark_1440.png'), fullPage: true })
console.log('  saved accounts_main_dark_1440.png')
await ctx4.close()

// ── Final report ──────────────────────────────────────────────────────────────
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
  headerFrozen: facts1440.thTopBefore !== null && thTopAfter !== null
      ? (Math.abs(facts1440.thTopBefore - thTopAfter) < 5 ? 'YES' : 'NO')
      : 'UNKNOWN'
}
writeFileSync(join(OUT, 'accounts_main_facts.json'), JSON.stringify(report, null, 2))
console.log('\nFACTS JSON → table-truth/accounts_main_facts.json')

await browser.close()
console.log('\nALL_DONE')
