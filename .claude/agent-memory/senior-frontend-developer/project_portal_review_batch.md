---
name: portal-review-batch
description: geostat portal stakeholder-review fixes — chart formatter/axis/tooltip seams + item-11 regional data-gap diagnosis + item-7 dataZoom gap
metadata:
  type: project
---

Batch `fix/portal-review-notes-2026-07-10` (13 reviewer items). Notable non-obvious findings:

**Axis number format (item 10):** the shared axis formatter is `plugins/.../utils/apex/base.ts` `yFormatter`. It NOW uses `fmtNum(val,0)` (full space-grouped "80 000"), REVERSING a prior documented decision to use `compact()` ("80K"). Reviewer explicitly wanted full numbers. `fmtNum` (core `data/transform/formatters.ts`) groups with U+00A0.

**Negative axis floor (item 9):** `niceFloor()` in base.ts (mirror of existing `niceCeil`) + `context.ts` computes `yMinFloor` from the data's negative extent (stacked→cumulative negative sum) when no authored min. Root cause of the "-50K floor for ≈-20K data" was Apex auto-scale, NOT a config min (no `"min"` in provisioning).

**Single-series tooltip (item 8c):** `cartesian/chrome.ts` buildTooltip suppresses the series-name row (`y.title.formatter: ()=>''`) when ≤1 non-spacer series — redundant with the chart title.

**Item 11 (regional GDP data gap) — DIAGNOSIS, config/frontend NOT ingest:** `ops/seed-data/geostat/facts/REGIONAL_GVA.bundle.json` is COMPLETE 2010–2024 (1485 obs, 11 geos × 9 sectors × 15 yrs, smooth). Chart starting ~2015 + near-zero 2015 bar is produced by the regional `sectors-range`/timeseries query windowing (`fromDim:fromYear/toDim:toYear` on `regional.gva`, provisioning ~L4340–4373) + range-filter default. Extra finding: `time` codelist includes **2025** but REGIONAL_GVA has no 2025 → `toYear` default `pick:last`=2025 yields an empty final regional year. Needs engine-side interpretSpec trace of fromDim/toDim boundary handling. (Related: `perspective-render-validation.test.tsx` regional/ka+en fail PRE-EXISTING on this same no-regional-data path.)

**Item 7 (dataZoom range slider) — DONE, then LIVE-FIXED.** `ChartDef.rangeSlider?:boolean`
realized as an Apex BRUSH companion (`apex/cartesian/brush.ts`: `shouldRenderSlider` gate =
vertical cartesian + ≥8 cats; a slim area chart linked via `chart.brush.target`). Authorable via
`ChartNode` ChartSchema (STYLE). Known a11y gap: Apex brush is mouse-only; keyboard users reach
data via the chart↔table toggle + export.

**Item 7 LIVE REGRESSION (options-green, live-crash — fixed).** All three brush charts were BLANK
cards live; jsdom fitness stayed green (apex-can't-run-in-jsdom blindspot). TWO apexcharts@3.54.1
defects, both disarmed as a module side-effect in `brush.ts` (reusable pattern for any
apex-UMD-assumption bug):
1. `ReferenceError: ApexCharts is not defined` — `setupBrushHandler` resolves `brush.target` via
   the BARE UMD global `ApexCharts.getChartByID`; no such global in a Vite ESM bundle. Fix:
   publish the imported class to `window.ApexCharts` (the same module instance react-apexcharts
   uses → a shared registry).
2. `RangeError: Maximum call stack size exceeded` on EVERY chart mounted after an id-carrying
   chart — `render()` registers id-charts into `window.Apex._chartInstances`, and Config
   deep-merges `window.Apex` into every later chart's config, whose `Utils.clone` walks the live
   instance's CYCLIC `ctx`. Fix: pre-create `_chartInstances` NON-ENUMERABLE on `window.Apex`
   (push/getChartByID still work; Object.keys/assign-based merge+clone can't see it). Strategic
   fix = an apexcharts upgrade (registry off window.Apex) — blocked offline.
3. Domain: apex brush officially supports numeric/datetime only; category rides apex's own
   cat→numeric conversion (ONE-based, `x=1..n`) — selection full-range must be `{min:1,max:n}`
   (0-based is off-domain both ends).
Debug technique that found #2: route-intercept the served chunk, patch `Utils.clone` to record the
key path, dump on depth>300. Verified against the real prod bundle (vite build+preview,
Playwright, /api forwarded to dev API). Guard: `apps/geostat/e2e/rangeSliderBrush.e2e.ts` with
fixtures-replayed /api.
