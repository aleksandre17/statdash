---
name: time-seam
description: The time-axis seam family — TIME_DIM/atTime SSOT primitive, the timeDimension config feature (ADR R5), and the async-store readiness fix that makes year-select {pick:last} resolve without hanging. CONSOLIDATED from 3 sibling files.
metadata:
  type: reference
---

## 1. TIME_DIM / atTime — the SSOT primitive
`packages/core/src/core/context.ts` exports `TIME_DIM = 'time'` and `atTime(t, ctx)` — the single named home for the conventional SDMX TIME_PERIOD dim key. NOT a privileged dimension — the one named SSOT replacing scattered magic `'time'` literals (the engine still treats all dims generically: `ctx.dims[TIME_DIM]`).

Consumers that MUST keep using these (no local `'time'` literal, no private `atTime` copy): `registry/resolvers.ts`, `data/kpi.ts`, `data/spec.ts` (extractRequirements), `data/store-api.ts` (from/to bounds + filter skip), `data/fieldSchema.ts`. When adding a time-axis resolver, import `{atTime, TIME_DIM}` from `../core/context`. A grep for `['time']` in non-test core should only hit comments/config-string examples (`$ctx:'time'` is user config data, not a hardcode).

## 2. timeDimension — first-class time concept [ADR R5]
`TimeDimensionSpec {dim; range?: YearsSpec | [TimeBound,TimeBound]; granularity?}` added ADDITIVELY (optional) to query/timeseries/growth in `config/data-spec.ts` (Cube.dev `timeDimensions` parity). `dim` is the GENERIC time key, set to `TIME_DIM`, never hardcoded `'time'`.

SSOT: `core/time-dimension.ts` — `resolveTimeDimension`/`effectiveBounds`/`effectiveYears`/`clampYears`/`clampToBounds`. Folds `timeDimension` into the legacy-shaped `(years, from, to)` inputs the resolvers already consumed → ONE resolution path (lives in its own module — resolvers.ts is capped at 400 lines by the bloat hook).

Fold verdict: `fromDim`/`toDim` FOLDED byte-identically via `range:[{$ctx:'from'},{$ctx:'to'}]` (legacy fields kept + win on overlap, Postel). `YearsSpec` (`years`) KEPT + coexists, stays REQUIRED on timeseries/growth (`effectiveYears`: legacy `years` wins; `timeDimension.range` supplies years only when `years` absent). Disambiguation: 2-literal tuple `[2022,2023]` = YearsSpec; `[from,to]` clamp form reserved for ctx-ref bounds (`isYearsSpec` = all-numbers ⇒ YearsSpec). `granularity` = carried-but-inert metadata (LOD door, threaded by GRAIN-G4 — see [[reference_grain_store_port]]).

## 3. Async-store time-range readiness (the bug-fix seam)
Closes the year-select `pick:'last'` blocker on the live `ApiStore` path. The default-resolution path is FULLY SYNCHRONOUS + classifier-backed: `getOptions` → `resolveYears({$cl:'time'})` → `store.classifiers['time']`. Fix = populate that key at store-build time so the existing sync path resolves the max year without ever touching queryAsync.

**3 wire points:** plugins `stats-api.ts` `StatsCubeProfileRow` widened with `timeCoverage:{min,max,periods[]}` + `dimensions[].isTime:boolean` (reads the time-dim KEY generically, Law 1) · plugins `stats-registrations.ts` `registerStoreBuilder('stats')` (PRIMARY fix — after the nonTimeDim classifier fetch, awaits `fetchCubeProfile`, sets `classifiers[timeDimKey] = periods`; `.catch` degrades to time-classifier-absent ⇒ all-years render, never a 400 or a hang) · core `index.ts` exports `TIME_DIM, atTime` (was missing from the barrel).

**Two defense-in-depth guards (core, independent — convert a would-be 400 to all-years):**
- `store-api.ts toObsParams` — `isUnsetTime(timeDim)` also rejects `0`/`'0'`/`NaN` (a numeric-string coord like `'2015,2020'` or `'2015-Q1'` is a real bound, kept). Unset ⇒ omit both from/to.
- `filter-eval.ts autoParse` case `'year-select'` — was `Number(raw)||Number(def.default)||0` (def.default is an OBJECT → NaN → `||0` was the bug). Now `Number.isNaN(n)||raw===''?'':n`. `Number('')===0`, so the explicit `raw===''` check is load-bearing; `''` sentinel drops the year from ctx.dims entirely.

Related: [[metric-store-binding]], [[ref-dispatch-ssot]], [[reference_grain_store_port]].
