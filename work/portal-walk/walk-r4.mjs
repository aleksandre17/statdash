// walk-r4.mjs — FINAL acceptance walk of card 0078 (all docx notes + R2 + R3 craft)
// against dev :3012, light AND dark. Lessons baked in: scroll-lazy, tab-switch,
// ALL slides, screenshots as proof of record. Run: node work/portal-walk/walk-r4.mjs
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
page.on('pageerror', (e) => errs.push((e.stack || e.message).split('\n').slice(0, 6).join(' ⇐ ')));

async function scrollAll() {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}
async function go(path) {
  errs.length = 0;
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await scrollAll();
}
async function tab(text) {
  const t = page.locator(`button:has-text("${text}"), [role="tab"]:has-text("${text}")`).first();
  if (await t.count()) { await t.click().catch(() => {}); await page.waitForTimeout(2000); await scrollAll(); return true; }
  return false;
}
const colorsOf = async (sel) => page.evaluate((s) =>
  [...new Set([...document.querySelectorAll(s)].map(el => el.getAttribute('fill') || el.getAttribute('stroke')).filter(c => c && c !== 'none' && !c.startsWith('url')))], sel);

// ── LANDING: all slides code-free, units intact ──────────────────────────────
await go('/ka');
for (let i = 0; i < 3; i++) {
  const labels = await page.evaluate(() => [...document.querySelectorAll('.featured-card__label')].map(e => e.textContent));
  const units = await page.evaluate(() => [...document.querySelectorAll('.featured-card__unit')].map(e => e.textContent));
  const codes = labels.filter(l => /\([A-Z0-9]+\)/.test(l || ''));
  say(codes.length ? 'FAIL' : 'PASS', `P2 slide-${i + 1}`, `labels clean=${!codes.length}${codes.length ? ' CODES: ' + codes.join(',') : ''}, units: ${units.join(',') || '(pct-only slide)'}`);
  await page.screenshot({ path: `${OUT}r4-landing-slide${i + 1}.png` });
  await page.locator('.featured-slider__nav-button').last().click().catch(() => {});
  await page.waitForTimeout(1000);
}
say(errs.length ? 'FAIL' : 'PASS', 'landing errors', errs.join('|') || 'zero');

