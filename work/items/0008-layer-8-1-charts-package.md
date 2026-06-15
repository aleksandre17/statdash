---
id: "0008"
title: "8.1: Split @geostat/charts out of @geostat/engine [N1]"
status: done
class: M
priority: P1
owner: —
links:
  - docs/plan/roadmap-phase-7-8.md
---
**Goal** — Chart interpretation is a separate package; a table-only/headless consumer
never bundles chart code. Dependency arrow: `@geostat/react → @geostat/charts → @geostat/engine`.

**Root cause:** `@geostat/engine` (engine/core) contained `chart/types.ts`,
`chart/engine.ts`, `registry/interpreters.ts` and `ChartInterpreter` interface in the
`EngineRegistry` class — so any consumer importing `@geostat/engine` got chart code.

**Changes:**
1. New `platform/engine/charts/` (`@geostat/charts`) — `ChartDef`/`ChartOutput` types,
   `interpretChart`, `ChartRegistry` + `chartRegistry` singleton, 13 built-in
   interpreters, `validateChartDef`.
2. `@geostat/engine`: deleted `chart/*`, `registry/interpreters.ts`, stripped
   `EngineRegistry` to spec-only, removed `setChartRegistry` bootstrap, purged all chart
   exports from `index.ts`.
3. `@geostat/react`: added `@geostat/charts` dep; `index.ts` re-exports `ChartDef`,
   `ChartOutput`, `interpretChart` from charts. `ChartRendererRegistry.ts` updated.
4. Plugin chart files (17): `ChartDef`/`ChartOutput`/`ChartSeries`/`interpretChart`
   imports → `@geostat/charts`.
5. Alias maps: `platform/tsconfig.json`, `apps/geostat/tsconfig.app.json`,
   `apps/panel/tsconfig.json`, `apps/geostat/vite.config.ts`, `apps/panel/vite.config.ts`,
   `engine/react/vitest.config.ts`.

**Registry design:** Two registries split by package (`EngineRegistry` spec-only in core;
`ChartRegistry` in charts) avoids the `engine → charts → engine` cycle a shared
generic registry would create. `setChartRegistry` lazy shim deleted — no longer needed.

**DoD**
- [x] `@geostat/charts` builds independently; `@geostat/engine` has zero chart code.
- [x] All chart types work (interpreters moved verbatim; registration unchanged).
- [x] `npx tsc --noEmit` EXIT=0.

**Commit:** 292bc72
