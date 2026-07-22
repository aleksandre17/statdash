// ── probe-r1-gdp-config-dump — dump the gdp page's config JSON (find the expenditure node) ──
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0112')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

async function login() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const passField = page.locator('input[type="password"]').first()
  if (await passField.count()) {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {})
    await passField.fill(process.env.PW_ADMIN_PW ?? 'dev_admin_pw_123').catch(() => {})
    await page.locator('button[type="submit"], button:has-text("შესვლა"), button:has-text("Login")').first().click().catch(() => {})
    await page.waitForTimeout(4000)
  }
}

await login()

const token = await page.evaluate(() => sessionStorage.getItem('geostat_panel_token'))
log('token', { found: !!token })

const headers = token ? { Authorization: `Bearer ${token}` } : {}
const listResp = await page.request.get(BASE + '/api/config/pages', { headers }).catch(() => null)
const listRaw = listResp ? await listResp.text().catch(() => '') : ''
log('list-raw', { status: listResp?.status(), body: listRaw.slice(0, 300) })
let list = null
try { list = JSON.parse(listRaw) } catch {}
const arr = Array.isArray(list) ? list : (Array.isArray(list?.pages) ? list.pages : (Array.isArray(list?.data) ? list.data : null))
const gdpEntry = arr ? arr.find((p) => p.slug === 'gdp' || p.path === 'gdp') : null
log('list', { count: arr?.length ?? null, gdpEntry: gdpEntry ? { id: gdpEntry.id, slug: gdpEntry.slug ?? gdpEntry.path } : null })

const dsResp2 = await page.request.get(BASE + '/api/config/data-sources', { headers }).catch(() => null)
const dsRaw2 = dsResp2 ? await dsResp2.text().catch(() => '') : ''
log('config-data-sources', { status: dsResp2?.status(), body: dsRaw2.slice(0, 2000) })

if (gdpEntry) {
  const cfgResp = await page.request.get(BASE + `/api/config/pages/${gdpEntry.id}`, { headers }).catch(() => null)
  const cfg = cfgResp ? await cfgResp.json().catch(() => null) : null
  writeFileSync(resolve(OUT, 'gdp-page-config.json'), JSON.stringify(cfg, null, 2))
  log('saved', { path: resolve(OUT, 'gdp-page-config.json') })
} else if (arr) {
  log('all-slugs', { slugs: arr.map((p) => p.slug ?? p.path ?? p.id) })
}

await browser.close()
