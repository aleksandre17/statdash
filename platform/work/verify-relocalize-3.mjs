import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/relocalize'
const hasKa = (s) => /[Ⴀ-ჿ]/.test(s || '')
const waitApp = async (p) => { await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForSelector('.kpi-strip, .geo-map, .section__head',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(1500) }
const clickTabByText = async (page, re) => {
  const h = await page.evaluateHandle((src) => {
    const rx = new RegExp(src,'i')
    return [...document.querySelectorAll('.perspective-tab-btn')].find(b => rx.test(b.textContent)) || null
  }, re.source)
  const el = h.asElement(); if (!el) return false
  await el.click(); await page.waitForTimeout(1500); return true
}
const dumpRange = (page) => page.evaluate(() => {
  const r = document.querySelector('.filter-control__range')
  return { hasRange: !!r, text: r?.textContent?.trim()||null,
           words: [...document.querySelectorAll('.filter-range-word')].map(w=>w.textContent.trim()),
           inputs: [...document.querySelectorAll('.filter-range-input')].map(i=>i.value) }
})
const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport:{width:1440,height:1200} })).newPage()
try {
  await page.goto(`${BASE}/ka/regional`, { waitUntil:'domcontentloaded' }); await waitApp(page)
  const clicked = await clickTabByText(page, /დინამ/)
  console.log('clicked dynamics tab =', clicked)
  const ka = await dumpRange(page)
  console.log('KA range =', JSON.stringify(ka))
  await page.screenshot({ path:`${SHOTS}/05a-range-ka.png`, fullPage:true })
  if (ka.hasRange) {
    const lb = await page.$$('.locale-switcher__btn')
    for (const b of lb){ const t=(await b.textContent()).trim(); if(/eng/i.test(t)&&!hasKa(t)){ await b.click(); break } }
    await page.waitForTimeout(1800)
    const en = await dumpRange(page)
    console.log('EN range =', JSON.stringify(en))
    await page.screenshot({ path:`${SHOTS}/05b-range-en.png`, fullPage:true })
    console.log('ASSERT.ka_dan_mde =', ka.words.includes('დან') && ka.words.includes('მდე'))
    console.log('ASSERT.en_from_to =', en.words.some(w=>/from/i.test(w)) && en.words.some(w=>/^to$/i.test(w)))
  }
} catch(e){ console.error('FATAL', e) } finally { await browser.close() }
