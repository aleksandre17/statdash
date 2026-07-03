import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/relocalize'
const hasKa = (s) => /[Ⴀ-ჿ]/.test(s || '')
const waitApp = async (p) => { await p.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{}); await p.waitForSelector('.kpi-strip, .geo-map, .section__head',{timeout:30000}).catch(()=>{}); await p.waitForTimeout(1500) }
const browser = await pw.chromium.launch()
const page = await (await browser.newContext({ viewport:{width:1440,height:1200} })).newPage()
try {
  // ── ITEM 5 debug: find the range/dynamics perspective across pages ──
  for (const slug of ['regional','gdp','accounts']) {
    await page.goto(`${BASE}/ka/${slug}`, { waitUntil:'domcontentloaded' }); await waitApp(page)
    const tabs = await page.$$eval('.perspective-tab-btn', bs => bs.map(b => b.textContent.trim()))
    console.log(`\n[${slug}] perspective tabs =`, JSON.stringify(tabs))
    // click each non-first tab and look for a range control
    const btns = await page.$$('.perspective-tab-btn')
    for (let i=0;i<btns.length;i++){
      const txt = (await btns[i].textContent()).trim()
      await btns[i].click(); await page.waitForTimeout(1200)
      const info = await page.evaluate(() => {
        const r = document.querySelector('.filter-control__range')
        const words = [...document.querySelectorAll('.filter-range-word')].map(w=>w.textContent.trim())
        const allControls = [...document.querySelectorAll('[class*="filter-control"]')].map(e=>e.className)
        const rangeInputs = document.querySelectorAll('.filter-range-input').length
        return { hasRange: !!r, rangeText: r?.textContent?.trim()||null, words, rangeInputs, allControls: [...new Set(allControls)] }
      })
      console.log(`  tab[${i}]="${txt}" -> hasRange=${info.hasRange} inputs=${info.rangeInputs} words=${JSON.stringify(info.words)} controls=${JSON.stringify(info.allControls)}`)
      if (info.hasRange) {
        await page.screenshot({ path:`${SHOTS}/05a-range-ka.png`, fullPage:true })
        // flip to EN in place
        const lb = await page.$$('.locale-switcher__btn')
        for (const b of lb){ const t=(await b.textContent()).trim(); if(/eng/i.test(t)&&!hasKa(t)){ await b.click(); break } }
        await page.waitForTimeout(1800)
        const en = await page.evaluate(()=>({ words:[...document.querySelectorAll('.filter-range-word')].map(w=>w.textContent.trim()), text:document.querySelector('.filter-control__range')?.textContent?.trim() }))
        console.log(`    EN words=${JSON.stringify(en.words)} text="${en.text}"`)
        await page.screenshot({ path:`${SHOTS}/05b-range-en.png`, fullPage:true })
        console.log(`    ASSERT ka(დან/მდე)=${info.words.includes('დან')&&info.words.includes('მდე')} en(from/to)=${en.words.some(w=>/from/i.test(w))&&en.words.some(w=>/^to$/i.test(w))}`)
      }
    }
  }
  // ── ITEM 7b: treemap real render check (better selectors) ──
  await page.goto(`${BASE}/ka/gdp`, { waitUntil:'domcontentloaded' }); await waitApp(page)
  const tm = await page.evaluate(() => {
    const sel = (s)=>document.querySelectorAll(s).length
    return {
      treemapSvg: sel('.apexcharts-treemap'),
      rects_series: sel('.apexcharts-series rect'),
      rects_treemapg: sel('g.apexcharts-treemap rect'),
      pathRects: sel('.apexcharts-treemap-rect'),
      dataLabels: [...document.querySelectorAll('.apexcharts-datalabels text')].map(t=>t.textContent.trim()).filter(Boolean),
      anyRectInApex: sel('.apexcharts-canvas rect'),
    }
  })
  console.log('\n[7b treemap]', JSON.stringify(tm))
  await page.screenshot({ path:`${SHOTS}/07b-income-treemap-gdp.png`, fullPage:true })
} catch(e){ console.error('FATAL', e) } finally { await browser.close() }
