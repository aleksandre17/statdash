---
name: render-path-browser-verify
description: How to get a REAL-browser render of the geostat runner + Constructor panel for visual/responsive verification (de-tenanted runner needs an API; live server is representative of the branch)
metadata:
  type: reference
---

Working render path for browser-verifying the UI (standing rule: verify render with a real browser).

**The trap:** the geostat runner is de-tenanted (ADR-0028) — it pulls ALL content from `GET /api/bootstrap`. With no API it fails-soft to `emptyManifest()` (brand-free "site unavailable"), so a bare `vite dev`/`build:preview` renders NOTHING real. `apps/api` needs Postgres + seeded provisioning (heavy, real side-effects) — avoid for read-only audits.

**Dead-env false lead (verified 2026-07-01):** `VITE_STORE_MODE` (`static`/`api`/`stats`) survives ONLY in `apps/geostat/src/vite-env.d.ts` + a vestigial `dev:stats` package script — ZERO runtime code reads it (`bootstrapSite()` is unconditionally API-first). It is NOT a "render inline data without a backend" switch. The `type==='static'` in `fetch-store-manifest.ts` is a `config.data_source` ROW type served BY the API, unrelated to the env. Do not chase static mode for docker-free data — there is none.

**Fail-soft is itself broken (verified 2026-07-01):** with no API, `emptyManifest()` renders but `AppHeaderShell` throws `Cannot read properties of undefined (reading 'en')` on the empty `chromeConfig`/i18n, and with no error boundary React unmounts to a FULLY BLANK white page — not even the "site unavailable" text shows. So docker-free geostat = blank, 0 panels/charts/map at every route. (Incidental defect in the graceful-degradation path; chrome/plugins scope.)

**Use the live server** (`ops/config/ssh/config` topology):
- geostat `http://192.168.1.199:3002` — routes `/:locale/*`, default locale `ka`: `/ka` (landing/index), `/ka/gdp`, `/ka/accounts`, `/ka/regional`, `/ka/example`. Pages/nav come from `/api/bootstrap`.
- panel `http://192.168.1.199:3003` — **auth-gated**: only a login card renders without credentials; the Constructor canvas/inspector/outline/cmdk is NOT reachable unauthenticated.

**Staleness is usually a non-issue:** the live server builds from `main`, but `feat/tenant-agnostic-platform` was strictly *ahead* of `origin/main` (merge-base == origin/main) with zero responsive-surface diffs — so `:3002` was representative of the branch. Always re-check with `git merge-base origin/main HEAD` + a `git diff --stat origin/main...HEAD -- packages/styles packages/react/src/theme <shells>` before trusting it.

**Tooling:** no Playwright browsers pre-installed. `npx playwright install chromium` (→ `~/AppData/Local/ms-playwright/chromium-*`), then `npm i playwright` in a scratch dir (browsers are reused from the default path). Headless chromium, `deviceScaleFactor:1`, `emulateMedia({reducedMotion:'reduce'})`, wait `networkidle` + ~2.5s settle for charts. To find true layout overflow vs phantom, hide `.sr-only` and re-measure `documentElement.scrollWidth` (see [[responsive-audit-systemic-roots]]).