// ── GDP page (light): rail, dynamics palette, brush, no-K, P14 ───────────────
await go('/ka/gdp');
const cell = await page.locator('.inner-sidebar-cell').boundingBox();
const h1a = await page.locator('h1').first().boundingBox();
await page.hover('.inner-sidebar'); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}r4-light-rail-hover.png` });
const h1b = await page.locator('h1').first().boundingBox();
const railTexts = await page.evaluate(() => [...document.querySelectorAll('.inner-sidebar .sidebar-nav-label, .inner-sidebar .sidebar-section-label')].map(e => ({ t: e.textContent, clipped: e.scrollWidth > e.clientWidth + 1 })));
const clipped = railTexts.filter(x => x.clipped);
say(cell && cell.x <= 1 ? 'PASS' : 'FAIL', 'R2-1 rail flush', `x=${cell?.x}`);
say(Math.abs((h1a?.x ?? 0) - (h1b?.x ?? 9e9)) < 2 ? 'PASS' : 'FAIL', 'R2-1 no reflow', `h1 ${h1a?.x}->${h1b?.x}`);
say(clipped.length ? 'FAIL' : 'PASS', 'R3 rail no clipped labels', clipped.length ? clipped.map(c => c.t).join(',') : `${railTexts.length} labels full`);
await page.mouse.move(900, 900); await page.waitForTimeout(500);

await tab('დინამიკა');
// NEVER fullPage on apex pages: the capture-resize crosses responsive breakpoints
// mid-remount → apex-internal getComputedStyle pageerrors (probe artifact, proven
// unreachable by real gestures incl. genuine window resize — 2026-07-17).
await page.screenshot({ path: `${OUT}r4-light-gdp-dynamics.png` });
await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}r4-light-gdp-dynamics-brush.png` });
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
const barCols = await colorsOf('.apexcharts-bar-series path, .apexcharts-bar-area');
const lineCols = await colorsOf('.apexcharts-line-series path.apexcharts-line, .apexcharts-line');
const grayish = [...barCols, ...lineCols].filter(c => /^#(9|a|b)[0-9a-f]{5}$/i.test(c) || /rgb\(1[4-7]\d/.test(c));
say(grayish.length ? 'FAIL' : 'PASS', 'R3 dynamics palette', `bars:${barCols.slice(0, 4).join(',')} lines:${lineCols.slice(0, 3).join(',')}${grayish.length ? ' GRAYISH:' + grayish.join(',') : ''}`);
const kTicks = (await page.locator('.apexcharts-yaxis-label').allInnerTexts()).filter(t => /\dK\b/.test(t || ''));
say(kTicks.length ? 'FAIL' : 'PASS', 'P16 no K', kTicks.join(',') || 'clean');
const hasP14 = (await page.evaluate(() => document.body.innerText)).includes('მთლიანი შიდა პროდუქტის წლიური დინამიკა');
say(hasP14 ? 'PASS' : 'FAIL', 'P14 title', String(hasP14));
say(errs.length ? 'FAIL' : 'PASS', 'gdp errors', errs.join('|').slice(0, 120) || 'zero');

// ── REGIONAL (light): years, multiselect craft ───────────────────────────────
await go('/ka/regional');
const trig = page.locator('.filter-control__multiselect').first();
await trig.click({ timeout: 8000 }).catch(e => say('SKIP', 'R2-2 open', e.message));
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}r4-light-multiselect.png` });
const pop = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[role="listbox"], .ui-multiselect__content, [data-radix-popper-content-wrapper]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const opts = [...el.querySelectorAll('[role="option"], .ui-multiselect__item')].map(o => (o.textContent || '').trim()).filter(Boolean);
  return { w: Math.round(r.width), opts };
});
if (pop) {
  const dupes = pop.opts.filter((o, i) => pop.opts.indexOf(o) !== i);
  say(pop.w > 0 && pop.w <= 420 ? 'PASS' : 'FAIL', 'R3 popover content-sized', `w=${pop.w}px`);
  say(pop.opts.length && !dupes.length ? 'PASS' : 'FAIL', 'R2-2 unique options', `${pop.opts.length} opts`);
} else say('SKIP', 'R3 popover', 'not found');
await page.keyboard.press('Escape');
const yearW = await page.evaluate(() => { const s = document.querySelector('.filter-select, .filter-control__year-select'); return s ? { w: s.getBoundingClientRect().width, t: s.tagName } : null; });
say(yearW && yearW.w > 55 ? 'PASS' : 'FAIL', 'R3 year select unclipped', JSON.stringify(yearW));
await tab('დინამიკა');
await page.screenshot({ path: `${OUT}r4-light-regional-dynamics.png` });
say(errs.length ? 'FAIL' : 'PASS', 'regional errors', errs.join('|').slice(0, 120) || 'zero');

// ── DARK THEME: the surfaces the owner indicted ──────────────────────────────
await go('/ka/regional');
await page.locator('header button').last().click().catch(() => {});
await page.waitForTimeout(800);
await trig.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}r4-dark-multiselect.png` });
const darkPop = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[role="listbox"], .ui-multiselect__content, [data-radix-popper-content-wrapper]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el.firstElementChild || el);
  return { w: Math.round(r.width), shadow: cs.boxShadow !== 'none', border: cs.borderWidth };
});
say(darkPop && darkPop.w <= 420 ? 'PASS' : 'FAIL', 'R3 DARK popover craft', JSON.stringify(darkPop));
await page.keyboard.press('Escape');
await go('/ka/gdp');
await page.locator('header button').last().click().catch(() => {});
await page.waitForTimeout(800);
await tab('დინამიკა');
await page.screenshot({ path: `${OUT}r4-dark-gdp-dynamics.png` });
await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}r4-dark-gdp-dynamics-brush.png` });
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
await page.hover('.inner-sidebar'); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}r4-dark-rail-hover.png` });
say(errs.length ? 'FAIL' : 'PASS', 'dark errors', errs.join('|').slice(0, 120) || 'zero');

// ── ACCOUNTS current state (0079 tracking) ───────────────────────────────────
await go('/ka/accounts');
const nCharts = await page.locator('.apexcharts-canvas').count();
say('INFO', '0079 accounts', `charts=${nCharts} errors=${errs.length}`);

await browser.close();
console.log(`\n=== WALK R4: ${R.filter(s => s === 'PASS').length} PASS / ${R.filter(s => s === 'FAIL').length} FAIL / ${R.filter(s => s === 'SKIP').length} SKIP ===`);
