// One-shot capture harness for redeploy-shots-2 (2026-07-01)
// Targets live server at http://192.168.1.199:3002
// 10 captures, light + dark, spaced 6s apart (max 10/min)
import { chromium } from 'C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE = 'http://192.168.1.199:3002'
const OUT = new URL('./redeploy-shots-2/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function capture(route, width, dark, name) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 25000 })
  } catch (e) {
    console.warn(`WARN goto timeout: ${name} — ${e.message.split('\n')[0]}`)
  }

  // Let charts render
  await page.waitForTimeout(2000)

  if (dark) {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
    })
    await page.waitForTimeout(600)
  }

  // Quick sanity: check theme + content
  const info = await page.evaluate(() => {
    const theme = document.documentElement.dataset.theme || 'light'
    const hasChrome = !!document.querySelector('[class*="app-header"]')
    const contentCount = document.querySelectorAll('[class*="panel"],[class*="section"]').length
    const locale = document.querySelector('html')?.lang || ''
    const hasThemeSwitcher = !!document.querySelector('[class*="theme"]')
    return { theme, hasChrome, contentCount, locale, hasThemeSwitcher }
  })

  const filePath = join(OUT, name + '.png')
  await page.screenshot({ path: filePath, fullPage: true })

  console.log(JSON.stringify({ name, info, errs: errs.slice(0, 3) }))

  await ctx.close()
  // Rate-limit guard: 6s gap → max 10/min
  await new Promise(r => setTimeout(r, 6000))
}

// --- LIGHT captures (English + ka regression) ---
await capture('/en/gdp',       1440, false, 'gdp_light_1440')
await capture('/en/accounts',  1440, false, 'accounts_light_1440')
await capture('/en/regional',  1440, false, 'regional_light_1440')

// --- DARK captures 1440 ---
await capture('/ka/gdp',       1440, true,  'ka-gdp_dark_1440')
await capture('/ka/regional',  1440, true,  'ka-regional_dark_1440')
await capture('/ka/accounts',  1440, true,  'ka-accounts_dark_1440')

// --- DARK captures 390 ---
await capture('/ka/gdp',       390,  true,  'ka-gdp_dark_0390')
await capture('/ka/regional',  390,  true,  'ka-regional_dark_0390')
await capture('/ka/accounts',  390,  true,  'ka-accounts_dark_0390')

// --- LIGHT regression baseline ---
await capture('/ka/gdp',       1440, false, 'ka-gdp_light_1440')

await browser.close()
console.log('ALL_DONE')
