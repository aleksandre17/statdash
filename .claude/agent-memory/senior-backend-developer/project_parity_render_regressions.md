---
name: parity-render-regressions
description: RESOLVED — the two render-parity regressions (kpi-strip querySync-cold crash + observations filter) are fixed on main; incl. the CORRECT observations wire contract
metadata:
  type: project
---

BOTH render-parity regressions are RESOLVED as of the `feat/render-pipeline-parity` build (merged to main `2cdf190`, deployed live 2026-07-02, verified in a real browser + against the live API). Kept because it corrects a common mis-test.

**Why:** the earlier "blocker" description tested the WRONG wire form and mis-attributed a fix. The renderer's ApiStore does NOT send `?approach=_Z` / repeated `?geo=` — it sends a SINGLE `filter=<JSON>` param.

**How to apply / the truths that matter:**

**(A) kpi-strip / dynamics querySync-cold crash — FIXED.** Fix = the "superset point-read" design (`packages/core/src/data/store-api.ts` + `store-api-pointread.ts`, commit d705222). `querySync` for `val`/`valAt` now resolves from an already-cached SUPERSET slice via `resolveCachedPointRead` (matching+summing) instead of cold-throwing; the warm set (`kpi.ts`) is primed as the EXACT superset the sync render reads. Live proof: GDP/accounts dynamics render KPI values with zero pageerrors, no "Failed to load component", no "No data".

**(B) observations filter — WORKS; the earlier test used a non-existent param form.** The route reads ONE `filter=<JSON>` param (scalar → containment `@>`, JSON array → `= ANY` OR-membership), NOT `?approach=`/`?geo=`. Verified live: `filter={"approach":"_Z"}` → only `_Z`; `filter={"geo":["R2","R6"]}` → only R2,R6. `$ne` EXCLUSION is wire-inexpressible → resolved CLIENT-side in `ApiStore.applyClientFilter` (SSOT `matchesFilter`), and folded into the cache key (`cacheKeyFor`) so two slices with different `$ne` don't collide. So a raw `GET .../observations?approach=_Z` returning all approaches is CORRECT (the route never sees that param) — do NOT re-test the query-string form; test the `filter=` JSON form.

**How to verify render parity (updated):** metrics alone still lie — but the server has a faithful render path now: `mcr.microsoft.com/playwright:v1.46.1-jammy` + playwright pkg at `/tmp/pw-lib` (set `NODE_PATH=/pwlib/node_modules`, run `--network host` to reach `127.0.0.1:3002`). A probe that extracts rendered body text asserts the real "as it was" signals (`[object Object]` count, "Failed to load component", "No data", choropleth `svg path[fill]` distinct-color count, negative-sign, GDP/percap tokens). This DOES render the Vite SPA faithfully (svg 22-24, real text) — unlike the zenika/alpine-chrome container in [[live-deploy-mechanism]]. Golden anchors: GDP 2024=93022.3, per-capita 2014=4829.9, real-growth 2020=-6.291, REGIONAL_GVA choropleth spans ~2336..42621 (16 distinct fills), 12 regions, GDP approaches EXP/INC/PROD/_Z. Related: [[canonical-e2e-pipeline]].
