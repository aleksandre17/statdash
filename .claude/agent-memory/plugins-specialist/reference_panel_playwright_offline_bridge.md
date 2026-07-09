---
name: panel-playwright-offline-bridge
description: How to run apps/panel Playwright e2e offline — cached standalone playwright 1.61.1 + a @playwright/test shim + ms-playwright browsers
metadata:
  type: reference
---

Running the panel real-browser e2e (`apps/panel/e2e/*.e2e.ts`) in THIS offline
environment. `@playwright/test` is a declared devDep (1.61.1) but is NOT
materialized in node_modules, and `npx playwright` is not on PATH.

**Bridge (verified working, 2026-07-09):**
- The standalone `playwright` 1.61.1 package IS in the npx cache at
  `~/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright`. In
  1.61 it BUNDLES the test runner (`playwright/test.js`, `lib/runner`,
  `lib/program.js`) — `@playwright/test` is just a re-export of `playwright/test`.
- Browsers are pre-installed at `~/AppData/Local/ms-playwright` (chromium-1228
  etc.) — set `PLAYWRIGHT_BROWSERS_PATH` to it.
- Create a resolution shim `platform/node_modules/@playwright/test/` (gitignored):
  `package.json` (exports import→index.mjs, require→index.js) + `index.js`
  (`module.exports = require('<cache>/playwright/test.js')`) + `index.mjs` with
  EXPLICIT named re-exports (`export const test/expect/defineConfig/devices/... = cjs.x`;
  `export default cjs.test`). The explicit mjs is REQUIRED — cjs-module-lexer can't
  follow playwright/test.js's deep re-export chain, so bare `import { defineConfig }`
  fails with "does not provide an export named 'defineConfig'".
- Run: `cd apps/panel && node <cache>/playwright/cli.js test boot.e2e.ts
  --config=playwright.config.ts`. The config's `webServer` auto-boots the real
  Vite dev server on :5173 (reuseExistingServer locally); mockApi.ts intercepts
  `/api/*` in-browser. First transform of the Studio chunk is slow (budgeted 90s).

Result of the AR-49 chrome-fix run: both boot.e2e.ts tests passed (~10s total).
See [[chrome-failsoft-chromeconfig]].
