// ── probe-proactive-sweep 2026-07-18 — reference-class walk of portal (:3012) + studio (:3013) ──
// READ-ONLY intent: no destructive gestures (no Delete, no committed drops); Esc-cancels everywhere.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const PORTAL = 'http://192.168.1.199:3012'
const STUDIO = 'http://192.168.1.199:3013'
const OUT = 'work/authoring-truth/sweep'
mkdirSync(OUT, { recursive: true })
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()

// ═══════════════ PORTAL ═══════════════
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 160)))

  const a11yCensus = () => ({
    unlabeledButtons: [...document.querySelectorAll('button')].filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    imgsNoAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length,
    skipLink: !!document.querySelector('a[href="#main"], a[href="#content"], .skip-link'),
    lang: document.documentElement.lang,
    h1s: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 60)),
    headerControls: [...document.querySelectorAll('header button, header a, nav button')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40)).filter(Boolean),
    hasSearch: !!document.querySelector('input[type="search"], [role="search"], [aria-label*="search" i], [aria-label*="ძებნა"]'),
    sourceMentions: (document.body.innerText.match(/წყარო|Source:/g) || []).length,
    methodology: (document.body.innerText.match(/მეთოდოლოგ|methodolog/gi) || []).length,
    lastUpdated: (document.body.innerText.match(/განახლებ|last updated|updated/gi) || []).length,
    preliminary: (document.body.innerText.match(/წინასწარი|preliminary/gi) || []).length,
    exportBtns: [...document.querySelectorAll('button, a')].filter(b => /export|ჩამოტვირთ|გადმოწერ|download|CSV|XLSX/i.test((b.textContent || '') + (b.getAttribute('aria-label') || ''))).length,
    shareBtns: [...document.querySelectorAll('button, a')].filter(b => /share|გაზიარებ|ბმული|permalink/i.test((b.textContent || '') + (b.getAttribute('aria-label') || ''))).length,
    rawTokens: [...document.querySelectorAll('body *')].map(e => e.childNodes.length === 1 && e.firstChild?.nodeType === 3 ? e.textContent.trim() : '').filter(t => /^(--[a-z-]+|\{\{.+\}\}|[A-Z]{2,5}_[A-Z0-9_]{2,})$/.test(t)).slice(0, 8),
    tables: document.querySelectorAll('table').length,
    figures: document.querySelectorAll('svg, canvas').length,
  })

  for (const path of ['/ka', '/ka/gdp', '/ka/regional', '/ka/accounts']) {
    errs.length = 0
    await page.goto(PORTAL + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => log('portal-goto', { path, error: String(e).slice(0, 120) }))
    await page.waitForTimeout(2000)
    const census = await page.evaluate(a11yCensus).catch(e => ({ evalError: String(e).slice(0, 120) }))
    log('portal-census', { path, consoleErrors: errs.slice(0, 6), errCount: errs.length, ...census })
    await page.screenshot({ path: `${OUT}/portal${path.replace(/\//g, '-')}.png` })
  }

  // dark mode on /ka
  await page.goto(PORTAL + '/ka', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1200)
  const themeBtn = page.locator('button[aria-label*="theme" i], button[aria-label*="თემა"], button[aria-label*="მუქი"], button[aria-label*="dark" i], [data-theme-toggle]').first()
  if (await themeBtn.count()) {
    await themeBtn.click().catch(() => {})
    await page.waitForTimeout(1200)
    const mode = await page.evaluate(() => ({ htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme'), bodyBg: getComputedStyle(document.body).backgroundColor }))
    log('portal-dark', mode)
    await page.screenshot({ path: `${OUT}/portal-ka-dark.png`, fullPage: false })
    await page.goto(PORTAL + '/ka/regional', { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/portal-regional-dark.png` })
  } else log('portal-dark', { found: false, note: 'no theme toggle located by aria heuristics' })

  // EN locale gap scan
  errs.length = 0
  await page.goto(PORTAL + '/en', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1500)
  const enScan = await page.evaluate(() => {
    const txt = document.body.innerText
    const georgian = [...new Set((txt.match(/[Ⴀ-ჿ][Ⴀ-ჿ ,.\-–]{3,}/g) || []).map(s => s.trim().slice(0, 50)))]
    return { lang: document.documentElement.lang, georgianLeaks: georgian.slice(0, 15), leakCount: georgian.length, chars: txt.length }
  }).catch(e => ({ evalError: String(e) }))
  log('portal-en', { consoleErrors: errs.slice(0, 4), ...enScan })
  await page.screenshot({ path: `${OUT}/portal-en.png` })
  await page.goto(PORTAL + '/en/gdp', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1500)
  const enGdp = await page.evaluate(() => {
    const txt = document.body.innerText
    return { georgianLeaks: [...new Set((txt.match(/[Ⴀ-ჿ][Ⴀ-ჿ ,.\-–]{3,}/g) || []).map(s => s.trim().slice(0, 50)))].slice(0, 15) }
  }).catch(() => ({}))
  log('portal-en-gdp', enGdp)

  // mobile + tablet overflow
  for (const [w, h, name] of [[390, 844, 'mobile'], [768, 1024, 'tablet']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(PORTAL + '/ka/regional', { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(1800)
    const ovf = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
      overflowEls: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 8 && e.getBoundingClientRect().width > 50).slice(0, 5).map(e => e.className?.toString?.().slice(0, 60) || e.tagName),
    })).catch(() => ({}))
    log('portal-viewport', { name, w, ...ovf })
    await page.screenshot({ path: `${OUT}/portal-regional-${name}.png` })
  }

  // keyboard walk on /ka
  await page.setViewportSize({ width: 1600, height: 950 })
  await page.goto(PORTAL + '/ka', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1200)
  const tabTrail = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    const el = await page.evaluate(() => {
      const a = document.activeElement
      if (!a || a === document.body) return null
      const st = getComputedStyle(a)
      return { tag: a.tagName, name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 35), outline: st.outlineStyle !== 'none' || st.boxShadow !== 'none' }
    }).catch(() => null)
    tabTrail.push(el)
  }
  log('portal-tab-trail', { trail: tabTrail })

  // permalink: click something interactive on regional, watch URL
  await page.goto(PORTAL + '/ka/regional', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1800)
  const before = page.url()
  const interactive = page.locator('main select, main [role="tab"], main [role="combobox"], main button').first()
  if (await interactive.count()) {
    const desc = await interactive.evaluate(e => e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)).catch(() => '?')
    await interactive.click().catch(() => {})
    await page.waitForTimeout(1000)
    log('portal-permalink', { clicked: desc, urlBefore: before, urlAfter: page.url(), changed: page.url() !== before })
  }
  await page.close()
}

// ═══════════════ STUDIO ═══════════════
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 160)))

  await page.goto(STUDIO + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const passField = page.locator('input[type="password"]').first()
  if (await passField.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await passField.fill('dev_admin_pw_123')
    await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
    await page.waitForTimeout(3500)
  }
  if (!page.url().includes('/studio/insert')) {
    await page.goto(STUDIO + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(3000)
  }
  errs.length = 0
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/studio-insert.png` })

  const chrome = await page.evaluate(() => {
    const named = (list) => [...list].map(b => ({ name: (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().slice(0, 40), tag: b.tagName })).filter(x => x.name)
    return {
      unlabeledIconBtns: [...document.querySelectorAll('button')].filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
      undoRedo: named(document.querySelectorAll('button')).filter(b => /undo|redo|დაბრუნ|გაუქმებ|↩|↪/i.test(b.name)),
      saveIndicators: [...document.querySelectorAll('body *')].map(e => e.childNodes.length === 1 && e.firstChild?.nodeType === 3 ? e.textContent.trim() : '').filter(t => /შენახ|saved|saving|draft|დრაფტ|ავტო/i.test(t) && t.length < 50).slice(0, 6),
      publishBtns: named(document.querySelectorAll('button')).filter(b => /publish|გამოქვეყ/i.test(b.name)),
      topBar: named(document.querySelectorAll('header button, [class*="topbar" i] button, [class*="TopBar"] button')).slice(0, 25),
      railBtns: named(document.querySelectorAll('.studio-rail__btn, [class*="rail" i] button')).slice(0, 20),
      canvasNodes: document.querySelectorAll('[data-node-id]').length,
      paletteSearch: !!document.querySelector('[class*="palette" i] input, [class*="Palette"] input'),
      tooltipsOnRail: [...document.querySelectorAll('[class*="rail" i] button')].filter(b => b.getAttribute('title') || b.getAttribute('aria-label')).length,
      zoomControls: named(document.querySelectorAll('button')).filter(b => /zoom|100%|fit|მასშტაბ/i.test(b.name)),
      breakpointControls: named(document.querySelectorAll('button')).filter(b => /mobile|tablet|desktop|breakpoint|390|768/i.test(b.name)),
      themeToggle: named(document.querySelectorAll('button')).filter(b => /theme|dark|მუქი|თემა|light/i.test(b.name)),
      localeToggle: named(document.querySelectorAll('button, a')).filter(b => /^(KA|EN|ka|en)$/.test(b.name) || /ენა|language/i.test(b.name)),
    }
  }).catch(e => ({ evalError: String(e).slice(0, 200) }))
  log('studio-chrome', { url: page.url(), consoleErrors: errs.slice(0, 6), ...chrome })

  // gesture: select a node
  const node = page.locator('[data-node-id]').nth(2)
  if (await node.count()) {
    await node.click({ position: { x: 10, y: 10 } }).catch(() => {})
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/studio-selected.png` })
    const sel = await page.evaluate(() => ({
      dockTabs: [...document.querySelectorAll('.studio-right-dock [role="tab"], [class*="dock" i] [role="tab"], [class*="dock" i] button')].map(b => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 25)).filter(Boolean).slice(0, 15),
      selectionChrome: [...document.querySelectorAll('[class*="select" i][class*="overlay" i], [class*="Selection"]')].length,
      contextToolbar: [...document.querySelectorAll('[class*="toolbar" i] button, [class*="floating" i] button')].map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 15),
    })).catch(() => ({}))
    log('studio-selection', sel)

    // Escape → deselect?
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const afterEsc = await page.evaluate(() => document.querySelectorAll('[class*="dock" i] [role="tab"]').length).catch(() => -1)
    log('studio-esc', { dockTabsAfterEsc: afterEsc })

    // right-click → context menu?
    await node.click({ button: 'right', position: { x: 10, y: 10 } }).catch(() => {})
    await page.waitForTimeout(800)
    const ctxMenu = await page.evaluate(() => ({ menus: document.querySelectorAll('[role="menu"], [class*="context-menu" i], [class*="ContextMenu"]').length })).catch(() => ({}))
    log('studio-rightclick', ctxMenu)
    await page.screenshot({ path: `${OUT}/studio-rightclick.png` })
    await page.keyboard.press('Escape')

    // double-click a text part → inline edit?
    const textEl = page.locator('[data-node-id] h1, [data-node-id] h2, [data-node-id] p').first()
    if (await textEl.count()) {
      await textEl.dblclick().catch(() => {})
      await page.waitForTimeout(800)
      const inlineEdit = await page.evaluate(() => ({ editable: !!document.querySelector('[contenteditable="true"]'), activeInput: document.activeElement?.tagName })).catch(() => ({}))
      log('studio-dblclick-inline-edit', inlineEdit)
      await page.keyboard.press('Escape')
    }
  }

  // Ctrl+K command palette / Ctrl+Z undo signal / ? shortcut sheet
  await page.keyboard.press('Control+k'); await page.waitForTimeout(700)
  const ctrlK = await page.evaluate(() => ({ dialog: document.querySelectorAll('[role="dialog"], [class*="command" i], [class*="cmdk" i]').length })).catch(() => ({}))
  log('studio-ctrlK', ctrlK)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+?'); await page.waitForTimeout(600)
  const helpSheet = await page.evaluate(() => ({ dialog: document.querySelectorAll('[role="dialog"]').length })).catch(() => ({}))
  log('studio-shortcut-sheet', helpSheet)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700)
  const undoToast = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('[class*="toast" i], [role="status"], [role="alert"]')].map(t => t.textContent.trim().slice(0, 60)) })).catch(() => ({}))
  log('studio-ctrlZ', undoToast)

  // keyboard tab into canvas — are nodes focusable?
  const kbd = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-node-id]')]
    return { focusableNodes: nodes.filter(n => n.tabIndex >= 0 || n.querySelector('[tabindex]')).length, totalNodes: nodes.length }
  }).catch(() => ({}))
  log('studio-kbd-nodes', kbd)

  // studio at 1280 — cramp check
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/studio-1280.png` })
  const cramp = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth })).catch(() => ({}))
  log('studio-1280', cramp)
  await page.setViewportSize({ width: 1600, height: 950 })

  // workbench via DATA facet: select a bound element, find the door
  errs.length = 0
  await page.locator('[data-node-id]').nth(2).click({ position: { x: 10, y: 10 } }).catch(() => {})
  await page.waitForTimeout(1000)
  const dataTab = page.locator('[class*="dock" i] [role="tab"]:has-text("მონაცემ"), [class*="dock" i] button:has-text("მონაცემ"), [role="tab"]:has-text("DATA"), [role="tab"]:has-text("Data")').first()
  if (await dataTab.count()) {
    await dataTab.click().catch(() => {})
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/studio-data-facet.png` })
    const door = page.locator('button:has-text("ვორქბენჩ"), button:has-text("workbench" )').first()
    if (await door.count()) {
      await door.click().catch(() => {})
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${OUT}/studio-workbench.png` })
      const wb = await page.evaluate(() => ({
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        hasAriaModal: !!document.querySelector('[aria-modal="true"]'),
        closeBtn: [...document.querySelectorAll('[role="dialog"] button, [class*="workbench" i] button')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 25)).filter(n => /დახურ|close|✕|×/i.test(n)),
      })).catch(() => ({}))
      log('studio-workbench', { consoleErrors: errs.slice(0, 5), ...wb })
      await page.keyboard.press('Escape'); await page.waitForTimeout(800)
      const escClosed = await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length).catch(() => -1)
      log('studio-workbench-esc', { dialogsAfterEsc: escClosed })
    } else log('studio-workbench', { doorFound: false })
  } else log('studio-data-facet', { found: false })

  // unsaved-changes / navigation guard signal + pages surface
  await page.goto(STUDIO + '/studio', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/studio-home.png` })
  const home = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('nav a, nav button, [class*="rail" i] a, [class*="rail" i] button')].map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 20),
    newPageBtn: [...document.querySelectorAll('button, a')].filter(b => /ახალი გვერდ|new page|შექმნა|create/i.test(b.textContent || '')).map(b => b.textContent.trim().slice(0, 30)),
    templates: (document.body.innerText.match(/template|შაბლონ/gi) || []).length,
  })).catch(() => ({}))
  log('studio-home', home)

  await page.close()
}

await browser.close()
console.log('SWEEP-DONE')
