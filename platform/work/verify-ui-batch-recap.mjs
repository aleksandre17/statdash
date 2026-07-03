import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

// 2-region comparison via deterministic URL param
await page.goto(BASE + '/ka/regional?region=R2,R5', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2500)
const compEl = await page.$$('.section')
let comp = null
for (const s of compEl) {
  const t = await s.evaluate(el => (el.querySelector('[class*="title"],h2,h3')?.textContent||''))
  if (t.includes('შედარე')) comp = s
}
if (comp) { await comp.screenshot({ path: SHOTS + '/04-comparison-2region.png' }); console.log('SHOT 04-comparison-2region.png') }

// perspective-tab-group tight capture
const persp = await page.$('.perspective-tab-group')
if (persp) {
  const box = await persp.boundingBox()
  console.log('perspective box:', JSON.stringify(box && {x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width),h:Math.round(box.height)}))
  // capture a wide strip to show LEFT-anchoring in the row context
  await page.screenshot({ path: SHOTS + '/03-perspective-row-context.png', clip: { x: 0, y: Math.max(0, box.y - 10), width: 1500, height: box.height + 20 } })
  console.log('SHOT 03-perspective-row-context.png')
} else { console.log('no perspective-tab-group on regional') }
await browser.close()
