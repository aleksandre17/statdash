// Headless probe of the live panel (Constructor) — logs in, lets it boot + load a page,
// and checks whether the live-preview canvas renders data (no cold/Failed crashes).
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const logs = []; const api = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('response', async r => {
    const u = r.url(); if (!u.includes('/api/')) return;
    try { const b = await r.text(); api.push(`${r.status()} ${u.split('/api/')[1].slice(0,46)} (${b.length}b)`); } catch {}
  });

  const base = process.env.TARGET || 'http://statdash-panel';
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => logs.push('[goto1] ' + e.message));
  const login = await page.evaluate(async (b) => {
    const res = await fetch(b + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'statdash-admin-2026' }) });
    const j = await res.json();
    if (j && j.data && j.data.token) { sessionStorage.setItem('geostat_panel_token', j.data.token); return 'ok'; }
    return 'FAIL ' + JSON.stringify(j).slice(0,120);
  }, base).catch(e => 'login-err ' + e.message);
  logs.push('[login] ' + login);

  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 35000 }).catch(e => logs.push('[goto2] ' + e.message));
  await page.waitForTimeout(4000);

  // Navigate to the Pages step (step 3, "გვერდები") where the live canvas preview renders.
  for (const sel of ['text=/^\\s*3\\s/', 'text=გვერდები', '[data-step="pages"]', 'button:has-text("გვერდები")']) {
    try { await page.locator(sel).first().click({ timeout: 3000 }); logs.push('[nav] clicked step ' + sel); break; }
    catch (e) { /* try next */ }
  }
  await page.waitForTimeout(2500);
  // Open the page browser (PAGES) and select the first real page → loads it into the canvas.
  try { await page.locator('text=PAGES').first().click({ timeout: 3000 }); logs.push('[nav] opened PAGES'); } catch (e) { logs.push('[nav] PAGES click failed: ' + e.message); }
  await page.waitForTimeout(1500);
  // click the first page entry in the browser (try a few likely names/roles)
  for (const sel of ['text=accounts', 'text=GDP', 'text=gdp', '[role="option"]', '[role="listitem"]', '.page-browser li', 'li']) {
    try { await page.locator(sel).first().click({ timeout: 2500 }); logs.push('[nav] selected page via ' + sel); break; }
    catch (e) { /* next */ }
  }
  await page.waitForTimeout(8000);

  const dom = await page.evaluate(() => ({
    svg: document.querySelectorAll('svg').length,
    canvas: document.querySelectorAll('canvas').length,
    tables: document.querySelectorAll('table').length,
    apexcharts: document.querySelectorAll('.apexcharts-canvas').length,
    failedToLoad: (document.body.innerText.match(/Failed to load/g) || []).length,
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
  })).catch(e => ({ err: String(e) }));

  console.log('===== API (panel) ====='); api.slice(0, 30).forEach(x => console.log(x));
  console.log('\n===== ERRORS / login ====='); logs.filter(l => /error|crash|cold|Failed|HTTP 4|login|pageerror|StoreBuilder/i.test(l)).slice(0, 20).forEach(x => console.log(x));
  console.log('\n===== DOM ====='); console.log(JSON.stringify(dom, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE-FATAL', e); process.exit(1); });
