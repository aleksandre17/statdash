import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/relocalize'
const hasKa = (s) => /[Ⴀ-ჿ]/.test(s || '')
const waitApp = async (p) => { await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForSelector('.filter-bar, .kpi-strip',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(1500) }
const clickDyn = async (page) => {
  const h = await page.evaluateHandle(() => [...document.querySelectorAll('.perspective-tab-btn')].find(b => /დინამ|dynam/i.test(b.textContent)) || null)
  const el = h.asElement(); if (!el) return false; await el.click(); await page.waitForTimeout(1500); return true
}
const dumpFilterBar = (page) => page.evaluate(() => {
  const bar = document.querySelector('.filter-bar, [class*="filter-bar"]')
  const fullText = bar ? bar.innerText.replace(/\s+/g,' ').trim() : null
  // each control wrapper + its visible text (label/suffix + selected value)
  const controls = [...document.querySelectorAll('.filter-bar [class*="filter-control"], .filter-bar .filter-field, .filter-bar label')]
    .map(c => c.innerText.replace(/\s+/g,' ').trim()).filter(Boolean)
  const selects = [...document.querySelectorAll('.filter-bar select')].map(s => s.options[s.selectedIndex]?.text?.trim())
  // suffix / word spans
  const words = [...document.querySelectorAll('.filter-bar [class*="suffix"], .filter-bar [class*="range-word"], .filter-bar [class*="filter-field__suffix"], .filter-bar [class*="__suffix"]')].map(w=>w.textContent.trim())
  return { fullText, controls, selects, words }
})
const flipEn = async (page) => { const lb = await page.$$('.locale-switcher__btn'); for (const b of lb){ const t=(await b.textContent()).trim(); if(/eng/i.test(t)&&!hasKa(t)){ await b.click(); break } } await page.waitForTimeout(1800) }
const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport:{width:1440,height:900} })).newPage()
try {
  for (const slug of ['accounts','gdp']) {
    await page.goto(`${BASE}/ka/${slug}`, { waitUntil:'domcontentloaded' }); await waitApp(page)
    const clicked = await clickDyn(page)
    console.log(`\n=== [${slug}] dynamics clicked=${clicked} ===`)
    const ka = await dumpFilterBar(page)
    console.log('KA fullText  =', ka.fullText)
    console.log('KA controls  =', JSON.stringify(ka.controls))
    console.log('KA selects   =', JSON.stringify(ka.selects))
    console.log('KA words     =', JSON.stringify(ka.words))
    await page.screenshot({ path:`${SHOTS}/05a-range-${slug}-ka.png`, fullPage:true })
    await flipEn(page)
    const en = await dumpFilterBar(page)
    console.log('EN fullText  =', en.fullText)
    console.log('EN controls  =', JSON.stringify(en.controls))
    console.log('EN words     =', JSON.stringify(en.words))
    await page.screenshot({ path:`${SHOTS}/05b-range-${slug}-en.png`, fullPage:true })
    console.log(`ASSERT.ka_has_dan_mde = ${/დან/.test(ka.fullText) && /მდე/.test(ka.fullText)}`)
    console.log(`ASSERT.en_has_from_to = ${/\bfrom\b/i.test(en.fullText) && /\bto\b/i.test(en.fullText)}`)
  }
} catch(e){ console.error('FATAL', e) } finally { await browser.close() }
