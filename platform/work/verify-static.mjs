// Throwaway docker-free verification harness (VERIFICATION ONLY — not product code).
// Boots against the running geostat vite dev server and records what actually renders.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.BASE_URL || 'http://localhost:5176'
const OUT = 'C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots'
mkdirSync(OUT, { recursive: true })

const WIDTHS = [360, 768, 1024, 1440, 1920]
const ROUTES = ['/', '/ka/gdp', '/en/gdp', '/gdp', '/ka/regional', '/regional', '/ka/accounts']

const browser = await chromium.launch()
const results = []

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const consoleMsgs = []
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`))

  const url = BASE + route
  let status = 'ok'
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
  } catch (e) {
    status = 'goto-timeout: ' + e.message.split('\n')[0]
  }
  await page.waitForTimeout(1200)

  const info = await page.evaluate(() => {
    const root = document.getElementById('root')
    const txt = (root?.innerText || '').trim().slice(0, 400)
    const hasMap = !!document.querySelector('.leaflet-container')
    const mapH = document.querySelector('.leaflet-container')?.getBoundingClientRect().height ?? null
    const hasApex = !!document.querySelector('.apexcharts-canvas')
    const panels = document.querySelectorAll('[class*="panel"]').length
    const kpi = document.querySelectorAll('[class*="kpi"],[class*="metric"]').length
    const skeleton = !!document.querySelector('.app-skeleton')
    return { txt, hasMap, mapH, hasApex, panels, kpi, skeleton, title: document.title }
  })

  results.push({ route, status, info, console: consoleMsgs.slice(0, 12) })

  // Only screenshot the root route across all widths (others render identically if offline).
  if (route === '/') {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/root_${w}.png`, fullPage: true })
    }
  } else {
    await page.screenshot({ path: `${OUT}/route_${route.replace(/\//g, '_') || 'root'}.png`, fullPage: true })
  }
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
