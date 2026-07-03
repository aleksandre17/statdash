import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'

const BASE = 'http://192.168.1.199:3002'
const SHOTS = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))

await page.goto(BASE + '/ka/gdp', { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(2000)

// ── Sidebar state scan ──────────────────────────────────────────────────
async function sidebarScan() {
  return await page.evaluate(() => {
    const items = [...document.querySelectorAll('.sidebar-nav-item')]
    if (!items.length) return { found: false }
    const read = (it) => {
      const label = it.querySelector('.sidebar-nav-label')
      const cs = label ? getComputedStyle(label) : null
      const before = getComputedStyle(it, '::before')
      const itcs = getComputedStyle(it)
      return {
        active: it.classList.contains('is-active'),
        labelColor: cs ? cs.color : null,
        labelWeight: cs ? cs.fontWeight : null,
        indicatorBg: before.backgroundColor,
        indicatorW: before.width,
        rowBg: itcs.backgroundColor,
        text: label ? (label.textContent || '').trim().slice(0, 24) : '',
      }
    }
    const active = items.filter(i => i.classList.contains('is-active')).map(read)
    const inactive = items.filter(i => !i.classList.contains('is-active')).slice(0, 3).map(read)
    return { found: true, count: items.length, active, inactive }
  })
}

const theme = await page.getAttribute('html', 'data-theme')
console.log('THEME (light expected):', theme)
const lightScan = await sidebarScan()
console.log('SIDEBAR LIGHT:', JSON.stringify(lightScan, null, 2))

// screenshot sidebar (light)
const sb = await page.$('.inner-sidebar, [class*="inner-sidebar"], nav[class*="sidebar"], aside')
if (sb) { await sb.screenshot({ path: SHOTS + '/02-sidebar-light.png' }); console.log('SHOT 02-sidebar-light.png') }
else { console.log('sidebar element not matched, trying .sidebar-nav-item parent') }

// ── Perspective-tab-group geometry ─────────────────────────────────────
const persp = await page.evaluate(() => {
  const g = document.querySelector('.perspective-tab-group')
  if (!g) return { found: false }
  const r = g.getBoundingClientRect()
  const parent = g.parentElement
  const pr = parent ? parent.getBoundingClientRect() : null
  const cs = getComputedStyle(g)
  return {
    found: true,
    groupLeft: Math.round(r.left), groupWidth: Math.round(r.width),
    parentLeft: pr ? Math.round(pr.left) : null, parentWidth: pr ? Math.round(pr.width) : null,
    alignSelf: cs.alignSelf, justifyContent: cs.justifyContent,
    marginInlineStart: cs.marginInlineStart,
    hugsTabs: pr ? (r.width < pr.width * 0.7) : null,
    leftAnchored: pr ? (r.left - pr.left < 60) : null,
  }
})
console.log('PERSPECTIVE-TAB-GROUP:', JSON.stringify(persp, null, 2))
const pg = await page.$('.perspective-tab-group')
if (pg) {
  // screenshot the perspective bar row (parent) to show left-anchoring in context
  const parentEl = await page.evaluateHandle(() => document.querySelector('.perspective-tab-group').parentElement)
  await parentEl.asElement().screenshot({ path: SHOTS + '/03-perspective-bar-left.png' })
  console.log('SHOT 03-perspective-bar-left.png')
}

// ── Dark mode ───────────────────────────────────────────────────────────
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark') })
await page.waitForTimeout(800)
const darkTheme = await page.getAttribute('html', 'data-theme')
console.log('THEME (dark expected):', darkTheme)
const darkScan = await sidebarScan()
console.log('SIDEBAR DARK:', JSON.stringify(darkScan, null, 2))
if (sb) { await sb.screenshot({ path: SHOTS + '/02-sidebar-dark.png' }); console.log('SHOT 02-sidebar-dark.png') }

console.log('ERRORS:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none')
await browser.close()
