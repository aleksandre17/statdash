---
name: panel-pipeline-emission-flip-wp5b
description: W-P5b (0082/ADR-046) — the workbench→pipeline spine conversion + the ⛔ emission flip, and the OPEN Get-grain crack that blocked the demotion + the growthYoy value closure
metadata:
  type: project
---

# W-P5b — the workbench speaks the spine + the ⛔ emission flip (commit `df2ea04`, on main)

The Constructor's default data emission flipped to the ONE `pipeline` spine (ADR-046).
Landed the reversible half; the tag-editor DEMOTION did NOT land (gated — see the crack).

## What is canonical now (reuse these seams)

- **`workbench/workbenchModel.ts` is the ONE code path.** `toWorkbenchModel(spec)` lowers
  BOTH a legacy `query` (via the engine SSOT `desugarToPipeline` → a steward `source(query)`
  head + tail) AND a native `pipeline` to `{head: SourceStep, tail: TransformStep[], encoding}`.
  `fromWorkbenchModel` → a `pipeline` DataSpec (every write emits the spine). Helpers:
  `sourceMeasure(head)` (governed `metrics` OR steward `query.measure`), `sourceGrainDims(head)`,
  `isHeadBound`, `withGovernedMetric`, `sourceOnlySpec(head, encoding)`.
- **The emission flip = `inspector/controls/dataFacetModel.bindMeasureToSpec`** → a GOVERNED
  head `{op:'source', metrics:[id]}` (append-on-rebind, multi-series). The workbench Get head
  (a `MetricPalette` in the rail) writes via `withGovernedMetric`. EXCLUDED (W-P5a value-cell
  finding): timeseries/growth/ratio-list DataSpec emission is untouched.
- **The live grid resolves ANY head through the ENGINE** (`usePipelineSourceRows` generalized):
  `interpretSpec` on a source-only pipeline + warm via `extractRequirements` (val+obs) — the ONE
  derivation path (governed→metric resolver, steward→query resolver). `PipelineStepGrid`/
  `GeneratedQueryPane`/`generatedQuery.ts` take the `WorkbenchModel` (head+tail); `columnLabels`
  takes a `measure` ref (not an ObsQuery) — spine-agnostic.
- **FF-JOURNEY-PIPE is EXECUTABLE** now (`pipeline-journey.fitness.test.tsx` — note `.tsx`, it
  has JSX): renders the REAL grid over an `ExternalStore` (browse rows → filter removes a row →
  governed query pane). The gate for the demotion.

## ⛔ The OPEN crack (why the demotion did NOT land — architect-owned)

A governed `{op:'source', metrics:[…]}` head at **grain-∅** does NOT give a browse grid:
- a BASE metric → a grain-∅ SCALAR (1 row, value `0` — no coordinate pinned), NOT the rich
  200-row browse W-P1/2/3 got (those used the `query`/storeObs raw-OBSERVATION browse);
- a CALC metric (`gdp.growthYoy`) → **0 rows** (a YoY is undefined without a time grain).
So the mission's two live wants — the E1 browse grid (= the metric's OBSERVATIONS) AND a real
growth VALUE — can't BOTH be met by the grain-less governed head. The Get head has no GRAIN axis
(the `SourceStep` governed variant already has `by`/`time`/`where` — only the picker is missing).
This is the **W-P5a value-cell finding at the emission boundary**. Escalated; recommended fix =
a **Get-grain picker** (default `time:{dim:TIME_DIM}` when unset). Verified my hook is NOT the
bug (base metrics resolve through it live). Live proof (partial-green) + probe:
`work/authoring-truth/wp5b/`, `platform/e2e/probes/probe-wp5b-journey.mjs`.

Related: [[panel-data-workbench-wp2]] (the three-pane shell) · [[panel-pipeline-live-grid]]
(W-P1 grid) · [[dev-line-panel-3013]] (the :3013 deploy recipe).
