import { defineConfig, devices } from '@playwright/test'

// ── Playwright e2e config — the geostat RUNNER's real-browser gate ─────────────
//
//  Mirror of apps/panel/playwright.config.ts (the committed harness pattern), for
//  the runner app. Exists to close the "options-green, live-crash" class: jsdom
//  suites cannot execute ApexCharts (the known blindspot), so an options-level
//  fitness gate can be green while the real bundle throws at mount — exactly the
//  2026-07-16 rangeSlider regression (ReferenceError: ApexCharts is not defined +
//  the window.Apex._chartInstances clone RangeError). Only a real browser driving
//  the real Vite module graph catches that class.
//
//  Runner separation: specs are `e2e/**/*.e2e.ts`; vitest's glob is
//  `src/**/*.test.{ts,tsx}` (vitest.config.ts) — disjoint on dir AND suffix.
//
//  API: no live backend needed — specs replay recorded governed responses from
//  e2e/fixtures/ via route interception (see rangeSliderBrush.e2e.ts, which also
//  documents the re-record flow when provisioning changes).
//
const CI = !!process.env.CI
const PORT = 5174 // distinct from the panel harness (5173) so both can coexist
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',

  timeout: 90_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Boot the runner's REAL Vite dev server. VITE_API_STATS_URL is left unset →
  // the client hits relative `/api/*` (same-origin), which the specs intercept
  // in-browser (fixtures replay; no backend is ever reached).
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
