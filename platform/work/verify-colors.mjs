import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const { chromium } = pw
const BASE='http://192.168.1.199:3002'
const OUT='C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/composition-batch'
const browser=await chromium.launch({headless:true})
const page=await(await browser.newContext({viewport:{width:1440,height:1600},locale:'ka-GE'})).newPage()
const S=ms=>page.waitForTimeout(ms)
await page.goto(BASE+'/ka/regional?region=R9,R7',{waitUntil:'networkidle',timeout:45000}); await S(5000)
// ensure composition section shows CHART (დიაგრამა) view
await page.evaluate(()=>[...document.querySelectorAll('button.section__view-btn')].filter(b=>/დიაგრამა|chart/i.test(b.textContent||'')).forEach(b=>b.click())); await S(2500)
const R=await page.evaluate(()=>[...document.querySelectorAll('.apexcharts-canvas')].map(c=>{
  const series=[...c.querySelectorAll('.apexcharts-series')]
  const fills=[...new Set(series.map(s=>{const p=s.querySelector('path.apexcharts-bar-area,path[fill]'); return (p?.getAttribute('fill')||'').toLowerCase()}).filter(Boolean))]
  return { seriesCount:series.length, distinctFills:fills.slice(0,8), h:Math.round(c.getBoundingClientRect().height) }
}))
console.log(JSON.stringify(R,null,1))
await page.screenshot({path:OUT+'/06-stateB-colors.png',fullPage:true})
await browser.close()
