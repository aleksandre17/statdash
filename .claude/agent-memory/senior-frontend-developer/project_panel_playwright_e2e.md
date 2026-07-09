---
name: project-panel-playwright-e2e
description: Panel real-browser e2e harness (Playwright) — location, runner separation, mock-API boot proof, offline-run bridge
metadata:
  type: project
---

Playwright is the panel's formal real-browser / e2e tool (EVAL-package-landscape.md §6 ADOPT — closes "green ≠ works"). Committed under `platform/apps/panel/`: `playwright.config.ts` + `e2e/*.e2e.ts` + `e2e/support/mockApi.ts` + `e2e/README.md`. Scripts: `test:e2e` (panel), `test:e2e:panel` (root alias).

**Why / How to apply:**
- **Runner separation is load-bearing:** specs are `e2e/**/*.e2e.ts` (Playwright `testMatch`); vitest glob is `src/**/*.test.{ts,tsx}`. Disjoint on dir AND suffix — never put a Playwright spec under `src/` or name it `*.test.ts`. (Note: existing `src/**/*.e2e.test.tsx` files are jsdom tests, NOT Playwright.)
- **No api+db here:** the boot proof stubs the HTTP surface via `page.route('**/api/**')` — `/api/bootstrap` (governed catalog, real subset of geostat.provisioning.json) + the five `/api/config/*` reads `initFromApi` makes (each `{ data }` envelope) + a seed page whose `config` is a real NodePageConfig tree. Auth seeded via `sessionStorage` (`geostat_panel_token`) in `addInitScript`.
- **webServer** boots the real Vite dev server on `:5173` (VITE_API_URL unset → relative `/api/*`, which route-interception catches). Studio is a heavy lazy chunk → generous timeouts.
- **Keystone** (`boot.e2e.ts`): boot → banner/`.studio-shell` → Data surface → populated MetricPalette (real governed nouns) → bind a metric to a chart block (select via Layers **outline** `[data-outline-id]`, then click tile → live-region "მეტრიკა მიბმულია" + Inspector metric `<select>` = `gdp.current`). Selecting via outline (not the canvas frame) sidesteps [[project-panel-canvas-chromeconfig-defect]].
- **a11y** (`a11y.e2e.ts`): axe scan scaffolded; `@axe-core/playwright` NOT offline-installable → self-skips until `pnpm --filter @statdash/panel add -D @axe-core/playwright`.

**Offline-run mechanism (this Windows box, no web):** `@playwright/test` is NOT installable offline, but the npx cache has full `playwright` + `playwright-core` **1.61.1** (`~/AppData/Local/npm-cache/_npx/*/node_modules/playwright` — it ships the runner: `lib/runner`, `./test` export) and Chromium is installed (`~/AppData/Local/ms-playwright/chromium_headless_shell-1228`). To run: junction `platform/node_modules/{playwright,playwright-core}` → the cache, add a `platform/node_modules/@playwright/test` shim (`index.js` = `require('playwright/test')`), then `node platform/node_modules/playwright/cli.js test --config apps/panel/playwright.config.ts`. node_modules is gitignored so the bridge never pollutes the tree. Pinned devDep = `@playwright/test@1.61.1`.
