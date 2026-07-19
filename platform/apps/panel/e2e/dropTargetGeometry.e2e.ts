// ── dropTargetGeometry.e2e — drop-into-container proven in the REAL bundle (card 0102 R1) ──
//
//  The jsdom-can't-catch proof for the owner's PRIMARY gesture: drop a layout element INTO
//  a container. jsdom computes NO layout (every getBoundingClientRect is 0×0), so a unit
//  fitness can never pin drop-port GEOMETRY — only a real browser measuring the real Vite
//  bundle can. This harness is that pin, and the decisive experiment behind the R1 verdict:
//
//    1. every container/page drop-port measures a NON-DEGENERATE box (the container's real
//       rendered box — NOT the {0,0,0,0} display:contents anchor). CanvasOverlay.measure()
//       reads `anchor.firstElementChild`, which resolves the real box even though the anchor
//       itself is layout-inert (display:contents). R1's `[data-node-empty] > *` min-height
//       makes an EMPTY container a usable (~72px) target too.
//    2. given the ports exist (the human scenario — React has committed the `dragging` mount
//       long before a real pointer reaches the target), a real HTML5 drop carrying `nodeType`
//       LANDS the new node as a CHILD of the empty container (not a sibling).
//
//  NB — the drop ports are gated on `dragging===true` (revealed at palette onDragStart). An
//  ATOMIC trusted CDP drag (dragstart→drop in one synchronous turn) can drop before that
//  React mount commits — a harness-timing artifact, NOT a human-facing bug: this spec reveals
//  the ports first (as a real drag's dwell time does), then drops.
//
import { test, expect, type Page, type Route } from '@playwright/test'

const GOVERNED = {
  metrics:    [{ id: 'gdp.current', code: 'gdp-cp', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ', en: 'mn' }, format: 'mln_gel', dataSource: 'gdp' }],
  dimensions: [{ id: 'time', code: 'time', label: { ka: 'პერიოდი', en: 'Period' }, conceptRole: 'time' }],
}
const PAGE_ID = 'page-drop'
// A page holding a POPULATED grid, an EMPTY grid, and an EMPTY section — the three container
// shapes a drop must land into. All valid top-level children of the inner-page frame.
const PAGE_CONFIG = {
  type: 'inner-page', id: PAGE_ID, path: 'drop',
  children: [
    { type: 'grid', id: 'grid-pop', columns: { default: 2 }, children: [
      { type: 'text', id: 't1', content: 'Alpha' },
      { type: 'text', id: 't2', content: 'Bravo' },
    ] },
    { type: 'grid',    id: 'grid-empty', columns: { default: 2 }, children: [] },
    { type: 'section', id: 'sec-empty',  title: { ka: 'ც', en: 'S' }, children: [] },
  ],
}
// ka-first so the panel boots in Georgian — proves slot labels resolve to the ACTIVE
// locale (bug #3: the overlay hard-coded `.en`, so `/ka/` showed "Sticky Bar"/"Content").
const SITE     = { name: 'e2e', defaultLocale: 'ka', activeLocales: ['ka', 'en'], themeOverrides: {}, dataSourceBindings: {}, chrome: {} }
const PAGE_ROW = { id: PAGE_ID, slug: 'drop', title: { ka: 'დ', en: 'Drop' }, status: 'draft', updated_at: '2026-07-16T00:00:00.000Z' }

const j = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
async function mock(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname
    if (p.endsWith('/api/bootstrap'))           return j(route, GOVERNED)
    if (p.endsWith('/api/config/site'))         return j(route, { data: SITE })
    if (p.endsWith('/api/config/data-sources')) return j(route, { data: [] })
    if (p.endsWith('/api/config/data-specs'))   return j(route, { data: [] })
    if (p.endsWith('/api/config/nav'))          return j(route, { data: [] })
    if (p.endsWith('/api/config/pages'))        return j(route, { data: [PAGE_ROW] })
    if (p.includes('/api/config/pages/'))       return j(route, { data: { ...PAGE_ROW, config: PAGE_CONFIG, data_specs: [], version_number: 1, is_published: false } })
    return j(route, { data: {} })
  })
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err })
  await page.addInitScript(() => window.sessionStorage.setItem('geostat_panel_token', 'e2e-token'))
  await mock(page)
})

// Reveal the drop ports the way a real drag's dwell does: a genuine dragstart on a palette
// tile flips the overlay `dragging` state (React commits the mount before the pointer moves).
async function revealDropPorts(page: Page): Promise<void> {
  const tile = page.locator('.node-palette__tile[data-node-type]').first()
  await expect(tile).toBeVisible({ timeout: 60_000 })
  await tile.evaluate((el) => {
    const dt = new DataTransfer()
    el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
  })
  await expect(page.locator('.canvas-dropzone').first()).toBeVisible({ timeout: 10_000 })
}

