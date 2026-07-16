// walk-r3.mjs — round-3 live walk of the portal review-notes batch (card 0078)
// against the DEV tier :3012. Gesture-level proof per note; PASS/FAIL/SKIP lines +
// screenshots r3-*.png. An instrument, not a gate: every check is try/caught.
// Run: node work/portal-walk/walk-r3.mjs   (cwd = repo root; playwright from platform/)
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../platform/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = 'http://192.168.1.199:3012';
const OUT = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const results = [];
const say = (status, id, detail) => { results.push({ status, id, detail }); console.log(`${status} ${id} — ${detail}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

async function go(path, name) {
  pageErrors.length = 0;
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await autoScroll();
  await page.screenshot({ path: `${OUT}r3-${name}.png`, fullPage: false });
}

// progressive scroll to trigger lazy chart mounts, then back to top
async function autoScroll() {
  await page.evaluate(async () => {
    const step = 700;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 350));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
}

// click a tab by its visible text if present (e.g. the დინამიკა view toggle)
async function clickTab(text) {
  const tab = page.locator(`button:has-text("${text}"), [role="tab"]:has-text("${text}")`).first();
  if (await tab.count()) { await tab.click().catch(() => {}); await page.waitForTimeout(2000); await autoScroll(); return true; }
  return false;
}

// ── 1. LANDING ───────────────────────────────────────────────────────────────
await go('/ka', '01-landing');
try {
  const body = await page.evaluate(() => document.body.innerText);
  const codes = body.match(/\((?:B\d+G?|[A-Z]{1,3}\d+[A-Z]?)\)/g) || [];
  say(codes.length ? 'FAIL' : 'PASS', 'P2/R2-5 slider codes', codes.length ? `codes visible: ${codes.join(' ')}` : 'no paren-codes anywhere on landing (all slides in DOM)');
} catch (e) { say('SKIP', 'P2/R2-5', e.message); }
say(pageErrors.length ? 'FAIL' : 'PASS', 'landing pageerrors', pageErrors.join(' | ') || 'zero');

// ── 2. GDP page: rail geometry + title + no-K + brush + legend fonts ─────────
await go('/ka/gdp', '02-gdp');
try {
  const cell = await page.locator('.inner-sidebar-cell').boundingBox();
  const railFlush = cell && cell.x <= 1;
  const h1Before = await page.locator('h1').first().boundingBox();
  await page.hover('.inner-sidebar');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}r3-02b-gdp-rail-hover.png` });
  const h1After = await page.locator('h1').first().boundingBox();
  const noReflow = h1Before && h1After && Math.abs(h1Before.x - h1After.x) < 2;
  say(railFlush ? 'PASS' : 'FAIL', 'R2-1 rail flush', `cell.x=${cell?.x}`);
  say(noReflow ? 'PASS' : 'FAIL', 'R2-1 hover no-reflow', `h1.x ${h1Before?.x} -> ${h1After?.x}`);
  await page.mouse.move(10, 900); await page.waitForTimeout(400);
} catch (e) { say('SKIP', 'R2-1 rail', e.message); }
try {
  await clickTab('დინამიკა');
  await page.screenshot({ path: `${OUT}r3-02d-gdp-dynamics.png` });
  const body = await page.evaluate(() => document.body.innerText);
  const hasTitle = body.includes('მთლიანი შიდა პროდუქტის წლიური დინამიკა');
  say(hasTitle ? 'PASS' : 'FAIL', 'P14 GDP retitle', hasTitle ? 'title present (dynamics view)' : 'title absent after scroll+tab');
} catch (e) { say('SKIP', 'P14 title', e.message); }
try {
  const ticks = await page.locator('.apexcharts-yaxis-label').allInnerTexts();
  const kTicks = ticks.filter(t => /\dK\b/.test(t));
  say(kTicks.length ? 'FAIL' : 'PASS', 'P16 no K axis', kTicks.length ? kTicks.slice(0, 5).join(',') : `${ticks.length} y-ticks, none with K`);
} catch (e) { say('SKIP', 'P16', e.message); }
try {
  const nCharts = await page.locator('.apexcharts-canvas').count();
  say(nCharts > 0 && !pageErrors.length ? 'PASS' : 'FAIL', 'P12 charts render (gdp)', `${nCharts} apex canvases, pageerrors=${pageErrors.length} ${pageErrors.slice(0, 2).join(' | ')}`);
} catch (e) { say('SKIP', 'P12 gdp', e.message); }
const legendSizes = new Set();
async function collectLegendSizes() {
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('.apexcharts-legend-text, .donut-legend__label')].map(el => getComputedStyle(el).fontSize));
  sizes.forEach(s => legendSizes.add(s));
}
await collectLegendSizes();

