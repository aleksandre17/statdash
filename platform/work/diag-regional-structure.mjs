import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' })).newPage()
await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(5000)
const dump = await page.evaluate(() => {
  const cn = el => (typeof el.className === 'string' ? el.className : (el.className?.baseVal || ''))
  // find the panel that OWNS the leaflet map — walk up
  const map = document.querySelector('.leaflet-container')
  let mapPanel = null
  if (map) { let el = map; for (let i = 0; i < 10 && el.parentElement; i++) { el = el.parentElement; if (/panel/.test(cn(el)) && !/panel__/.test(el.className)) { mapPanel = el; break } } }
  const describe = (el) => {
    if (!el) return null
    const title = (el.querySelector('.section__title, [class*="title"], h2, h3')?.textContent || '').trim().slice(0, 50)
    const toggles = Array.from(el.querySelectorAll('button,[role="tab"],[role="radio"]')).map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 12)
    return {
      tag: el.tagName, cls: (cn(el)).toString().slice(0, 60), id: el.id || null, title,
      hasLeaflet: !!el.querySelector('.leaflet-container'),
      tbodyRows: el.querySelectorAll('tbody tr').length,
      toggles,
    }
  }
  // top-level panels
  const panels = Array.from(document.querySelectorAll('[class*="panel"]')).filter(p => /(^|\s)panel(\s|$|_)/.test(p.className) && !/panel__(body|header|footer|title|actions)/.test(cn(p)))
  return {
    mapPanelDesc: describe(mapPanel),
    // also describe mapPanel parent chain title-bearing ancestor
    panelCount: panels.length,
    panels: panels.map(describe),
  }
})
console.log(JSON.stringify(dump, null, 1))
await browser.close()
