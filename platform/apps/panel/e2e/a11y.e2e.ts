// ── a11y.e2e — automated WCAG 2.1 AA gate on the booted Studio (Law 9) ─────────
//
//  Turns the dormant `axe-core` devDep into an automated accessibility gate via
//  `@axe-core/playwright` — the highest-leverage add-on to the Playwright adoption
//  (EVAL §7). It scans the REAL booted Studio shell and fails on any serious/critical
//  violation on the main landmarks.
//
//  SCAFFOLD NOTE (honest offline state): `@axe-core/playwright` is NOT installable in
//  this offline harness, so the scan is behind a dynamic import that SKIPS (never
//  errors) when the package is absent. Enable it with ONE step — no code change here:
//      pnpm --filter @statdash/panel add -D @axe-core/playwright
//  The moment that dep resolves, this spec runs the scan as a hard gate.
//
import { test, expect } from '@playwright/test'
import { mockPanelApi, seedAuthToken } from './support/mockApi'

// Load @axe-core/playwright if present; return null (→ skip) when it is not.
async function loadAxeBuilder(): Promise<unknown | null> {
  try {
    const mod = await import('@axe-core/playwright')
    return (mod as { default?: unknown }).default ?? mod
  } catch {
    return null
  }
}

test.beforeEach(async ({ page }) => {
  await seedAuthToken(page)
  await mockPanelApi(page)
})

test('the booted Studio shell has no serious/critical WCAG 2.1 AA violations', async ({ page }) => {
  const AxeBuilder = await loadAxeBuilder()
  test.skip(AxeBuilder === null, '@axe-core/playwright not installed — see spec header to enable (one-line add)')

  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('navigation', { name: 'Studio surfaces' }).getByRole('button', { name: 'Data', exact: true }).click()
  await expect(page.getByTestId('metric-palette')).toBeVisible()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically-loaded optional dep
  const Builder = AxeBuilder as new (opts: { page: typeof page }) => any
  const results = await new Builder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const serious = results.violations.filter(
    (v: { impact?: string }) => v.impact === 'serious' || v.impact === 'critical',
  )
  // Named-and-listed on failure so the report points at the exact rule/nodes.
  expect(serious, JSON.stringify(serious.map((v: { id: string }) => v.id), null, 2)).toEqual([])
})
