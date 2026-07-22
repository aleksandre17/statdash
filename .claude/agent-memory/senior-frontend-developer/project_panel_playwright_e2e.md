---
name: project-panel-playwright-e2e
description: Panel real-browser e2e harness (Playwright) — location, runner separation, mock-API boot proof, keystone test flow, and the idempotent-hydrate fix it caught. NOTE — the old offline-shim/junction bridge recipe this file used to carry is STALE; see [[reference_dev_line_panel_3013]] ("Playwright IS installed" — run it directly).
metadata:
  type: project
---

Playwright is the panel's formal real-browser/e2e tool (closes "green ≠ works"). Committed under
`platform/apps/panel/`: `playwright.config.ts` + `e2e/*.e2e.ts` + `e2e/support/mockApi.ts`.
Scripts: `test:e2e` (panel), `test:e2e:panel` (root alias).

**Why / how to apply:**
- **Runner separation is load-bearing:** specs are `e2e/**/*.e2e.ts` (Playwright `testMatch`);
  vitest glob is `src/**/*.test.{ts,tsx}` — disjoint on dir AND suffix, never put a Playwright
  spec under `src/` or name it `*.test.ts`. (`src/**/*.e2e.test.tsx` files are jsdom tests, NOT
  Playwright — a naming trap.)
- **No api+db needed:** the boot proof stubs the HTTP surface via `page.route('**/api/**')` —
  `/api/bootstrap` (a real subset of geostat.provisioning.json) + the five `/api/config/*` reads
  `initFromApi` makes + a seed page whose `config` is a real NodePageConfig tree. Auth seeded via
  `sessionStorage` (`geostat_panel_token`) in `addInitScript`.
- **webServer** boots the real Vite dev server on `:5173`; Studio is a heavy lazy chunk → generous
  timeouts.
- **How to run it now:** Playwright + chromium are installed in `platform/node_modules` — run
  directly, no shim/junction bridge needed (that workaround, once required on this box, is now
  obsolete; see [[reference_dev_line_panel_3013]] for the current recipe, including driving the
  live :3013 deploy).

**Keystone flow (`boot.e2e.ts`):** boot → banner/`.studio-shell` → Data surface → populated
MetricPalette (real governed nouns) → bind a metric to a chart block (select via Layers
**outline** `[data-outline-id]`, then click the tile → live-region confirms bound + Inspector
metric select shows the bound id). Selecting via the outline, not the canvas frame, sidesteps
[[project_panel_canvas_chromeconfig_defect]]'s chrome-selectable overlay.
**a11y** (`a11y.e2e.ts`): axe scan scaffolded, self-skips until `@axe-core/playwright` is added as
a devDep.
**steward.e2e.ts** (in-tool metric authoring end-to-end): boot author lens → top-bar Data-model
toggle → steward lens → MetricCatalogManager → New metric → pick dataset+measure (unit pre-fills)
→ slug id + bilingual governed label + format → Create → save-success → toggle back to author →
Data → assert the tile appears in MetricPalette by governed label. `mockApi` carries a stateful
mutable catalog (PUT `/api/config/site` replaces it) + `/api/stats/datasets` +
`/api/cube/:code/profile`.

**Idempotent-hydrate fix this harness caught (real defect, not a test bug):** `initFromApi`'s
pageDetails hydrate loop called the user-facing append `addPage` per page — non-idempotent under a
re-run. React StrictMode double-invokes the boot effect, and App.tsx's "already hydrated" guard is
a SYNCHRONOUS check racing an ASYNC `initFromApi`, so it can run twice before either write lands →
duplicate-key React warning ("two children with the same key"). Fix: `setPages`/`setPagesPatch`
(an authoritative REPLACE of the whole `pages` array, mirroring `setDataSources`, NOT
history-tracked — a server sync isn't a user edit); `initFromApi` calls it once instead of
per-page `addPage`. The user "add page" action itself is untouched (still a correct blind append).
**Known same-class latent issue, not fixed:** `App.tsx`'s offline/mock fallback branches
(`store.addPage(MOCK_PAGE)`, two call sites) have the identical shape and race window — low
priority (mock-only, prod-harmless), same fix pattern applies if ever hit.
