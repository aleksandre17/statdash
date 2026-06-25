// Headless probe of the live geostat front — captures every /api/* request
// (status + a body snippet) and all console/page errors, to see EXACTLY what the
// renderer fetches and what comes back. Run inside the mcr playwright image.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const api = [];
  const logs = [];

  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => api.push(`FAILED  ${r.url()}  :: ${r.failure() && r.failure().errorText}`));
  page.on('response', async r => {
    const u = r.url();
    if (!u.includes('/api/')) return;
    let info = `${r.status()}  ${u}`;
    try {
      const b = await r.text();
      info += `  (${b.length}b)`;
      if (/observations|cube|data-sources|bootstrap|catalog|classif|display/.test(u)) {
        info += `  :: ${b.slice(0, 160).replace(/\s+/g, ' ')}`;
      }
    } catch (e) { info += `  (body-read-err)`; }
    api.push(info);
  });

  const target = process.env.TARGET || 'http://statdash-geostat/en';
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 35000 });
  } catch (e) { logs.push(`[goto-error] ${e.message}`); }
  await page.waitForTimeout(4000);

  // Does the DOM actually have chart/table content, or empty states?
  const domSummary = await page.evaluate(() => {
    const txt = document.body ? document.body.innerText.slice(0, 400) : '(no body)';
    const svg = document.querySelectorAll('svg').length;
    const canvas = document.querySelectorAll('canvas').length;
    const tables = document.querySelectorAll('table').length;
    const apexcharts = document.querySelectorAll('.apexcharts-canvas').length;
    return { svg, canvas, tables, apexcharts, txt };
  }).catch(e => ({ err: String(e) }));

  console.log('===== API REQUESTS =====');
  api.forEach(x => console.log(x));
  console.log('\n===== CONSOLE / PAGE ERRORS =====');
  logs.forEach(x => console.log(x));
  console.log('\n===== DOM SUMMARY =====');
  console.log(JSON.stringify(domSummary, null, 2));

  await browser.close();
})().catch(e => { console.error('PROBE-FATAL', e); process.exit(1); });