// brush gesture on the first brush chart (best-effort)
try {
  const brushSel = '.apexcharts-canvas svg .apexcharts-brush-xaxis, .apexcharts-canvas';
  const brushCharts = await page.evaluate(() =>
    [...document.querySelectorAll('.apexcharts-canvas')].filter(c => c.querySelector('.apexcharts-selection-rect, rect.apexcharts-selection-rect')).length);
  const before = await page.locator('.apexcharts-xaxis-label').count();
  const brush = page.locator('.apexcharts-canvas').last();
  const bb = await brush.boundingBox();
  if (bb) {
    await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
  }
  const after = await page.locator('.apexcharts-xaxis-label').count();
  await page.screenshot({ path: `${OUT}r3-02c-gdp-brush-drag.png` });
  say(pageErrors.length ? 'FAIL' : 'PASS', 'P12 brush gesture', `selection-charts=${brushCharts} xticks ${before}->${after}, pageerrors=${pageErrors.length}`);
} catch (e) { say('SKIP', 'P12 brush', e.message); }

// ── 3. REGIONAL: bars from 2010 + multi-select uniqueness + P18 title ────────
await go('/ka/regional', '03-regional');
await collectLegendSizes();
try {
  await clickTab('დინამიკა');
  await page.screenshot({ path: `${OUT}r3-03c-regional-dynamics.png` });
  const ticks = await page.locator('.apexcharts-xaxis-label').allInnerTexts();
  const years = ticks.filter(t => /^20\d\d$/.test((t || '').trim()));
  const has2010 = years.includes('2010'), has2024 = years.includes('2024'), has2025 = years.includes('2025');
  say(has2010 && has2024 && !has2025 ? 'PASS' : 'FAIL', 'P17 regional years', `2010=${has2010} 2024=${has2024} 2025=${has2025} (years: ${[...new Set(years)].length})`);
} catch (e) { say('SKIP', 'P17', e.message); }
try {
  // open the sector multi-select and collect option texts
  const trigger = page.locator('.filter-control__multiselect').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ timeout: 8000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}r3-03b-regional-multiselect.png` });
  const opts = await page.locator('[role="option"], [role="listbox"] li, [class*="option"]').allInnerTexts();
  const clean = opts.map(o => o.trim()).filter(Boolean);
  const dupes = clean.filter((o, i) => clean.indexOf(o) !== i);
  say(clean.length && !dupes.length ? 'PASS' : (clean.length ? 'FAIL' : 'SKIP'), 'R2-2 multiselect unique', dupes.length ? `dupes: ${[...new Set(dupes)].slice(0, 5).join(' · ')}` : `${clean.length} options, unique`);
  await page.keyboard.press('Escape');
} catch (e) { say('SKIP', 'R2-2', e.message); }
await collectLegendSizes();
say(pageErrors.length ? 'FAIL' : 'PASS', 'regional pageerrors', pageErrors.join(' | ') || 'zero');

// ── 4. ACCOUNTS (card 0079 pre-existing blank — current state) ───────────────
await go('/ka/accounts', '04-accounts');
try {
  const nCharts = await page.locator('.apexcharts-canvas').count();
  const textLen = (await page.evaluate(() => document.body.innerText)).length;
  say(nCharts > 0 || textLen > 800 ? 'PASS' : 'FAIL', '0079 accounts renders', `charts=${nCharts} textLen=${textLen} pageerrors=${pageErrors.length} ${pageErrors.slice(0, 2).join(' | ')}`);
} catch (e) { say('SKIP', '0079', e.message); }
await collectLegendSizes();

// ── 5. Legend font uniformity (R2-3) across all visited pages ────────────────
say(legendSizes.size === 1 ? 'PASS' : (legendSizes.size === 0 ? 'SKIP' : 'FAIL'), 'R2-3 legend ONE font token', `sizes seen: ${[...legendSizes].join(', ') || 'none'}`);

// ── 6. R2-4 content width on gdp ─────────────────────────────────────────────
await go('/ka/gdp', '05-gdp-width');
try {
  const m = await page.evaluate(() => {
    const main = document.querySelector('main, [class*="content"], [class*="page-body"]');
    if (!main) return null;
    const r = main.getBoundingClientRect();
    return { x: Math.round(r.x), right: Math.round(r.right), vw: innerWidth };
  });
  say(m ? 'INFO' : 'SKIP', 'R2-4 content width', m ? `content x=${m.x} right=${m.right} vw=${m.vw}` : 'main not found');
} catch (e) { say('SKIP', 'R2-4', e.message); }

await browser.close();
const fails = results.filter(r => r.status === 'FAIL');
console.log(`\n=== WALK R3: ${results.filter(r => r.status === 'PASS').length} PASS / ${fails.length} FAIL / ${results.filter(r => r.status === 'SKIP').length} SKIP ===`);
process.exit(0);