test('every container/page drop-port measures a non-degenerate box (not the display:contents anchor)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.canvas-root')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-part-node-id="grid-empty"]').first()).toBeAttached({ timeout: 60_000 })

  await revealDropPorts(page)

  const zones = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.canvas-dropzone')).map((z) => {
      const r = z.getBoundingClientRect()
      return { key: z.dataset.testid, w: r.width, h: r.height, x: r.x, y: r.y }
    }),
  )

  // The page body + BOTH empty containers + the populated grid all expose a port.
  const byKey = new Map(zones.map((z) => [z.key, z]))
  for (const key of [
    'dropzone-page-drop:main',
    'dropzone-grid-empty:children',
    'dropzone-sec-empty:children',
    'dropzone-grid-pop:children',
  ]) {
    const z = byKey.get(key)
    expect(z, `port ${key} must be mounted`).toBeTruthy()
    // Non-degenerate: a real container box, never the collapsed {0,0,0,0} anchor. The
    // 24px floor is far above the 4×4 collapse signature and comfortably below a real
    // empty container (~72px tall in this viewport).
    expect(z!.w, `${key} width`).toBeGreaterThan(24)
    expect(z!.h, `${key} height`).toBeGreaterThan(24)
    expect(Math.abs(z!.x) + Math.abs(z!.y), `${key} must not sit at the canvas origin`).toBeGreaterThan(24)
  }
})

// 0102 R1 — the projection fix: each declared slot gets its OWN distinct box (the owner's
// "labels pile on top of each other, ugly"). The inner-page declares TWO slots — a populated
// `main` (children) + an empty `sticky` — which the old overlay pushed as N dropzones on the
// parent's ONE box (fully overlapping + stacked labels). They must now be DISTINCT boxes, and
// each label must resolve to the ACTIVE locale (ka), not the hard-coded `.en`.
test('each declared slot gets a DISTINCT non-overlapping zone with a locale-resolved label', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-part-node-id="page-drop"]').first()).toBeAttached({ timeout: 60_000 })

  await revealDropPorts(page)

  const zone = (key: string) => page.evaluate((k) => {
    const z = document.querySelector<HTMLElement>(`[data-testid="dropzone-${k}"]`)
    if (!z) return null
    const r = z.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, label: z.querySelector('.canvas-dropzone__label')?.textContent ?? '' }
  }, key)

  const main   = await zone('page-drop:main')
  const sticky = await zone('page-drop:sticky')
  expect(main,   'inner-page main zone must be mounted').toBeTruthy()
  expect(sticky, 'inner-page sticky zone must be mounted').toBeTruthy()

  // The regression guard: the two slots must NOT share a box (the source of the pile-up).
  const sameBox = main!.x === sticky!.x && main!.y === sticky!.y && main!.w === sticky!.w && main!.h === sticky!.h
  expect(sameBox, 'main and sticky must occupy DISTINCT boxes').toBe(false)
  // Both non-degenerate (a real, usable target — not the {0,0,0,0} collapse).
  for (const z of [main!, sticky!]) {
    expect(z.w, 'zone width').toBeGreaterThan(8)
    expect(z.h, 'zone height').toBeGreaterThan(8)
  }
  // Labels resolve to the ACTIVE locale (ka), never the hard-coded English.
  expect(main!.label,   'main label ka').toContain('შიგთავსი')   // ka 'Content'
  expect(sticky!.label, 'sticky label ka').toContain('ზოლი')     // ka 'Sticky ზოლი'
})

test('a real HTML5 drop LANDS the new node as a CHILD of an empty container', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-part-node-id="grid-empty"]').first()).toBeAttached({ timeout: 60_000 })

  await revealDropPorts(page)

  const before = await page.locator('[data-part-node-id="grid-empty"] [data-part-node-id]').count()
  expect(before).toBe(0)

  await page.evaluate(() => {
    const z = document.querySelector('[data-testid="dropzone-grid-empty:children"]') as HTMLElement
    const dt = new DataTransfer()
    dt.setData('nodeType', 'text')
    const r = z.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    z.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy }))
    z.dispatchEvent(new DragEvent('drop',     { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy }))
  })

  // The new node lands INSIDE the empty grid (a child anchor now nests under it).
  await expect(page.locator('[data-part-node-id="grid-empty"] [data-part-node-id]')).toHaveCount(1, { timeout: 10_000 })
})
