import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'

const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()) })

await page.goto(BASE + '/ka/gdp', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)

// Find the income section by its Georgian title, expand if collapsed, scroll into view.
const titleKa = 'შემოსავლების ფორმირების ანგარიში'

// Try to locate a header/section containing the income title text.
const found = await page.evaluate((title) => {
  const all = [...document.querySelectorAll('*')]
  const hit = all.find(el =>
    el.children.length === 0 && (el.textContent || '').trim() === title)
    || all.find(el => (el.textContent || '').includes(title) && el.querySelectorAll('*').length < 40)
  if (!hit) return { ok: false, reason: 'income title not found' }
  // Walk up to a section-ish ancestor
  let sec = hit
  for (let i = 0; i < 12 && sec.parentElement; i++) {
    sec = sec.parentElement
    const cls = (sec.className || '').toString()
    if (/section/i.test(cls) && sec.offsetHeight > 200) break
  }
  sec.setAttribute('data-verify-income', '1')
  sec.scrollIntoView({ block: 'center' })
  return { ok: true, cls: (sec.className || '').toString(), h: sec.offsetHeight }
}, titleKa)

console.log('INCOME SECTION LOCATE:', JSON.stringify(found))
await page.waitForTimeout(800)

// If a chart/table toggle exists and we're on table view, ensure chart(treemap) is shown.
// Also expand a collapsed section by clicking its header if treemap markers absent.
async function markerScan() {
  return await page.evaluate(() => {
    const sec = document.querySelector('[data-verify-income="1"]') || document.body
    const glyphs = ['=', '+', '-', '−']
    const markers = [...sec.querySelectorAll('span')].filter(s => {
      const t = (s.textContent || '').trim()
      if (!glyphs.includes(t)) return false
      const cs = getComputedStyle(s)
      return cs.position === 'absolute' && parseInt(cs.fontWeight) >= 700
    })
    // For each marker, find nearest positioned ancestor tile with a background color
    const tiles = markers.map(m => {
      let tile = m.parentElement
      for (let i = 0; i < 4 && tile; i++) {
        const cs = getComputedStyle(tile)
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') break
        tile = tile.parentElement
      }
      const cs = tile ? getComputedStyle(tile) : null
      // grab the tile label (a span with fontSize ~12 inside)
      const labelSpan = tile ? [...tile.querySelectorAll('span')].find(s => {
        const f = parseFloat(getComputedStyle(s).fontSize)
        const t = (s.textContent || '').trim()
        return f >= 11 && f <= 13 && t.length > 2 && !['=', '+', '-', '−'].includes(t)
      }) : null
      return {
        op: (m.textContent || '').trim(),
        bg: cs ? cs.backgroundColor : null,
        w: tile ? tile.offsetWidth : 0,
        h: tile ? tile.offsetHeight : 0,
        label: labelSpan ? (labelSpan.textContent || '').trim() : null,
      }
    })
    return { markerCount: markers.length, tiles }
  })
}

let scan = await markerScan()
if (scan.markerCount === 0) {
  // maybe collapsed — click the income section header
  await page.evaluate(() => {
    const sec = document.querySelector('[data-verify-income="1"]')
    if (!sec) return
    const btn = sec.querySelector('button, [role="button"], summary, h2, h3')
    if (btn) btn.click()
  })
  await page.waitForTimeout(1500)
  scan = await markerScan()
}

console.log('TREEMAP SCAN /ka/gdp:', JSON.stringify(scan, null, 2))

// Screenshot the income section
const secEl = await page.$('[data-verify-income="1"]')
if (secEl) {
  await secEl.screenshot({ path: SHOTS + '/01-income-treemap-ka.png' })
  console.log('SHOT saved 01-income-treemap-ka.png')
} else {
  await page.screenshot({ path: SHOTS + '/01-income-treemap-ka-fullpage.png', fullPage: true })
  console.log('SHOT fullpage fallback')
}

console.log('ERRORS:', errs.length ? JSON.stringify(errs.slice(0, 8)) : 'none')
await browser.close()
