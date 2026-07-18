import { chromium } from '@playwright/test'
const PORTAL = 'http://192.168.1.199:3012'
const STUDIO = 'http://192.168.1.199:3013'
const OUT = '../work/authoring-truth/sweep'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })

// EN page sizes vs KA
for (const p of ['/ka', '/en', '/en/gdp', '/en/regional', '/en/accounts']) {
  await page.goto(PORTAL + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => ({ chars: document.body.innerText.length, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60), figures: document.querySelectorAll('svg,canvas').length, mainText: document.body.innerText.slice(0, 300).replace(/\n+/g, ' | ') }))
  log('en-size', { p, ...info })
}
await page.screenshot({ path: `${OUT}/portal-en-home.png` })

// dark mode by text button + contrast sampling
await page.goto(PORTAL + '/ka/regional', { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1800)
const darkBtn = page.locator('button:has-text("მუქი თემა"), button:has-text("მუქი")').first()
if (await darkBtn.count()) {
  await darkBtn.click().catch(() => {})
  await page.waitForTimeout(1500)
  const sample = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('main h2, main h3, main p, main td, main th, main text')) {
      const st = getComputedStyle(el); const t = (el.textContent || '').trim()
      if (t && out.length < 12) out.push({ t: t.slice(0, 25), color: st.color, bg: st.backgroundColor })
    }
    return { htmlAttr: document.documentElement.getAttribute('data-theme') || document.documentElement.className, bodyBg: getComputedStyle(document.body).backgroundColor, sample: out.slice(0, 8) }
  })
  log('portal-dark2', sample)
  await page.screenshot({ path: `${OUT}/portal-regional-dark.png`, fullPage: true })
}

// what interactives live in main on /ka/regional + permalink test
await page.goto(PORTAL + '/ka/regional', { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1800)
const mains = await page.evaluate(() => ({
  interactives: [...document.querySelectorAll('main button, main select, main a, main [role], main input')].map(e => e.tagName + ':' + (e.getAttribute('role') || '') + ':' + ((e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30))).slice(0, 25),
  mapRegions: document.querySelectorAll('main svg path[data-region], main svg [role="button"], main svg path[tabindex]').length,
  svgPaths: document.querySelectorAll('main svg path').length,
}))
log('regional-main', mains)
const before = page.url()
const svgRegion = page.locator('main svg path').nth(5)
if (await svgRegion.count()) {
  await svgRegion.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1200)
  log('permalink-map', { before, after: page.url(), changed: page.url() !== before })
  await page.screenshot({ path: `${OUT}/portal-regional-after-mapclick.png` })
}

// keyboard: full tab trail with more detail (is it really a loop?)
await page.goto(PORTAL + '/ka', { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1200)
const trail = []
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('Tab')
  trail.push(await page.evaluate(() => {
    const a = document.activeElement
    return a && a !== document.body ? a.tagName + ':' + (a.getAttribute('aria-label') || a.getAttribute('href') || a.textContent || '').trim().slice(0, 30) : 'BODY'
  }))
}
log('tab-trail-2', { trail })

// STUDIO details
await page.goto(STUDIO + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(2000)
const passField = page.locator('input[type="password"]').first()
if (await passField.count()) {
  await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
  await passField.fill('dev_admin_pw_123')
  await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
  await page.waitForTimeout(3500)
  await page.goto(STUDIO + '/studio/insert?page=regional', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(3000)
}
// where do the duplicate locale/theme pairs live?
const dup = await page.evaluate(() => {
  const locate = (el) => {
    const path = []
    let n = el
    while (n && n !== document.body && path.length < 4) { path.unshift(n.className?.toString?.().split(' ')[0] || n.tagName); n = n.parentElement }
    return path.join('>')
  }
  const btns = [...document.querySelectorAll('button')]
  return {
    ka: btns.filter(b => /^(ka|KA)$/.test((b.textContent || '').trim())).map(locate),
    en: btns.filter(b => /^(en|EN)$/.test((b.textContent || '').trim())).map(locate),
    theme: btns.filter(b => /თემა|☾|☀/.test(b.textContent || '')).map(b => (b.textContent || '').trim().slice(0, 15) + ' @ ' + locate(b)),
  }
})
log('studio-dup-controls', dup)

// Ctrl+K palette: what does it actually contain
await page.keyboard.press('Control+k'); await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/studio-cmdk.png` })
const cmdk = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  return { hasInput: !!dlg?.querySelector('input'), items: [...(dlg?.querySelectorAll('[role="option"], li, button') || [])].map(e => e.textContent.trim().slice(0, 40)).slice(0, 20) }
})
log('studio-cmdk', cmdk)
await page.keyboard.press('Escape')

// inline text edit: dblclick actual text leaf inside canvas
const leaf = page.locator('[data-node-id] :text("რეგიონ")').first()
const anyText = (await leaf.count()) ? leaf : page.locator('[data-node-id]').nth(4)
await anyText.dblclick().catch(() => {})
await page.waitForTimeout(900)
log('studio-inline-edit', await page.evaluate(() => ({ contentEditable: !!document.querySelector('[contenteditable="true"]'), active: document.activeElement?.tagName, activeClass: document.activeElement?.className?.toString?.().slice(0, 50) })))
await page.keyboard.press('Escape')

// dirty-state: is there any unsaved indicator after selecting (no edit)? check Save draft button state
const save = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(b => /Save draft/i.test(b.textContent || ''))
  return b ? { text: b.textContent.trim(), disabled: b.disabled, cls: b.className.toString().slice(0, 60) } : null
})
log('studio-save-state', save)

// Pages panel: templates / new page?
const pagesBtn = page.locator('button:has-text("Pages")').first()
if (await pagesBtn.count()) {
  await pagesBtn.click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/studio-pages.png` })
  log('studio-pages', await page.evaluate(() => ({
    txt: (document.querySelector('[role="dialog"]')?.textContent || '').slice(0, 400),
    newBtn: [...document.querySelectorAll('button')].filter(b => /ახალი|new|\+/i.test((b.textContent || '').trim()) && (b.textContent || '').length < 25).map(b => b.textContent.trim().slice(0, 25)).slice(0, 8),
  })))
  await page.keyboard.press('Escape')
}

// duplicate-element affordance: select node, look for duplicate/copy in dock
await page.locator('[data-node-id]').nth(3).click({ position: { x: 8, y: 8 } }).catch(() => {})
await page.waitForTimeout(1000)
log('studio-dup-affordance', await page.evaluate(() => ({
  dockBtns: [...document.querySelectorAll('[class*="dock" i] button, [class*="inspector" i] button')].map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 30),
})))
await page.keyboard.press('Control+d'); await page.waitForTimeout(700)
log('studio-ctrlD', await page.evaluate(() => ({ nodes: document.querySelectorAll('[data-node-id]').length, toasts: [...document.querySelectorAll('[role="status"],[role="alert"]')].map(t => t.textContent.trim().slice(0, 50)) })))
await page.keyboard.press('Control+z'); await page.waitForTimeout(500)

log('console-errors-final', { errs: errs.slice(-8) })
await browser.close()
console.log('SWEEP2-DONE')
