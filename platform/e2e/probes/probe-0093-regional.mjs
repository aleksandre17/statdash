import { chromium } from 'playwright'
const BASE = 'http://192.168.1.199:3012'
const b = await chromium.launch({ headless: true })
const p = await b.newPage()
await p.goto(`${BASE}/ka/regional`, { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
const names = await p.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('select, [role="button"], button, a')) {
    const n = el.getAttribute('aria-label') ?? el.getAttribute('title')
    if (n && /^[\x00-\x7F]+$/.test(n) && /[A-Za-z]{3,}/.test(n) && !/^https?:/.test(n))
      out.push({ tag: el.tagName.toLowerCase(), name: n, cls: (el.className||'').toString().slice(0,40) })
  }
  return out
})
console.log('EN-suspect aria on /ka/regional:', JSON.stringify(names, null, 1))
await b.close()
