// ── probe-r1-gdp-workbench-0rows — wire evidence for the gdp expenditure R1 0-row bug ──
//
//  Login → open gdp page → select the expenditure chart → open the data workbench →
//  capture ALL /api/stats/observations (+classifiers/coverage) requests, tagged by
//  which phase fired them (canvas render vs workbench open). Also dumps the
//  data-sources list (order matters — Object.keys(stores)[0] fallback).
//
//  RUN (from platform/):  node e2e/probes/probe-r1-gdp-workbench-0rows.mjs
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0112')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)))

const netlog = []
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('/api/stats/') || url.includes('/api/data-sources') || url.includes('/api/cube/')) {
    netlog.push({ t: Date.now(), phase: CURRENT_PHASE, method: req.method(), url })
  }
})

let CURRENT_PHASE = 'boot'

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

async function run() {
  // ── Data sources — the manifest ORDER (Object.keys(stores)[0] fallback candidate) ──
  const dsResp = await page.request.get(BASE + '/api/data-sources').catch(() => null)
  if (dsResp) {
    const body = await dsResp.json().catch(() => null)
    log('data-sources', { order: Array.isArray(body) ? body.map((r) => r.name ?? r.id) : body })
  }

  CURRENT_PHASE = 'studio-gdp-load'
  await page.goto(BASE + '/studio/insert?page=gdp', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(OUT, 'r1-01-gdp-loaded.png') })

  // Target the EXPENDITURE section's chart precisely (data-node-id="expenditure-0-0",
  // confirmed via probe-r1-list-nodes.mjs against the live gdp page's node tree —
  // its parent section "expenditure" carries the query {approach:'EXP', geo:'GE',
  // time:{$ctx:'time'}} the brief names).
  CURRENT_PHASE = 'select-expenditure'
  const target = page.locator('[data-testid="canvas-overlay"] [data-node-id="expenditure-0-0"]')
  log('target-found', { count: await target.count() })
  await target.click().catch(() => {})
  await page.waitForTimeout(1200)
  log('facet-field', { count: await page.locator('[data-testid="data-facet-field"]').count() })

  let opened = false
  const door = page.locator('[data-testid="open-data-workbench"]')
  if (await door.count()) {
    CURRENT_PHASE = 'workbench-open-expenditure'
    netlog.push({ t: Date.now(), phase: 'MARK', method: '---', url: '--- opening workbench for expenditure-0-0 ---' })
    await door.click().catch(() => {})
    await page.waitForTimeout(15000) // per brief: wait 15s, capture ALL warm/read traffic
    const wbCount = await page.locator('[data-testid="data-workbench"]').count()
    log('opened', { workbench: wbCount })
    opened = !!wbCount
  } else {
    log('no-door', {})
  }

  await page.screenshot({ path: resolve(OUT, 'r1-02-workbench-state.png'), fullPage: true }).catch(() => {})

  // Read the grid's declared state + the generated query pane (shows the ACTUAL
  // filter the preview evaluated, incl. any resolved $ctx:time).
  const gridCaption = await page.locator('[data-testid="pipeline-grid"] caption').first().textContent().catch(() => '(absent)')
  const gridRows = await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0)
  const gqSteps = await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => [])
  const stateBadges = ['loading', 'empty', 'unbound', 'unavailable', 'error']
  const badges = {}
  for (const s of stateBadges) badges[s] = await page.locator(`[data-testid="pipeline-grid-${s}"]`).count().catch(() => 0)
  log('grid-read', { gridCaption, gridRows, gqSteps: gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 100)), badges })

  log('network', { entries: netlog.map((e) => ({ phase: e.phase, method: e.method, url: e.url })) })
  log('done', { opened, consoleErrors: errors })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 300) }))
await browser.close()
