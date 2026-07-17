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

**UPDATED bridge recipe (2026-07-11 — a REAL `@playwright/test@1.61.1` pnpm dep now
exists):** `node_modules/@playwright/test` is the OBSOLETE offline shim (a real dir,
`require('playwright/test')`), and `node_modules/playwright` junctions to the npx cache —
these two + the real `.pnpm/@playwright+test@1.61.1` collide → `did not expect
test.beforeEach()` / "two different versions of @playwright/test" / "No tests found" on a
plain `pnpm test:e2e` OR `node node_modules/playwright/cli.js test`. WORKING recipe (run
from `platform/`): temporarily swap the shim for the real package, run its cli, restore:
`mv node_modules/@playwright/test node_modules/@playwright/test.shimbak` → `powershell
New-Item -ItemType Junction -Path node_modules\@playwright\test -Target
node_modules\.pnpm\@playwright+test@1.61.1\node_modules\@playwright\test` → `CI=1 node
node_modules/@playwright/test/cli.js test --config apps/panel/playwright.config.ts
<spec>.e2e.ts` → restore: `powershell (Get-Item node_modules\@playwright\test).Delete()`
(removes only the junction link, NOT the target) + `mv ...shimbak back`. Both runner AND
spec-import now resolve to ONE real instance. The Vite dev server boots fine on :5173
(reuseExistingServer). ~7s/spec. Proven: chromeNavAuthoring + full 8-spec suite green.
The default (un-swapped) state is BROKEN for e2e — reconcile by removing the shim so
pnpm's `@playwright/test` symlink stands (flagged).

**Shim-identity gotcha (bit me 2026-07-09):** the shim MUST `require('playwright/test')` (resolves through the node_modules/playwright JUNCTION), NOT a hardcoded absolute path to a specific `_npx/<hash>/…/playwright/test.js`. There are MULTIPLE `_npx/<hash>` caches, and if the shim points at a DIFFERENT hash than the junction (which the cli.js runner loads), the spec's `test`/`expect` are a DIFFERENT module instance than the runner → `test.beforeEach() … did not expect … two different versions of @playwright/test` and "No tests found". Fix: both sides must resolve to ONE instance — shim via `require('playwright/test')`, run via `node_modules/playwright/cli.js`.

**steward.e2e.ts (M2.2 headline, added 2026-07-09):** proves in-tool metric authoring end-to-end — boot author lens → top-bar "Model mode" toggle → steward lens → Model surface → MetricCatalogManager → New metric → PICK dataset+measure (unit pre-fills) → slug-legal id + bilingual GOVERNED label (distinct from cube measure label) + format → Create → save-success → toggle back to author → Data → assert tile in MetricPalette by governed label + count grew by 1. mockApi extended: stateful mutable catalog (PUT /api/config/site replaces it, GET /api/bootstrap serves it), `/api/stats/datasets`, `/api/cube/:code/profile` (typed against src/lib/cubeApi).

**FIXED 2026-07-09 (idempotent hydrate):** the `initFromApi`→blind-append duplicate-key defect above is fixed. Root cause: `initFromApi`'s pageDetails hydrate loop called the user-facing append `addPage` per page — non-idempotent under a re-run (App.tsx's "already hydrated" guard is a SYNCHRONOUS check racing an ASYNC initFromApi, so React StrictMode's double-invoked boot effect can run initFromApi twice before either write lands). Fix: added `setPages`/`setPagesPatch` (constructor.store.ts / constructor.pages.ts) — an authoritative REPLACE of the whole `pages` array, mirroring the existing `setDataSources` convention (not history-tracked; a server sync isn't a user edit). `initFromApi` now calls `store.setPages(pageDetails.map(fromApiPage))` once instead of per-page `addPage`; `addPage` itself (user "add page" action) is untouched — still a blind append, correctly. Unit-proven in `src/store/initFromApi.test.ts` (concurrent + sequential double-hydrate → no dup ids). Empirically double-checked in the real steward.e2e.ts browser run: temporarily added a `page.on('console')` error-print, reverted the fix via `git stash`, and confirmed the exact "Encountered two children with the same key, `page-gdp`" console.error fires pre-fix and is silent post-fix — Vite's dev server mirrors browser console.error/warn to the `[WebServer]` terminal stream by itself (`[vite] (client) [console.error] ...`), so a plain `page.on('pageerror')`-only spec (no console listener) won't itself catch a React key warning (it's console.error, not a thrown error) — but the terminal output makes it visible anyway without extra test code.

**Known same-class latent issue, NOT fixed (out of scope, flag only):** `App.tsx`'s offline/mock fallback branches (`store.addPage(MOCK_PAGE)`, two call sites) have the identical non-idempotent-append shape and the identical StrictMode-race window as the fixed `initFromApi` path. Low priority (mock-only path, prod-harmless), but the same fix pattern (`setPages`/replace, or an upsert-by-id check like `openPage` already does) would apply if it's ever hit.
