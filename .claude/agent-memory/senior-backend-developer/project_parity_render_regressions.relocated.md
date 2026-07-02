---
name: parity-render-regressions
description: Two app-layer regressions on the API arch (geostat front) that block old-vs-new render parity — kpi-strip querySync-cold crash + observations filter not applied
metadata:
  type: project
---

The geostat front on the API arch (single-origin, ApiStore-backed) has two regressions that BLOCK old-vs-new render parity. Observed 2026-06-26 deploying parity fix `69cdef8` to live demo (:3002 new vs :5171 old static reference). `69cdef8` (ACL boundary fix) did NOT resolve either.

**(A) kpi-strip / dynamics render-path crash — sync read on async-only store.**
Console: `ApiStore.querySync called cold (cache miss). This store has caps.sync=false — use queryAsync. cacheKey={dataset:GDP_ANNUAL,from:2010,to:2010,filter:{approach:_Z}}` → `[renderNode] shell crashed {type: kpi-strip}`. Visual: GDP/Accounts dynamics mode shows a red "Failed to load component" box where the KPI strip is, and the dynamics charts render "No data". The renderer calls the SYNC query path against a store whose `caps.sync=false`; on a cold cache it throws instead of awaiting. Fix = route kpi-strip + dynamics through `queryAsync` (prime cache before sync read, or make the shell await). Data is NOT the problem — the rows exist.

**(B) /api/stats/observations ignores `approach=` and repeated `geo=` filters.**
`?dataset=GDP_ANNUAL&approach=_Z` returns rows still keyed approach=PROD/INC (filter not applied). `?dataset=REGIONAL_GVA&geo=R2&geo=R6` returns 1000 rows across ALL geos (R2..R12,_T), not the R2+R6 OR subset — i.e. the multi-region OR query does NOT work; it returns the unfiltered, 1000-row-capped set. The `_Z` aggregate data DOES exist in the cube (distinct GDP approach set = EXP/INC/PROD/_Z), so this is a query-builder defect in the observations route, not missing data.

**How to apply:** when verifying render parity, do NOT trust svg-count/obsTotal metrics alone — visually confirm both modes (current + "დინამიკა" dynamics). A green-ish svg count can coexist with a crashed kpi-strip and No-data dynamics panels. The probe `/tmp/compare-probe.js` (geostat-deploy) captures both modes; run via mcr.microsoft.com/playwright:v1.46.1-jammy with NODE_PATH=/pwlib (playwright npm pkg installed at /tmp/pw-lib, browsers in image). Related: [[canonical-e2e-pipeline]], [[seed-dsd-divergence]].
