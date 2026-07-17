// walk-r6.mjs — round-6 acceptance: map-rescope root, gesture-gate, new sliders,
// filter gaps, overlay stacking, dark popover border. Run after the r6 deploy.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../platform/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = 'http://192.168.1.199:3012';
const OUT = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const R = [];
const say = (s, id, d) => { R.push(s); console.log(`${s} ${id} — ${d}`); };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));

const scrollAll = async () => { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); } window.scrollTo(0, 0); }); await page.waitForTimeout(1200); };
const go = async (p2) => { errs.length = 0; await page.goto(BASE + p2, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3000); await scrollAll(); };
const tab = async (t) => { const el = page.locator(`button:has-text("${t}")`).first(); if (await el.count()) { await el.click().catch(() => {}); await page.waitForTimeout(2000); await scrollAll(); } };

// ── 1. REGIONAL: map region-click rescope (THE regression) ──────────────────
await go('/ka/regional');
const chartsBefore = await page.locator('.apexcharts-canvas').count();
await page.locator('.inner-page svg path').nth(5).click().catch(async () => { await page.mouse.click(600, 780); });
await page.waitForTimeout(3500); await scrollAll();
const url1 = await page.evaluate(() => location.search);
const chartsAfter = await page.locator('.apexcharts-canvas').count();
const noData = await page.evaluate(() => (document.body.innerText.match(/მონაცემ(ი|ები) არ არის/g) || []).length);
say(/region=[a-z_]+/.test(url1) ? 'PASS' : 'FAIL', 'R6-map slug vocab', `url=${url1}`);
say(chartsAfter >= chartsBefore && noData === 0 ? 'PASS' : 'FAIL', 'R6-map rescope data', `charts ${chartsBefore}->${chartsAfter}, no-data banners=${noData}`);
await page.screenshot({ path: `${OUT}r6-01-region-selected.png` });
await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}r6-01b-region-selected-lower.png` });
say(errs.length ? 'FAIL' : 'PASS', 'regional errors', errs.join('|') || 'zero');

// ── 2. Filter gaps ───────────────────────────────────────────────────────────
const gap = await page.evaluate(() => {
  const bar = document.querySelector('.filter-bar');
  return bar ? getComputedStyle(bar).gap : null;
});
say(gap && parseFloat(gap) >= 14 ? 'PASS' : 'FAIL', 'R6-filter gap', `gap=${gap}`);

// ── 3. Regional dynamics: NEW slider ─────────────────────────────────────────
await tab('დინამიკა');
const regRails = await page.locator('.chart-brush-rail .apexcharts-canvas').count();
say(regRails >= 1 ? 'PASS' : 'FAIL', 'R6-slider regional dynamics', `rails=${regRails}`);
await page.screenshot({ path: `${OUT}r6-02-regional-dynamics-rail.png` });

// ── 4. GDP dynamics: sliders on all long year charts + gesture gate ─────────
await go('/ka/gdp');
await tab('დინამიკა');
const gdpRails = await page.locator('.chart-brush-rail .apexcharts-canvas').count();
say(gdpRails >= 3 ? 'PASS' : 'FAIL', 'R6-sliders gdp dynamics', `rails=${gdpRails} (combo + per-capita + real-growth + unobserved expected where >=8 cats)`);
// gesture gate: drag on the MAIN plot must NOT change the x-window
const main = page.locator('.apexcharts-canvas').first();
const mb = await main.boundingBox();
const ticksBefore = await page.locator('.apexcharts-xaxis-label').count();
if (mb) {
  await page.mouse.move(mb.x + mb.width * 0.3, mb.y + mb.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(mb.x + mb.width * 0.7, mb.y + mb.height * 0.4, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
}
const ticksAfter = await page.locator('.apexcharts-xaxis-label').count();
say(ticksBefore === ticksAfter ? 'PASS' : 'FAIL', 'R6-no drag-zoom', `xticks ${ticksBefore}->${ticksAfter} after plot drag`);
// brush still drives: drag inside the first rail
const rail = page.locator('.chart-brush-rail .apexcharts-canvas').first();
const rb = await rail.boundingBox();
if (rb) {
  await page.mouse.move(rb.x + rb.width * 0.35, rb.y + rb.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.65, rb.y + rb.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
}
const ticksBrushed = await page.locator('.apexcharts-xaxis-label').count();
say(ticksBrushed < ticksAfter ? 'PASS' : 'FAIL', 'R6-brush drives window', `xticks ${ticksAfter}->${ticksBrushed} after rail drag`);
await page.screenshot({ path: `${OUT}r6-03-gdp-dynamics-sliders.png` });
say(errs.length ? 'FAIL' : 'PASS', 'gdp errors', errs.join('|') || 'zero');

// ── 5. Overlay stacking: panel must WIN over the filter bar ─────────────────
await page.evaluate(() => window.scrollTo(0, 0));
await page.hover('.inner-sidebar'); await page.waitForTimeout(700);
const winner = await page.evaluate(() => {
  const el = document.elementFromPoint(210, 203);
  return el ? (el.closest('.inner-sidebar') ? 'panel' : `${el.tagName}.${String(el.className).split(' ')[0]}`) : 'null';
});
say(winner === 'panel' ? 'PASS' : 'FAIL', 'R6-overlay above layout', `elementFromPoint=${winner}`);
await page.screenshot({ path: `${OUT}r6-04-rail-over-layout.png` });
await page.mouse.move(900, 900); await page.waitForTimeout(400);

// ── 6. Dark popover: border + raised surface ─────────────────────────────────
await go('/ka/regional');
await page.locator('header button').last().click(); await page.waitForTimeout(800);
await page.click('.filter-control__multiselect'); await page.waitForTimeout(700);
const pop = await page.evaluate(() => {
  const c = document.querySelector('.ui-multiselect__content');
  if (!c) return null;
  const cs = getComputedStyle(c);
  return { borderW: cs.borderWidth, bg: cs.backgroundColor };
});
say(pop && pop.borderW !== '0px' && pop.bg !== 'rgb(21, 21, 31)' ? 'PASS' : 'FAIL', 'R6-dark popover surface', JSON.stringify(pop));
await page.screenshot({ path: `${OUT}r6-05-dark-popover.png` });

await browser.close();
console.log(`\n=== WALK R6: ${R.filter(s => s === 'PASS').length} PASS / ${R.filter(s => s === 'FAIL').length} FAIL ===`);
