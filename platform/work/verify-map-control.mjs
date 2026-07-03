// Control: isolate the geograph crash. Two independent probes on #geo-map:
//  P1 = table→map toggle with NO row-select (does a plain hidden→shown crash?)
//  P2 = table→row-select→map (the brief's A path) — re-confirm the crash + test Retry.
import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { writeFileSync } from 'node:fs'
const { chromium } = pw
const BASE = 'http://192.168.1.199:3002'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/regression-fix'
const browser = await chromium.launch({ headless: true })
const mk = () => ({ errors: [] })
const R = { P1_toggleOnly: mk(), P2_toggleThenRetry: mk() }

async function newPage(bucket) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ka-GE' })).newPage()
  page.on('console', m => { if (m.type() === 'error') bucket.errors.push('CONSOLE ' + m.text().split('\n')[0].slice(0, 120)) })
  page.on('pageerror', e => bucket.errors.push('PAGEERROR ' + String(e.message).slice(0, 120)))
  return page
}
const H = () => {
  window.__c = {}
  window.__c.map = () => { const c = document.querySelector('#geo-map .leaflet-container'); if (!c) return { present: false }
    const paths = Array.from(c.querySelectorAll('path.leaflet-interactive')); const bad = d => !d || /^M0 0z?$/i.test((d || '').trim()) || (d || '').trim().length < 12
    const ds = paths.map(p => p.getAttribute('d') || ''); return { present: true, pathCount: paths.length, realCount: ds.filter(d => !bad(d)).length, degenerateCount: ds.filter(bad).length } }
  window.__c.crashed = () => { const p = document.querySelector('#geo-map'); return p ? /Failed to load|Invalid LatLng|Retry/i.test(p.textContent || '') : null }
  window.__c.toggle = re => { const rx = new RegExp(re, 'i'); const b = Array.from(document.querySelectorAll('#geo-map button')).find(x => rx.test((x.textContent || '').trim())); if (b) { b.click(); return (b.textContent || '').trim() } return null }
  window.__c.retry = () => { const b = Array.from(document.querySelectorAll('#geo-map button')).find(x => /retry|თავიდან|ხელახლა/i.test(x.textContent || '')); if (b) { b.click(); return true } return false }
  window.__c.row = i => { const rs = Array.from(document.querySelectorAll('#geo-map tbody tr')); if (!rs.length) return { rows: 0 }; const r = rs[i % rs.length]; (r.querySelector('td') || r).click(); return { rows: rs.length } }
}
const s = (p, ms) => p.waitForTimeout(ms)

// ── P1: toggle table→map, NO selection ──────────────────────────────────
{
  const page = await newPage(R.P1_toggleOnly)
  await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await s(page, 5000); await page.evaluate(H)
  R.P1_toggleOnly.baseline = await page.evaluate(() => window.__c.map())
  await page.evaluate(() => window.__c.toggle('ცხრილ|table')); await s(page, 2000); await page.evaluate(H)
  R.P1_toggleOnly.toTable = { crashed: await page.evaluate(() => window.__c.crashed()) }
  await page.evaluate(() => window.__c.toggle('რუქა|map')); await s(page, 2800); await page.evaluate(H)
  R.P1_toggleOnly.afterToggleBack = { crashed: await page.evaluate(() => window.__c.crashed()), map: await page.evaluate(() => window.__c.map()) }
  await page.close()
}
// ── P2: toggle table→SELECT→map (brief A path), then test Retry recovery ──
{
  const page = await newPage(R.P2_toggleThenRetry)
  await page.goto(BASE + '/ka/regional', { waitUntil: 'networkidle', timeout: 45000 }); await s(page, 5000); await page.evaluate(H)
  await page.evaluate(() => window.__c.toggle('ცხრილ|table')); await s(page, 2000); await page.evaluate(H)
  R.P2_toggleThenRetry.rowClick = await page.evaluate(() => window.__c.row(1)); await s(page, 2000); await page.evaluate(H)
  await page.evaluate(() => window.__c.toggle('რუქა|map')); await s(page, 2800); await page.evaluate(H)
  R.P2_toggleThenRetry.afterToggleBack = { crashed: await page.evaluate(() => window.__c.crashed()), map: await page.evaluate(() => window.__c.map()) }
  // try Retry
  const retried = await page.evaluate(() => window.__c.retry()); await s(page, 3000); await page.evaluate(H)
  R.P2_toggleThenRetry.retry = { clicked: retried, crashedAfterRetry: await page.evaluate(() => window.__c.crashed()), map: await page.evaluate(() => window.__c.map()) }
  await page.screenshot({ path: OUT + '/A-control-after-retry.png', fullPage: true })
  await page.close()
}
writeFileSync(OUT + '/_A_control.json', JSON.stringify(R, null, 1))
console.log('DONE')
await browser.close()
