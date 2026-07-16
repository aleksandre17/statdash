// ── rangeSlider brush — real-browser guard for the "options-green, live-crash" class ──
//
//  The 2026-07-16 regression: rangeSlider.fitness.test.ts (options-level, jsdom) was
//  green while all three rangeSlider-wired charts rendered as BLANK cards live —
//  apexcharts@3.54.1's brush link resolves through the UMD global (`ApexCharts is
//  not defined` in an ESM bundle) and its `chart.id` registration poisons
//  `window.Apex` for every later chart (`Utils.clone` RangeError on the cyclic
//  instance it deep-merges into their configs). jsdom cannot execute ApexCharts
//  (the documented blindspot), so ONLY a real browser catches this class.
//
//  This spec walks the three provisioned rangeSlider charts on the REAL runner
//  bundle and asserts, per chart:
//    1. ZERO pageerrors across load + interaction (the class assertion — any
//       future module-scope/global-seam crash fails here first),
//    2. the main plot AND the brush rail both render (apex canvas + the rail
//       inside the renderer's fixed-height row),
//    3. a real mouse drag on the rail's RIGHT resize grip NARROWS the main
//       chart's visible x-range (the brush actually drives its target).
//
//  API surface: replayed from e2e/fixtures/api-fixtures.json (recorded governed
//  responses — no backend needed, deterministic offline). RE-RECORD when
//  provisioning/data change: GEOSTAT_E2E_RECORD=1 GEOSTAT_E2E_API=http://<dev-api>
//  pnpm test:e2e — the spec then forwards /api/* to the live API and rewrites the
//  fixture file. A REQUEST WITH NO FIXTURE fails loudly (404 + console note), so
//  drift is visible, never silent.
//
import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const DIR = dirname(fileURLToPath(import.meta.url))
const FIXTURE_FILE = join(DIR, 'fixtures', 'api-fixtures.json')
const RECORD = !!process.env.GEOSTAT_E2E_RECORD
const API = process.env.GEOSTAT_E2E_API ?? 'http://192.168.1.199:3011'

type Fixture = { status: number; contentType: string; encoding: 'utf8' | 'base64'; body: string }
type FixtureMap = Record<string, Fixture>

// The three provisioned rangeSlider charts — one per cartesian family the brush
// companion must drive (combo · stacked area · stacked bar).
const TARGETS = [
  { name: 'gdp-dynamics (combo)',        url: '/ka/gdp',      perspective: 'დინამიკა' },
  { name: 'sector-history (area)',       url: '/ka/regional', perspective: 'დინამიკა' },
  { name: 'sna-hero-range (stacked bar)', url: '/ka/accounts', perspective: 'დინამიკა' },
]

// The brush RAIL is the apex canvas inside the fixed-height (96px, SLIDER_HEIGHT)
// flex row ApexRenderer stacks under the main plot; the MAIN is its flex-sibling.
const RAIL_SEL = 'div[style*="96px"] > div > .apexcharts-canvas'

/** Visible x-tick labels of the slider-linked MAIN chart (first tspan per tick —
 *  each apex tick <text> nests a <title> duplicate). */
async function mainXLabels(page: Page): Promise<string[] | null> {
  return page.evaluate((railSel: string) => {
    const rail = document.querySelector(railSel)
    const host = rail?.closest('div[style*="column"]')
    if (!rail || !host) return null
    const main = [...host.querySelectorAll('.apexcharts-canvas')].find((c) => c !== rail)
    if (!main) return null
    return [...main.querySelectorAll('.apexcharts-xaxis-texts-g text')]
      .map((t) => (t.querySelector('tspan') ?? t).textContent?.trim() ?? '')
  }, RAIL_SEL)
}

test('rangeSlider brush: renders live, zero pageerrors, drag drives the main x-window', async ({ page }) => {
  const fixtures: FixtureMap = RECORD ? {} : JSON.parse(readFileSync(FIXTURE_FILE, 'utf8'))
  const pageerrors: string[] = []
  page.on('pageerror', (err) => pageerrors.push(String(err).split('\n')[0]!))

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const key = url.pathname + url.search
    if (RECORD) {
      const resp = await route.fetch({ url: API + key })
      const ct = resp.headers()['content-type'] ?? 'application/json'
      const isText = /json|text|javascript/.test(ct)
      fixtures[key] = {
        status: resp.status(),
        contentType: ct,
        encoding: isText ? 'utf8' : 'base64',
        body: (await resp.body()).toString(isText ? 'utf8' : 'base64'),
      }
      await route.fulfill({ response: resp })
      return
    }
    const hit = fixtures[key]
    if (!hit) {
      console.log(`[fixtures] MISS ${key} — provisioning drifted? re-record (see spec header)`)
      await route.fulfill({ status: 404, body: '{}' })
      return
    }
    await route.fulfill({
      status: hit.status,
      contentType: hit.contentType,
      body: hit.encoding === 'utf8' ? hit.body : Buffer.from(hit.body, 'base64'),
    })
  })

  for (const t of TARGETS) {
    await test.step(t.name, async () => {
      await page.goto(t.url, { waitUntil: 'networkidle' })
      await page.getByText(t.perspective, { exact: false }).first().click()

      // (2) main + rail render.
      const rail = page.locator(RAIL_SEL).first()
      await expect(rail, `${t.name}: brush rail renders`).toBeVisible()
      await rail.scrollIntoViewIfNeeded()
      // Apex draws asynchronously after mount — wait for the main's ticks.
      await expect
        .poll(async () => (await mainXLabels(page))?.length ?? 0, { message: `${t.name}: main x-ticks render` })
        .toBeGreaterThanOrEqual(8)
      const before = (await mainXLabels(page))!

      // (3) narrow the full-range window by its RIGHT resize grip → ~55% width.
      const grip = page.locator(`${RAIL_SEL} .apexcharts-selection-rect + g .svg_select_points_r`).first()
      const railBox = (await rail.boundingBox())!
      const gripBox = (await grip.boundingBox())!
      const y = gripBox.y + gripBox.height / 2
      await page.mouse.move(gripBox.x + gripBox.width / 2, y)
      await page.mouse.down()
      await page.mouse.move(railBox.x + railBox.width * 0.55, y, { steps: 12 })
      await page.mouse.up()

      await expect
        .poll(async () => (await mainXLabels(page))!.length, { message: `${t.name}: brush drag narrows the main x-window` })
        .toBeLessThan(before.length)

      // (1) the class assertion — nothing on this page threw, ever.
      expect(pageerrors, `${t.name}: zero pageerrors`).toEqual([])
    })
  }

  if (RECORD) {
    mkdirSync(dirname(FIXTURE_FILE), { recursive: true })
    writeFileSync(FIXTURE_FILE, JSON.stringify(fixtures))
    console.log(`[fixtures] recorded ${Object.keys(fixtures).length} → ${FIXTURE_FILE}`)
  }
})
