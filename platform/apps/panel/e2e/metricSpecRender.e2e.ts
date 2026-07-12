// ── metricSpecRender.e2e — the LIVE leg: a `metric` DataSpec renders in the REAL bundle ─
//
//  AR-50 M-SQ-EDITOR. The jsdom-can't-catch half of the live proof (the M5→M5b lesson:
//  a stale dist white-screens; only the REAL Vite bundle in Chromium proves the shipped
//  code carries the new `metric` resolver). The engine + react fitness prove VALUE
//  correctness (2022 = 20, not 21) in node; THIS proves the running app renders a chart
//  bound to a `metric` DataSpec end-to-end WITHOUT a white-screen / uncaught error — the
//  discriminant survives the real bundle, boot to paint.
//
//  It INJECTS the metric-spec chart (the "author/inject" path the brief allows) by
//  overriding the seed page detail with a chart node whose `data` is a governed metric
//  spec — exactly the shape the MetricSpecEditor emits ("pick GDP per capita, over time").
//  The canvas renders it against the structural (empty) store, so the assertion is the
//  RENDER SURVIVES (no pageerror, the node mounts), not the in-browser values — value
//  correctness is the node-env fitness's job (FF-METRIC-SPEC-RENDER).
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken, SEED_PAGE_ID } from './support/mockApi'

// The injected chart node — bound to a `metric` DataSpec (the MetricSpecEditor's output:
// a governed metric + the first-class time grain). A raw query is never authored (Law 2).
const METRIC_CHART_NODE_ID = 'chart-metric-spec'

const PAGE_WITH_METRIC_CHART = {
  id: SEED_PAGE_ID,
  slug: 'gdp',
  title: { ka: 'მშპ', en: 'GDP' },
  status: 'draft',
  updated_at: '2026-07-11T00:00:00.000Z',
  version_number: 1,
  is_published: false,
  data_specs: [],
  config: {
    type: 'inner-page',
    id: SEED_PAGE_ID,
    path: 'gdp',
    children: [
      {
        type: 'chart',
        id: METRIC_CHART_NODE_ID,
        chartType: 'line',
        label: { ka: 'მშპ ერთ სულზე (მეტრიკა)', en: 'GDP per capita (metric spec)' },
        // The governed SemanticQuery — the exact pure-data spec the editor composes.
        data: { type: 'metric', metrics: ['gdp.perCapita'], time: { dim: 'time' } },
      },
    ],
  },
}

test.beforeEach(async ({ page }) => {
  // Fail LOUD on any uncaught page error — the white-screen defect class the M-SQ
  // resolver-in-dist must not reintroduce.
  page.on('pageerror', (err) => { throw err })
  await seedAuthToken(page)
  await mockPanelApi(page)
  // Override the page detail (registered AFTER the catch-all → higher precedence) so the
  // seed page carries a chart bound to a `metric` DataSpec.
  await page.route('**/api/config/pages/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: PAGE_WITH_METRIC_CHART }) }),
  )
})

test('a chart bound to a `metric` DataSpec renders in the real bundle — no white-screen', async ({ page }) => {
  await page.goto('/')

  // ── BOOT — the real Studio shell paints (dist is fresh; the metric resolver loaded). ──
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.studio-shell')).toBeVisible()

  // ── RENDER — the injected metric-spec chart node mounted on the canvas. Its presence
  //  (the anchor the canvas stamps on every rendered node) proves the REAL renderNode →
  //  resolveNodeRows → MetricResolver path executed for a `metric` DataSpec without a
  //  throw. jsdom cannot prove this (0-rect layout + no real bundle); the browser does.
  await expect(page.locator(`[data-part-node-id="${METRIC_CHART_NODE_ID}"]`))
    .toBeVisible({ timeout: 60_000 })

  // ── SAFE — the beforeEach pageerror guard asserts no uncaught error fired during the
  //  whole boot→render, i.e. the `metric` discriminant did not white-screen the app.
})
