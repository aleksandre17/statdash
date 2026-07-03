// Focused re-probe: frozen-header behaviour on the sectors table view + pageerror attribution.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/typography-batch'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE', extraHTTPHeaders: { 'Accept-Language': 'ka-GE,ka;q=0.9' } })
const page = await ctx.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)))

await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(4000)
// select 2 regions
const mapTotal = await page.evaluate(() => document.querySelectorAll('.leaflet-container path.leaflet-interactive').length)
const rp = () => page.evaluate(() => new URLSearchParams(location.search).get('region') || '')
let cnt = 0
for (let i = 0; i < mapTotal && cnt < 2; i++) {
  const before = await rp()
  await page.locator('.leaflet-container path.leaflet-interactive').nth(i).click({ timeout: 5000, force: true }).catch(() => {})
  await page.waitForTimeout(900)
  const after = await rp()
  if (after !== before) cnt = after.split(',').filter(Boolean).length
}
await page.waitForTimeout(3000)
console.log('selected =', await rp())

// open sectors table view
const clicked = await page.evaluate(() => {
  const el = document.getElementById('sectors'); if (!el) return 'no-sectors'
  const b = Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"],a')).find(x => /ცხრილ|table/i.test(x.textContent || ''))
  if (b) { b.click(); return b.textContent.trim() } return 'no-toggle'
})
console.log('table-toggle =', clicked)
await page.waitForTimeout(2500)

const frozen = await page.evaluate(() => {
  const el = document.getElementById('sectors')
  const tbl = el.querySelector('table')
  const th = el.querySelector('thead th')
  const thStyle = th ? getComputedStyle(th) : null
  const wrap = el.querySelector('.data-table__wrap') || (tbl ? tbl.parentElement : null)
  // find actual scroll container
  let scroller = wrap
  let n = tbl
  while (n && n !== el) { const s = getComputedStyle(n); if ((/auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflow)) && n.scrollHeight > n.clientHeight + 4) { scroller = n; break } n = n.parentElement }
  return {
    tableClass: tbl ? tbl.className : null,
    theadThClass: th ? th.className : null,
    theadThPosition: thStyle ? thStyle.position : null,
    theadThTop: thStyle ? thStyle.top : null,
    theadThZ: thStyle ? thStyle.zIndex : null,
    scrollerClass: scroller ? scroller.className : null,
    scrollerScrollH: scroller ? scroller.scrollHeight : null,
    scrollerClientH: scroller ? scroller.clientHeight : null,
  }
})
console.log('FROZEN-STATIC-CHECK =', JSON.stringify(frozen, null, 1))

// BEHAVIORAL: record th top before scroll, scroll container, record th top after
const behav = await page.evaluate(async () => {
  const el = document.getElementById('sectors')
  const tbl = el.querySelector('table')
  const th = el.querySelector('thead th')
  // find scroller again
  let scroller = el.querySelector('.data-table__wrap')
  if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 4) {
    let n = tbl; while (n && n !== el) { const s = getComputedStyle(n); if ((/auto|scroll/.test(s.overflowY)) && n.scrollHeight > n.clientHeight + 4) { scroller = n; break } n = n.parentElement }
  }
  const scRectTop = scroller.getBoundingClientRect().top
  const thTopBefore = th.getBoundingClientRect().top
  const firstBodyRowTopBefore = el.querySelector('tbody tr')?.getBoundingClientRect().top
  scroller.scrollTop = Math.min(300, scroller.scrollHeight - scroller.clientHeight)
  await new Promise(r => setTimeout(r, 400))
  const thTopAfter = th.getBoundingClientRect().top
  const firstBodyRowTopAfter = el.querySelector('tbody tr')?.getBoundingClientRect().top
  return {
    scrollTop: scroller.scrollTop,
    scRectTop: Math.round(scRectTop),
    thTopBefore: Math.round(thTopBefore), thTopAfter: Math.round(thTopAfter),
    thStayedFrozen: Math.abs(thTopAfter - scRectTop) < 6,   // header pinned to scroller top
    thDidNotScrollAway: Math.abs(thTopAfter - thTopBefore) < 6,
    bodyRowMovedUp: (firstBodyRowTopBefore != null && firstBodyRowTopAfter != null) ? (firstBodyRowTopBefore - firstBodyRowTopAfter) : null,
  }
})
console.log('BEHAVIORAL-FROZEN =', JSON.stringify(behav, null, 1))
await page.evaluate(() => document.getElementById('sectors')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '/07-sectors-table-scrolled.png' })

console.log('ERRORS (whole session, no heavy probing) =', JSON.stringify(errors, null, 1))
await browser.close()
