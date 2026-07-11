import { defineConfig, devices } from '@playwright/test'

// ── live.config — drive the DEPLOYED dev line (:3013), no local webServer ────────
//
//  The real-browser proof against the running statdash-dev panel (source-mounted,
//  live-watch). PW_BASE_URL points at the dev line; the spec route-intercepts /api/**
//  for a deterministic seed, so the assertion is about the UI bundle, not live data.
//
const BASE_URL = process.env.PW_BASE_URL ?? 'http://192.168.1.199:3013'

export default defineConfig({
  testDir: '.',
  testMatch: 'summaryCardInspector.e2e.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
