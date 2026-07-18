// ── probe-0086-0085-wave — the one-model/two-zooms + wire-truth pane, walked live ─
//
//  DUTY-0 (P-OFFER): the landed probe-poffer-filter printed columnOptions:[] because it
//  never clicked «Add condition» — FilterStepForm starts with ZERO conditions (empty
//  where), so NO FieldPicker exists until a condition row is added. This probe adds the
//  condition FIRST, then reads the column offer + member checkboxes.
//  0086: a bound element's DATA facet = SUMMARY + one door, no inline editor.
//  0085: steward lens → the ObsQuery wire block speaks (real read / declared note), never
//  a zero-height void.  Shots → work/authoring-truth/0086/.
//
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', '..', '..', 'work', 'authoring-truth', '0086')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))
const RAW_TOKENS = ['adjara', 'AGRI', 'GVA', 'B1G', '_T', 'REGION']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)))

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

async function setRole(role) {
  // The role lens is a persisted local pref (statdash.role) — set it directly.
  await page.evaluate((r) => {
    localStorage.setItem('statdash.role', JSON.stringify({ state: { role: r }, version: 0 }))
  }, role).catch(() => {})
}

async function readWorkbench() {
  if (!(await page.locator('[data-testid="data-workbench"]').count())) return { state: 'absent' }
  return {
    state: 'workbench',
    gridRows: await page.locator('[data-testid="pipeline-grid"] tbody tr').count().catch(() => 0),
    gqSteps: await page.locator('[data-testid="gq-step"]').allTextContents().catch(() => []),
  }
}

