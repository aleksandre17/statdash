# 🌙 Overnight #3 — the front/panel/api now RENDER DATA, live + green

## Headline
The geostat **front renders data end-to-end** (charts, tables, KPIs with YoY, latest year),
the **panel** (Constructor) loads clean with the 3 data-sources connected, and the **api**
self-provisions reproducibly. All on a **single-origin reverse-proxy** prod stack. Full gate:
**1497 tests** · typecheck 0 · lint 0 · check-laws clean · builds engine/geostat/panel OK · all on `main`.

## 🔗 Live (LAN — hard-refresh, Ctrl+Shift+R)
| | URL / creds |
|---|---|
| **Front** (renderer) | http://192.168.1.199:3002 · GDP page: http://192.168.1.199:3002/en/gdp |
| **Panel** (Constructor) | http://192.168.1.199:3003 — login `admin` / `statdash-admin-2026` |
| api | internal only (reached via each app's `/api` proxy — not publicly published) |

Verified in a real headless Chromium against the live deploy: GDP page renders the KPI
**"მშპ საბაზრო ფასებში 88 426 მლნ ₾ ↗ +14.1% წინა წელთან"** (GDP 88,426 mln ₾, ↗ +14.1% YoY),
1 chart + 8 tables, year **2025**, year dropdown 2025…2010, **zero "Failed to load"**.

## The data-render bug was SIX layered root causes (each found empirically, fixed at root)
The "no data" symptom had a stack of distinct causes — peeled one at a time with a live
browser probe (`work/probe.js`), never guessing:
1. **`config.data_source` empty** → the front builds ALL stores from these rows (`fetchStoreManifest`); a fresh DB had none. → **self-seeded at api boot** (provisioning SSOT, url=NULL for single-origin, idempotent). *Also fixed a latent bug: `upsertDataSource` never set `status` → rows landed `idle` → invisible to `/api/data-sources`.*
2. **Store-builder not registered before bootstrap** (bundle-split regression: `setupRegistrations` went lazy, but `bootstrapSite` builds stores first). → **`bootRegistrations()` eager** (light store-builders only; heavy graph stays lazy) + regression test.
3. **Async store never rendered** — `CachedStore` hardcoded `caps.sync=true` over an async `ApiStore` (cold `querySync` throws); `renderNode` was sync-only. → **CachedStore capability-transparent + `queryAsync`; renderNode routes `caps.sync===false` through `useNodeRows` (warm→read)** + through-renderNode async test (the coverage that was missing).
4. **Year resolved to 0** (`from=0&to=0` → API 400) — the `time` classifier is never loaded (it lives in observations, not codelists), so `pick:'last'` → `[]` → coerced to 0. → **store-builder folds the dataset's time coverage (from the cube profile's new `timeCoverage`, sourced from `cube_actual_region` + distinct periods) into `classifiers['time']` at build time** (resolves sync, never hangs; Law 1 — time-dim key via `isTime`/`TIME_DIM`) + 2 guards (omit `from/to` on unset; no 0-coercion).
5. **KPI YoY cold** — the kpi-strip is a SEPARATE read surface (`interpretKpis`→`storeVal`) that `extractRequirements`/`useNodeRows` never warmed; a YoY KPI reads year AND year-1. → **`extractKpiRequirements` + `useKpiRows`** (warm the KPI reqs incl. year-1) + in-flight dedup in `CachedStore.queryAsync` (StrictMode hardening).
6. **CSP blocked brand images** → `img-src` widened to allow `https:` (tenant-agnostic).

> Note: the react-specialist correctly **REFUSED** a prescribed fix (gating on the never-loaded
> time classifier would hang forever) and escalated to the architect for the non-hanging seam —
> exactly the "don't ship degradation" discipline.

## Deployment (professional, no hacks)
Single-origin reverse proxy: each app's nginx serves `/` + proxies `/api/` → internal api.
No CORS, CSP `'self'` (api same-origin), relative `/api`, reproducible vite-only images
(peer-deps resolved via data-driven `resolve.alias`), unified `ops/compose/docker-compose.prod.yml`
(postgres + flyway V1→V31+seed + api internal + geostat/panel). See `platform/DEPLOY.md`.

## ⚠️ Flagged for your morning call (NOT pipeline bugs — config/data nuances)
1. **"რეალური ზრდა +88 425.6%"** — a "real growth" KPI shows the GDP *level* (88425.6) as a
   growth %. This is a provisioning-config / data-semantics issue (which measure is the real-growth
   rate, and does the seed carry it?), not a render bug. I did **not** guess the intended semantics —
   needs your steer. (Everything else on the page is correct.)
2. **Panel canvas** — I verified the panel loads clean (data-sources connected, Constructor
   functional, zero errors) and it shares the EXACT fixed renderer+stores the front uses; I could
   not fully automate the PageBrowser page-select in the probe, so a human visual confirm of a
   selected page's canvas is the last manual check (expected to render identically to the front).

## State
1497 tests · typecheck 0 · lint 0 · check-laws clean · 3 builds green · all containers healthy ·
data_source provisioning reproducible · all pushed to `main` (latest incl. CSP fix).
