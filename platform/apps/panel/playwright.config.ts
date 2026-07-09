import { defineConfig, devices } from '@playwright/test'

// ── Playwright e2e config — the panel's real-browser gate (EVAL §6 ADOPT) ──────
//
//  Formalizes the ad-hoc Playwright probes into ONE committed harness. This is the
//  "green ≠ works" closer: unit/jsdom suites pass while the running app is white-
//  screened (the M0 boot defects) — only a real browser driving the real Vite
//  bundle catches that class. Runtime-agnostic, apps-level ONLY: no product code,
//  no dependency-arrow impact (Law 3) — a devDependency + this config.
//
//  Runner separation: specs are `*.e2e.ts` under ./e2e (testMatch below). Vitest's
//  glob is `src/**/*.test.{ts,tsx}` (apps/panel/vitest.config.ts) — disjoint on BOTH
//  axes (dir + suffix), so the two runners never collide.
//
//  API: no Docker/api+db here → the specs stub the governed HTTP surface via route
//  interception (e2e/support/mockApi.ts). Flows that need the LIVE stack are the
//  deploy-time checklist in e2e/README.md.
//
const CI = !!process.env.CI
const PORT = 5173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Keep e2e OUT of the vitest glob: only `*.e2e.ts` is a Playwright spec.
  testMatch: '**/*.e2e.ts',

  // The Studio shell is a heavy lazy chunk (@statdash/react renderer + ApexCharts);
  // the FIRST dev-server transform of that graph is slow. Budgets are generous by
  // design (documented slowness), tightened by Playwright's built-in auto-waiting.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,           // one boot-heavy app + one dev server — serial is faster & stabler
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Deterministic viewport so the canvas overlay frames have stable geometry.
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Boot the panel's REAL Vite dev server. VITE_API_URL is left unset → the client
  // hits relative `/api/*` (same-origin :5173), which the specs intercept in-browser
  // (the proxy/backend is never reached). `reuseExistingServer` locally lets a
  // pre-started dev server be reused for fast iteration.
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
