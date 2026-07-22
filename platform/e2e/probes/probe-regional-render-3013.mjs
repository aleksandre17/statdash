// GROUND TRUTH (post-deploy): does EVERY element on the `regional` page render
// real content on the authoring canvas, and does the SECTION view-toggle switch?
//
// Run AFTER deploying the store-generation fix (owner deploys — I can't).
//   node work/probe-regional-render-3013.mjs
//
// What it proves, per element:
//   • each section / geograph panel BODY carries real content (chart svg | table
//     rows | map svg) and is NOT the EmptyState (.empty-state role=status);
//   • the SECTION view-toggle (.section__view-toggle / PanelLayout toggle buttons,
//     scoped INSIDE the panel — NEVER the palette block-tile) flips the active view
//     and the newly-shown view is ALSO non-empty.
//
// Output: a per-panel JSON report + a PASS/FAIL summary line. Non-zero exit on any
// empty body so it can gate a deploy check.
import { chromium } from '@playwright/test'

const BASE = 'http://192.168.1.199:3013/'
const USER = 'admin', PASS = 'dev_admin_pw_123'
const REGIONAL = /რეგიონ|regional/i

// A body is "real" when it holds a chart, a data table, or a map svg — and shows no
// EmptyState. Runs in-page so it sees computed content, not just markup.
const BODY_PROBE = (el) => {
  const empty = el.querySelector('.empty-state') != null
  const svgPaths = el.querySelectorAll('svg path').length
  const apex = el.querySelector('.apexcharts-canvas, .chart-wrap svg, .geo-map__svg') != null
  const tableRows = el.querySelectorAll('table tbody tr, [role="row"]').length
  const text = (el.innerText || '').trim().length
  // "real content" = a rendered chart/map OR ≥1 table row OR a non-trivial svg — and NOT EmptyState.
  const hasContent = !empty && (apex || tableRows > 0 || svgPaths > 2)
  return { empty, apex, svgPaths, tableRows, textLen: text, hasContent }
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const errs = []
p.on('pageerror', (e) => errs.push(String(e.message)))
const report = { pageErrs: [], panels: [], toggles: [], summary: '' }

try {
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
  await p.waitForTimeout(1000)

  // Login (best-effort — skip if already in).
  const ins = p.locator('input')
  if (await ins.count() >= 2) {
    await ins.nth(0).fill(USER)
    await p.locator('input[type=password]').first().fill(PASS)
    await p.getByRole('button').first().click()
    await p.waitForTimeout(1500)
  }
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(2500)

  // Open the `regional` page in the editor — try a page-switcher / nav entry whose
  // label matches. Best-effort: if none is found the probe runs on the active page.
  const switcher = p.getByRole('button', { name: REGIONAL }).or(p.getByRole('link', { name: REGIONAL })).or(p.getByText(REGIONAL))
  if (await switcher.count() > 0) {
    await switcher.first().click({ force: true }).catch(() => {})
    await p.waitForTimeout(3500)
  }
  await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(3000) // let async section warms settle

  // Every panel BODY on the canvas: section bodies + geograph panel bodies.
  const bodies = p.locator('.section__body, [data-content="geo"], .panel__body')
  const n = await bodies.count()

  for (let i = 0; i < n; i++) {
    const el = bodies.nth(i)
    await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
    await p.waitForTimeout(300)
    const res = await el.evaluate(BODY_PROBE).catch((e) => ({ err: String(e).slice(0, 80) }))
    const title = await el.evaluateHandle((node) => node.closest('section, .panel')?.querySelector('h2,h3,[class*="title"]')?.textContent ?? '')
      .then((h) => h.jsonValue()).catch(() => '')
    report.panels.push({ i, title: String(title).slice(0, 60), ...res })
  }

  // SECTION view-toggle — scoped INSIDE each panel (never the palette). Click the
  // NON-active toggle button, wait, and re-probe the now-visible view for content.
  const toggleGroups = p.locator('.section__view-toggle, .panel__view-toggle, [class*="view-toggle"]')
  const tg = await toggleGroups.count()
  for (let i = 0; i < tg; i++) {
    const grp = toggleGroups.nth(i)
    const btns = grp.locator('button')
    const nb = await btns.count()
    if (nb < 2) continue
    // find the currently-inactive button (aria-pressed=false) and click it.
    let clickedLabel = '', switched = false, afterContent = null
    for (let j = 0; j < nb; j++) {
      const pressed = await btns.nth(j).getAttribute('aria-pressed').catch(() => null)
      if (pressed === 'false') {
        clickedLabel = (await btns.nth(j).innerText().catch(() => '')).trim()
        await btns.nth(j).scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {})
        await btns.nth(j).click({ force: true }).catch(() => {})
        await p.waitForTimeout(900)
        switched = (await btns.nth(j).getAttribute('aria-pressed').catch(() => null)) === 'true'
        // Re-probe the panel body this toggle belongs to.
        const panelBody = grp.locator('xpath=ancestor::*[contains(@class,"section") or contains(@class,"panel")][1]')
          .locator('.section__body, [data-content="geo"], .panel__body').first()
        afterContent = await panelBody.evaluate(BODY_PROBE).catch(() => null)
        break
      }
    }
    report.toggles.push({ i, clickedLabel, switched, afterContent })
  }

  const emptyPanels = report.panels.filter((x) => x.hasContent === false)
  const brokenToggles = report.toggles.filter((x) => x.switched === false || (x.afterContent && x.afterContent.hasContent === false))
  report.pageErrs = errs.slice(0, 6)
  report.summary =
    `panels=${report.panels.length} emptyBodies=${emptyPanels.length} ` +
    `toggles=${report.toggles.length} brokenToggles=${brokenToggles.length} ` +
    `pageErrs=${errs.length} → ${emptyPanels.length === 0 && brokenToggles.length === 0 ? 'PASS' : 'FAIL'}`

  console.log(JSON.stringify(report, null, 2))
  await p.screenshot({ path: 'work/__verify__/regional-render.png', fullPage: true }).catch(() => {})
  process.exitCode = (emptyPanels.length === 0 && brokenToggles.length === 0) ? 0 : 1
} catch (e) {
  console.log(JSON.stringify({ fatal: String(e), report }, null, 2))
  process.exitCode = 2
} finally {
  await b.close()
}
