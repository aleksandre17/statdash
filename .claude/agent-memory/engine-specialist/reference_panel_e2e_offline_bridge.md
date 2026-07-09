---
name: panel-e2e-offline-bridge
description: How to run the apps/panel Playwright e2e (boot.e2e.ts) offline in this env — cached playwright 1.61.1 + @playwright/test shim; panel bundles @statdash/* from SOURCE so a core edit needs no rebuild
metadata:
  type: reference
---

The panel real-browser e2e is the "green ≠ works" net over engine changes the runner
consumes. To run it offline (verified 2026-07-09, AR-49 kpi fail-soft fix, 2/2 passed
~9.5s):

```
cd platform/apps/panel
export PLAYWRIGHT_BROWSERS_PATH=~/AppData/Local/ms-playwright
node ~/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/cli.js \
  test boot.e2e.ts --config=playwright.config.ts
```

- `@playwright/test` is a devDep NOT materialized in node_modules; a gitignored
  resolution shim already exists at `platform/node_modules/@playwright/test/`
  (index.js/index.mjs re-export the cached standalone `playwright` 1.61.1 test
  runner). Full shim-construction detail: [[panel-playwright-offline-bridge]]
  (plugins-specialist dir) if the shim is ever missing.
- The config's `webServer` auto-boots the real Vite dev server on :5173; mockApi.ts
  intercepts `/api/*` in-browser. The seed page (`e2e/support/mockApi.ts` PAGE_CONFIG)
  carries a deliberately spec-less kpi-strip (`{type:'kpi-strip', id:'kpi-gdp'}` — no
  `items`) — the reproduction seed for the fail-soft guard.

**Source-resolution fact (why a core edit is exercised without a rebuild):** the panel
`vite.config.ts` aliases every `@statdash/*` to package SOURCE, and core's package.json
`exports["."].source` → `./src/index.ts`. So the Vite dev server bundles edited
`packages/core/src` directly — UNLIKE apps/api which consumes engine DIST
([[apps-api-engine-dist]]). A packages/core fix is live in the e2e with no build step.
