---
name: panel-pipeline-live-grid
description: W-P1 live per-step data grid (pipeline program 0082/ADR-046) — the prefix-run projection over the ONE engine seam, its live-source hook, mount point, and the fail-soft/export gotchas
metadata:
  type: project
---

The Constructor's **live per-step data grid** (owner's "see the raw data while building").
Feature: `apps/panel/src/features/data-layer/pipeline-preview/`. Landed W-P1 (commit `43431ce`)
over TODAY's `query.pipe` model — NO new `pipeline` discriminant, NO `source` op (those are W-P4).

## The architecture (reuse this for any per-step/data-preview surface)

- **Projection = the ONE engine seam (FF-ONE-DERIVATION-PATH, SPEC §9 E5).** `pipelinePreview.ts`
  `deriveStepRows(sourceRows, pipe, asOfStep)` = `applyPipeline(source, pipe.slice(0, asOfStep+1))`
  — the EXACT composition the `QueryResolver` uses (`storeObs(queryReadObs(query))` → post-fetch
  `effectiveBounds` clamp → `applyPipeline`). A full-pipe prefix is byte-identical to the bound
  element's rows. **Never a module-level preview cache** — the source read is resolved ONCE
  (`usePipelineSourceRows`); selecting a step is a PURE in-render re-slice, no re-fetch.
- **The live source read** (`usePipelineSourceRows`): `useLivePreviewStores('live')` → the built
  stats store is a CachedStore over ApiStore (`caps.sync === false`, async). MUST warm via
  `store.queryAsync(queryReadObs(query), ctx)` BEFORE the sync `storeObs` read, else cold → []. Warm
  is debounced (300ms) + cancel-on-supersede (a per-effect closure flag, NOT a ref read in cleanup —
  that trips the ref-cleanup lint warning), keyed on `JSON.stringify(queryReadObs(query))` ⊕ the
  store instance. A minimal `SectionContext { dims:{}, locale }` issues the unbounded browse read (E1).
- **Governed headers** (`columnLabels.ts` `buildColumnLabels`): field → governed metric/dimension
  label off `useMetricCatalog`/`describeApp` (`governedDimensionLabels` for dim codes; the bound
  metric's label for `value`/`measure`). Never raw codes (Law 4 / FF-AUTHOR-NO-QUERY).
- **Honest states** (`toGridCell`): genuine 0 → "0" (`ok`), null/undefined/'' → "—" (`no-data`) —
  never a fake 0 (Law 11). Grid-level `PreviewStatus`: `unbound|loading|error|unavailable|ok`, each a
  declared affordance; loading is DISTINCT from empty (async trap #10).
- **`PipelineDataGrid`** is a PURE view-model component (store-free, hook-free) → W-P2 re-homes it
  into the three-pane shell verbatim. Container `PipelineStepGrid` wires hook+catalog+derivation.

## Mount point + how to reach it live

The grid renders ONLY inside `QuerySpecEditor` (the `query` discriminant), mounted beside
`PipelineBuilder` (step selection = `selectedStep`/`onSelectStep` on the builder + a `pipe-source-chip`
for AS_OF_SOURCE=-1). Reached in the running studio: select a data element → inspector **DATA facet**
(`data-facet-field`) → expand the **`data-facet-pipe`** accordion → lazy `DataSpecEditor`. A metric
bind via the facet's MetricPalette (`bindMeasureToSpec`) turns ANY element's `data` into a `query`
spec — the reliable way to get a live grid on an element that started as `metric`/`timeseries`.
Probe: `platform/e2e/probes/probe-wp1-pipeline-grid.mjs`.

## Gotchas (bit me / apply to any new authoring slice)

- **A default `derive` step THROWS** `"derive: missing 'as' (or legacy 'name') field"` in
  `applyDerive` — a half-authored step crashes the render. The grid MUST fail-soft (try/catch the
  prefix-run → honest `error` state); the SAME throw hits `NodeErrorBoundary` on the live canvas.
- **`MEASURE_DIM` is NOT re-exported from the `@statdash/engine` barrel** (only `TIME_DIM` is). Inline
  the `'measure'` convention key. Exported and used here: `queryReadObs`, `storeObs`, `effectiveBounds`,
  `staticStore`, `applyPipeline`, `PipelineContext`, `EngineRow`, `StoreQuery`, `resolvePipeRefs`.
- **React Compiler**: a `useMemo` returning a CLOSURE trips "could not preserve memoization" (hard lint
  error). Use plain consts — the compiler memoizes them. See [[constructor-state]] standing gotchas.
- **`queryReadObs(query)`** is the SSOT resolver (metric-id expansion + default-dim merge); feed its
  `{measure,filter,orderBy}` to `storeObs` — reading the raw `spec.query.measure` misses metric-ids.
