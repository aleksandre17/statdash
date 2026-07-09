# Panel e2e — real-browser tests (Playwright)

The panel's formal end-to-end / real-browser harness. Adopted per
`docs/architecture/proposals/EVAL-package-landscape.md` §6 (Playwright = the single
highest-value, lowest-risk adoption): it closes the recurring **"green ≠ works"** gap —
unit/jsdom suites pass while the running app is broken (the M0 boot defects). This is
the automated form of the registry's perennial "REAL-BROWSER verify pending" TODO.

Apps-level test infra only. No runtime/product code, no dependency-arrow impact (Law 3):
a devDependency + this config + these specs.

## Run

```bash
# from platform/  (workspace root)
pnpm --filter @statdash/panel run test:e2e            # headless run
pnpm --filter @statdash/panel run test:e2e -- --ui    # interactive UI mode
pnpm --filter @statdash/panel run test:e2e:install     # one-time: install the Chromium browser
# or the root convenience alias:
pnpm test:e2e:panel
```

The `playwright.config.ts` `webServer` boots the panel's **real Vite dev server** on
`:5173` automatically (no manual start; `reuseExistingServer` locally reuses one you
already have running). First run is slow — the Studio is a heavy lazy chunk
(@statdash/react renderer + ApexCharts); timeouts are budgeted for it.

### Runner separation (no collision with Vitest)
Specs are `e2e/**/*.e2e.ts` (Playwright `testMatch`). Vitest's glob is
`src/**/*.test.{ts,tsx}` (`apps/panel/vitest.config.ts`) — **disjoint on both axes**
(directory *and* suffix), so the two runners never pick up each other's files.

## What is mocked vs. what needs the live stack

There is **no Docker / api+db** in this harness, so the specs stub the exact HTTP
surface the boot path touches, via Playwright route interception
(`e2e/support/mockApi.ts`):

- `GET /api/bootstrap` → the **governed semantic catalog** (a real subset of
  `apps/api/provisioning/geostat.provisioning.json` — real metric/dimension
  ids/codes/bilingual labels/units). This is what `bootstrapCatalog()` reads.
- `GET /api/config/{data-sources,data-specs,site,nav,pages,pages/:id}` → the five
  parallel reads `initFromApi()` makes, each as a `{ data }` envelope, plus a seed
  page whose `config` is a real `NodePageConfig` tree (a `chart` node = the governed
  bind target).
- Auth is seeded directly (`sessionStorage` token) so the app boots past `LoginForm`.

Everything the mock covers is **structure + boot ordering + governed-catalog wiring +
the metric-bind config write** — i.e. the M0/M1 class of defect. What it deliberately
does **not** cover (and can only be proven against a **live api + Postgres**) is the
deploy-time checklist below.

## Deploy-time checklist — flows provable ONLY against the real stack

Run these by hand (or in a future CI job with the api+db compose up) after deploy;
they are the panel's `VERIFIED` gate (registry status vocabulary = "server
real-browser / real-DB proven"):

1. **Login round-trip** — `POST /api/auth` with real credentials → JWT → boot to Studio.
2. **Config CRUD + DB persistence** — create/edit a page, data-source, data-spec →
   reload → the change survives (real `/api/config/*` writes, not mocked 200s).
3. **Save-guard on the wire** — a page that fails the C5 four-check gate is refused by
   the server (not just the client), issues surfaced inline.
4. **Publish role-gating (403)** — a non-publisher token → `POST /pages/:id/publish`
   returns 403, surfaced as "needs publisher" (never reimplemented client-side).
5. **Live cube preview** — the canvas "live" toggle renders against the **real stats
   cube** (`buildStoreManifest`), fail-soft to the static store on error.
6. **Permalink / `ViewSnapshot` round-trip** — URL = state (Law 9): a shared URL
   rehydrates the same view; export provenance matches (AR-48).
7. **Catalog parity** — the panel palette shows the SAME governed nouns the runner
   boots from the same `/api/bootstrap` manifest against a real provisioned tenant.

## Findings surfaced by this harness

### 1. FIXED — live canvas swallowed by a chrome-less SiteProvider

On its **first run** this harness caught a textbook "green ≠ works" defect:
`apps/panel/src/canvas/CanvasView.tsx` builds its `<SiteProvider>` **without a
`chromeConfig`**, but the `inner-page` shell unconditionally mounts
`<ChromeSlot slot="InnerSidebar" />` → `useChromeConfig()` **threw** → `NodeErrorBoundary`
swallowed it into a "Failed to load component" card, so the **live canvas could not
render page nodes in a real browser**. jsdom suites stayed green because the sibling proof
(`src/save/authorRender.e2e.test.tsx`) passes `chromeConfig` to its *own* SiteProvider —
the test compensated for what the product omits.

**Fixed** at the packages/react layer (the "fail-soft chrome" direction): `useChromeConfig`
now folds an **absent** `chromeConfig` to `EMPTY_CHROME_CONFIG` — the brand-free sentinel
every chrome shell already supports, identical to the app-tier offline-fallback
`chromeConfig: {}` — instead of throwing. A chrome shell must not hard-crash on absent
optional context; the guard makes **every** chrome-less mount valid, so the canvas needs
no `chromeConfig` of its own. jsdom net:
`packages/plugins/chrome/chrome-config-optional.fitness.test.tsx` (+ the hook contract
`packages/react/src/context/useChromeConfig.fitness.test.tsx`). The `boot.e2e.ts`
`test.fixme` is now a **real** assertion — the direct canvas-frame render proof.

### 2. FIXED — kpi-strip crashes on absent specs

The same run surfaced a SECOND fail-soft gap of the same class, in a different layer:
`interpretKpis` (`packages/core/src/data/kpi.ts`) called `specs.filter(...)` and threw
`Cannot read properties of undefined (reading 'filter')` when a `kpi-strip` node carried
no specs — the mock seed page has such a node. It was **isolated per-node** by
`NodeErrorBoundary` (the chart still rendered, so finding #1's proof held), but the panel
still crashed into a fallback card in a real browser.

**Fixed** at the packages/core layer (the engine-layer twin of the fail-soft chrome guard
above): BOTH public per-node KPI entry points now fold an absent `specs` to `[]` — the
render twin `interpretKpis` AND the warm twin `extractKpiRequirements` — so a spec-less
kpi-strip interprets to an EMPTY KPI set (the shell renders its `<EmptyState/>`) instead of
throwing. `items` is REQUIRED by `KpiStripNode`, so a well-formed strip is byte-identical;
the guard only covers the untyped node-config boundary (Postel/ISP). jsdom net:
`packages/core/src/data/kpi-specless-failsoft.fitness.test.ts`.

## Accessibility (axe)

`a11y.e2e.ts` scans the booted Studio for serious/critical WCAG 2.1 AA violations via
`@axe-core/playwright`. That package is **not offline-installable in this environment**,
so the scan **self-skips** until it is present — enable with one step, no code change:

```bash
pnpm --filter @statdash/panel add -D @axe-core/playwright
```

## Versions

- `@playwright/test` — pinned `1.61.1` (the version resolvable here: `npx playwright
  --version` + the global browser cache both report 1.61.1). Verify/refresh against the
  current release when online.
- `@axe-core/playwright` — **not yet a devDependency** (not offline-installable). Add it
  with the command above; it pairs with the existing `axe-core` root devDep (`^4.12.1`).