async function run() {
  await page.goto(BASE + '/studio/insert?page=regional', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const els = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  const n = await els.count()

  // ── Select a bindable element → the DATA facet (0086 SUMMARY read) ─────────────
  let facet = false
  for (let i = 0; i < Math.min(n, 6); i++) {
    await els.nth(i).click().catch(() => {})
    await page.waitForTimeout(1000)
    if (await page.locator('[data-testid="data-facet-field"]').count()) { facet = true; break }
  }
  await page.screenshot({ path: resolve(OUT, '01-facet.png'), fullPage: true })

  // 0086 assertions on the facet: summary present, NO inline pipe editor in author plane.
  const summaryPresent = await page.locator('[data-testid="data-facet-summary"]').count()
  const summaryText = await page.locator('[data-testid="data-facet-summary"]').innerText().catch(() => '')
  const doorPresent = await page.locator('[data-testid="open-data-workbench"]').count()
  const inlinePipeAuthor = await page.locator('[data-testid="data-facet-pipe"]').count() // MUST be 0 in author lens
  log('0086-facet', { facet, summaryPresent, doorPresent, inlinePipeAuthor, summary: summaryText.replace(/\s+/g, ' ').trim().slice(0, 160) })

  // If unbound, bind a governed metric via the quick-bind palette so the door opens a real pipe.
  const bound0 = /rows|სტრიქონი/.test(summaryText)
  if (!bound0) {
    const tile = page.locator('[data-testid^="metric-tile-"]').first()
    if (await tile.count()) { await tile.click().catch(() => {}); await page.waitForTimeout(2500) }
  }
  await page.screenshot({ path: resolve(OUT, '02-facet-bound.png'), fullPage: true })
  const summaryAfterBind = await page.locator('[data-testid="data-facet-summary"]').innerText().catch(() => '')
  log('0086-bound', { summary: summaryAfterBind.replace(/\s+/g, ' ').trim().slice(0, 160) })

  // ── Open the workbench (the ONE door) ──────────────────────────────────────────
  await page.locator('[data-testid="open-data-workbench"]').first().click().catch(() => {})
  await page.waitForTimeout(4500)
  const atOpen = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '03-workbench.png'), fullPage: true })
  log('opened', atOpen)

  // ── DUTY-0: add a Filter step, then ADD A CONDITION (the probe fix) ─────────────
  await page.locator('[data-testid="add-step-trigger"]').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.locator('[data-testid="verb-insert-filter"]').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1200)
  // THE FIX: FilterStepForm renders no FieldPicker until a condition row exists.
  await page.getByRole('button', { name: /Add condition|პირობის დამატება/ }).first().click().catch(() => {})
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(OUT, '04-condition-added.png'), fullPage: true })

  // The COLUMN control now exists — open it, read the offered governed columns.
  const select = page.getByLabel(/^სვეტი$|^Column$/).first()
  const columnOptions = []
  if (await select.count()) {
    await select.click().catch(() => {})
    await page.waitForTimeout(600)
    for (const t of await page.locator('[role="option"]').allTextContents()) columnOptions.push(t.trim())
  }
  await page.screenshot({ path: resolve(OUT, '05-column-offered.png'), fullPage: true })
  log('column-offer', { columnCount: columnOptions.filter(Boolean).length, columnOptions: columnOptions.filter(Boolean).slice(0, 10) })

  // Pick a geography-like governed column (fall back to the first real option).
  const geo = page.getByRole('option', { name: /გეოგრაფია|Geograph|რეგიონ|Region/ }).first()
  if (await geo.count()) await geo.click().catch(() => {})
  else await page.locator('[role="option"]').nth(1).click().catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(OUT, '06-value-offered.png'), fullPage: true })

  // The VALUE control offers the actual members (Excel AutoFilter checkboxes) — check two.
  const memberBoxes = page.locator('[aria-label="ფილტრის მნიშვნელობები"] input[type="checkbox"], [aria-label="Filter values"] input[type="checkbox"]')
  const memberLabels = await page.locator('[aria-label="ფილტრის მნიშვნელობები"] .MuiFormControlLabel-label, [aria-label="Filter values"] .MuiFormControlLabel-label').allTextContents().catch(() => [])
  const memberCount = await memberBoxes.count().catch(() => 0)
  await memberBoxes.nth(0).click().catch(() => {})
  await page.waitForTimeout(400)
  await memberBoxes.nth(1).click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.locator('[data-testid="pipe-step-chip"]').last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const afterPick = await readWorkbench()
  await page.screenshot({ path: resolve(OUT, '07-filtered-live.png'), fullPage: true })
  log('member-offer', { memberCount, memberLabels: memberLabels.slice(0, 8) })
  log('filtered', { gridRowsBefore: atOpen.gridRows, gridRowsAfter: afterPick.gridRows, gqSteps: afterPick.gqSteps.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 50)) })

  const wbText = await page.locator('[data-testid="data-workbench"]').innerText().catch(() => '')
  log('honesty-author', { rawLeaks: RAW_TOKENS.filter((t) => wbText.includes(t)) })

  // ── 0085: steward lens → the ObsQuery wire block speaks, non-zero height ────────
  await setRole('steward')
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(3500)
  // Re-select the element + re-open the workbench under the steward lens.
  const els2 = page.locator('[data-testid="canvas-overlay"] .canvas-node[data-node-type="chart"], [data-testid="canvas-overlay"] .canvas-node[data-node-type="table"]')
  for (let i = 0; i < Math.min(await els2.count(), 6); i++) {
    await els2.nth(i).click().catch(() => {})
    await page.waitForTimeout(900)
    if (await page.locator('[data-testid="open-data-workbench"]').count()) break
  }
  const stewardPipe = await page.locator('[data-testid="data-facet-pipe"]').count() // steward retains raw editor
  await page.locator('[data-testid="open-data-workbench"]').first().click().catch(() => {})
  await page.waitForTimeout(4500)
  // Expand the lowered-ObsQuery accordion.
  const stewardBlock = page.locator('[data-testid="gq-steward"]')
  const obsAccordion = page.locator('[data-testid="gq-steward"] .MuiAccordionSummary-root').last()
  if (await obsAccordion.count()) { await obsAccordion.click().catch(() => {}); await page.waitForTimeout(700) }
  const obsBox = page.locator('[data-testid="gq-obsquery"]')
  const obsText = await obsBox.innerText().catch(() => '')
  const obsBoxH = await obsBox.evaluate((el) => el.getBoundingClientRect().height).catch(() => 0)
  await page.screenshot({ path: resolve(OUT, '08-steward-wire.png'), fullPage: true })
  log('0085-steward', {
    stewardPresent: await stewardBlock.count(), stewardRawEditor: stewardPipe,
    obsHeight: Math.round(obsBoxH), obsText: obsText.replace(/\s+/g, ' ').trim().slice(0, 120),
  })

  log('done', { consoleErrors: errors })
}

await login()
await run().catch((e) => log('fatal', { error: String(e).slice(0, 200) }))
await browser.close()
