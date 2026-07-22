// Probe 0093 — capture accessible names in the portal chrome (before/after).
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://192.168.1.199:3012'
const OUT  = process.env.OUT  || 'work/authoring-truth/0093'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newContext({ deviceScaleFactor: 1 }).then(c => c.newPage())
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message))

  // ── KA portal ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/ka`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // All links + buttons and their accessible names
  const named = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('a, button, select')) {
      const name = el.getAttribute('aria-label')
        ?? el.getAttribute('title')
        ?? (el.textContent || '').trim().slice(0, 40)
      out.push({ tag: el.tagName.toLowerCase(), name, cls: el.className?.toString().slice(0, 30) })
    }
    return out
  })
  const objObj = named.filter(n => /\[object Object\]/.test(n.name))
  const latin  = named.filter(n => n.name && /^[\x00-\x7F]+$/.test(n.name) && /[A-Za-z]{3,}/.test(n.name) && !/^https?:/.test(n.name))

  console.log('=== KA portal accessible names ===')
  console.log('[object Object] names:', JSON.stringify(objObj, null, 0))
  console.log('Latin-only (suspect EN on KA):', JSON.stringify(latin.map(l => l.name), null, 0))

  // skip-link presence
  const skip = await page.evaluate(() => {
    const a = document.querySelector('a.skip-link') || document.querySelector('a[href="#main-content"]')
    return a ? { text: a.textContent, href: a.getAttribute('href') } : null
  })
  console.log('skip-link:', JSON.stringify(skip))

  // Tab once → is skip-link the first focus?
  await page.keyboard.press('Tab')
  const firstFocus = await page.evaluate(() => {
    const el = document.activeElement
    return { tag: el?.tagName, cls: el?.className?.toString().slice(0, 30), text: (el?.textContent || '').trim().slice(0, 40) }
  })
  console.log('first Tab focus:', JSON.stringify(firstFocus))

  await page.screenshot({ path: `${OUT}/portal-ka-focus.png`, fullPage: false })

  // ── dark table header contrast on /ka/regional ──────────────────────────
  await page.goto(`${BASE}/ka/regional`, { waitUntil: 'networkidle' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(2500)
  const contrast = await page.evaluate(() => {
    function lum(rgb) {
      const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    function parse(s) { const m = s.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : null }
    const th = document.querySelector('.data-table th')
    if (!th) return { err: 'no th found' }
    const cs = getComputedStyle(th)
    const fg = parse(cs.color)
    let bgEl = th, bg = null
    while (bgEl) { const c = getComputedStyle(bgEl).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = parse(c); break } bgEl = bgEl.parentElement }
    const L1 = lum(fg), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    return { fg: cs.color, bg: `rgb(${bg})`, ratio: +ratio.toFixed(2) }
  })
  console.log('=== dark table header contrast ===')
  console.log(JSON.stringify(contrast))
  await page.screenshot({ path: `${OUT}/portal-regional-dark-table.png`, fullPage: false })

  console.log('=== console errors ===', errors.length, JSON.stringify(errors.slice(0, 10)))
  await browser.close()
}
run().catch(e => { console.error(e); process.exit(1) })
