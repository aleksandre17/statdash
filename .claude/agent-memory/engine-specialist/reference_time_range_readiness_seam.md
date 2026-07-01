---
name: time-range-readiness-seam
description: How a year-select {from:options,pick:last} resolves to the real latest year on the live async ApiStore WITHOUT hanging — store-builder folds server time coverage into classifiers[<timeDim>], plus two core defense guards (toObsParams omit-on-unset, autoParse no-value sentinel).
metadata:
  type: reference
---

# Time-range readiness seam (ADR adr_time_range_readiness_seam, A-variant)

Closes the year-select `pick:'last'` blocker on the live `ApiStore` path. The
default-resolution path is FULLY SYNCHRONOUS + classifier-backed: `getOptions` →
`resolveYears({$cl:'time'})` → `store.classifiers['time']`. Make that key populated
at store-build and the existing path resolves the max year; never touches queryAsync.

## The seam (3 wire points)
- **plugins `stats-api.ts` `StatsCubeProfileRow`** — widened with
  `timeCoverage:{min,max,periods[]}` (periods ASCENDING, V26 cube_actual_region SSOT)
  AND `dimensions[].isTime:boolean` (mirrors route ProfileDimension; needed to read
  the time-dim KEY generically — Law 1).
- **plugins `stats-registrations.ts` `registerStoreBuilder('stats')`** — PRIMARY fix.
  After the nonTimeDim classifier fetch: `await fetchCubeProfile(base,code).catch(()=>undefined)`;
  `timeDimKey = profile?.dimensions?.find(d=>d.isTime)?.code ?? TIME_DIM` (NOT hardcoded
  'time'); `classifiers[timeDimKey] = periods.map(code=>({code}))` when non-empty. Both
  `?.` guards on `dimensions`/`timeCoverage` (a `{data:[]}` stub profile = array → no `.find`/`.periods` throw).
  Readiness = the awaited store-construction promise the manifest already awaits → never hangs;
  `.catch` → degraded ⇒ time classifier absent ⇒ all-years render, never 400.
- **core `index.ts`** — added `export { TIME_DIM, atTime } from './core/context'` (was
  NOT in the engine barrel; plugins needs the SSOT fallback without the 'time' literal).

## Two defense-in-depth guards (core, independent — convert 400→all-years)
- **`store-api.ts` `toObsParams`** — module-level `isUnsetTime(timeDim)` helper replaces
  the old `!==undefined && !==''` test; ALSO rejects `0`/`'0'`/`NaN` (numeric string → `Number(s)===0`;
  non-numeric like comma-range `'2015,2020'` or `'2015-Q1'` = real bound, kept). Unset ⇒
  OMIT both from/to (route reads absent bounds as all-periods).
- **`filter-eval.ts` `autoParse` case 'year-select'** — was `Number(raw)||Number(def.default)||0`
  (def.default is the OptionsDefault OBJECT → NaN → `||0` was the bug). Now: `Number.isNaN(n)||raw===''
  ? '' : n`. NOTE `Number('')===0` so the explicit `raw===''` check is load-bearing. `''` sentinel
  → useFilterState ctx builder drops it (`.filter(v=>v!=='')`) → year ABSENT from ctx.dims.

## Tests (FF)
- FF-TIME-RANGE-LOADS — `plugins/datasources/stats-time-range.test.ts` (both branches + failed-fetch).
- FF-NO-ZERO-TIME params — appended to `core/data/__tests__/apiStore.async.test.ts` (via queryAsync URL inspect).
- FF-NO-ZERO-TIME parse + FF-YEAR-DEFAULT-LATEST — `core/config/filter-eval.test.ts`.
- FF-NO-HANG — `react/src/filters/useFilterState.settle.test.tsx` (renderHook + MemoryRouter+FilterProvider;
  empty classifier ⇒ resolveYears `[]` not null ⇒ getOptions `[]` ⇒ no pendingKeys ⇒ isLoading false).

NO config migration: provisioning `years:{type:'inline',items:{$cl:'time'},field:'code'}` unchanged.
Related: [[time-dim-ssot]], [[metric-store-binding]], [[ref-dispatch-ssot]].
