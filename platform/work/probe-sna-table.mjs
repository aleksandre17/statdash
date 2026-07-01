// Targeted probe of the SNA "National Accounts" PIVOT table on /ka/accounts.
// Selects the table by its Georgian series headers (რესურსები / გამოყენება) —
// NOT the first table on the page (the prior probe's bug: it measured a
// different 2-col SimpleTable). Reports per-column header↔body alignment PARITY,
// bounded-scroll, and sticky freeze. BASE via argv[2] (live :3002 or local).
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw

const BASE = process.argv[2] || 'http://192.168.1.199:3002'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })

try {
  await page.goto(BASE + '/ka/accounts', { waitUntil: 'networkidle', timeout: 30000 })
} catch (e) { console.warn('WARN goto —', e.message.split('\n')[0]) }
await page.waitForTimeout(2000)

// Make sure the SNA panel is showing its TABLE view (click ცხრილი toggle if present)
const btns = await page.$$('button')
for (const b of btns) {
  const t = await b.innerText().catch(() => '')
  if (t.trim() === 'ცხრილი') { await b.click().catch(() => {}); await page.waitForTimeout(500); break }
}

const facts = await page.evaluate(() => {
  // ── locate THE SNA pivot: the VISIBLE table whose thead mentions რესურსები ──
  const tables = Array.from(document.querySelectorAll('table.data-table, table'))
    .filter(t => t.getBoundingClientRect().width > 0)   // exclude hidden export tables
  const sna = tables.find(t => (t.querySelector('thead')?.textContent ?? '').includes('რესურსები'))
  if (!sna) return { found: false, visibleTables: tables.length }

  const wrap  = sna.closest('.data-table__wrap')
  const thead = sna.querySelector('thead')
  const tbody = sna.querySelector('tbody')
  const cs = (el) => el ? getComputedStyle(el) : null

  // series header cells = last header row, skipping the first (row-label) col
  const headRow  = thead.querySelector('tr:last-child')
  const headCells = Array.from(headRow.querySelectorAll('th')).slice(1)

  // A REAL data row has one td per series column — NOT a separator/group row,
  // which renders a single colSpan td. Match td-count to the series-header count.
  const firstBodyRow = Array.from(tbody.querySelectorAll('tr'))
    .find(tr => tr.querySelectorAll('td').length === headCells.length)
  const bodyCells = firstBodyRow ? Array.from(firstBodyRow.querySelectorAll('td')) : []

  const perColumn = headCells.map((th, i) => {
    const td = bodyCells[i]
    const thStyle = cs(th), tdStyle = cs(td)
    return {
      header:        th.textContent.trim().slice(0, 14),
      thHasR:        th.classList.contains('r'),
      tdHasR:        td ? td.classList.contains('r') : null,
      thTextAlign:   thStyle?.textAlign,
      tdTextAlign:   tdStyle?.textAlign,
      thRightEdge:   Math.round(th.getBoundingClientRect().right),
      tdRightEdge:   td ? Math.round(td.getBoundingClientRect().right) : null,
      // aligned = same text-align AND cells share a right edge (same column track)
      aligned:       !!td && thStyle?.textAlign === tdStyle?.textAlign,
    }
  })

  const wrapCS = cs(wrap)
  return {
    found:        true,
    theadRows:    thead.querySelectorAll('tr').length,
    componentType: thead.querySelectorAll('tr').length === 2 ? 'PivotTable(2-row)' : 'PivotTable(flat)',
    perColumn,
    allAligned:   perColumn.every(c => c.aligned),
    // bounded scroll
    wrapClass:    wrap?.className ?? 'NO_WRAP',
    wrapMaxHeight: wrapCS?.maxHeight,
    wrapHeight:    wrap ? Math.round(wrap.getBoundingClientRect().height) : null,
    wrapScrollH:   wrap?.scrollHeight,
    wrapClientH:   wrap?.clientHeight,
    overflowY:     wrapCS?.overflowY,
    overflowX:     wrapCS?.overflowX,
    scrollWidth:   wrap?.scrollWidth,
    clientWidth:   wrap?.clientWidth,
    boundedTaller: wrap ? (wrap.scrollHeight > wrap.clientHeight + 2) : null,
    // sticky
    thPosition:   cs(headRow.querySelector('th'))?.position,
  }
})

if (!facts.found) { console.log('SNA_TABLE_NOT_FOUND'); await browser.close(); process.exit(2) }

// ── sticky freeze test: scroll the WRAP, compare header th.top before/after ──
const thTopBefore = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('table')).filter(t=>t.getBoundingClientRect().width>0).find(t => (t.querySelector('thead')?.textContent ?? '').includes('რესურსები'))
  return Math.round(t.querySelector('thead th').getBoundingClientRect().top)
})
const thTopAfter = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('table')).filter(t=>t.getBoundingClientRect().width>0).find(t => (t.querySelector('thead')?.textContent ?? '').includes('რესურსები'))
  const wrap = t.closest('.data-table__wrap')
  if (wrap) wrap.scrollTop += 200
  const th = t.querySelector('thead th')
  return Math.round(th.getBoundingClientRect().top)
})
const frozen = Math.abs(thTopBefore - thTopAfter) < 5

console.log('BASE:', BASE)
console.log(JSON.stringify({ ...facts, sticky: { thTopBefore, thTopAfter, frozen } }, null, 2))
await browser.close()
