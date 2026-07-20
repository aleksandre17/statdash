---
name: pipeline-du4a
description: DU4a LANDED — 4th SourceStep value-cell variant (over/code) + timeseries fold onto the spine; unblocks the [[project_pipeline_wp5a]] BLOCK
metadata:
  type: project
---

# DU4a — the value-cell `source` variant (ADR-046 Addendum 4 / ADR-051 DU4a)

LANDED (2026-07-20), revert-clean, live switch NOT flipped. Closes the `desugar.ts:180-190` escalation from [[project_pipeline_wp5a]] (the value-cell source variant that was BLOCKED/escalated).

**What.** A 4th `SourceStep` union member = the internal `PointSeriesSpec` hoisted to a `source` head, discriminated STRUCTURALLY by a bare `over` (+`code`) field (no privileged flag): `{op:'source'; over; code; coords?; at?; grain?; rollup?; clamp?}`. Resolves by DELEGATION — `readSource` reconstitutes `{type:'point-series', ...stripOp(head)}` and calls the already-proven `PointSeriesResolver`. NO new read path, NO new store port. A source *variant*, not a fifth grammar (Law 10).

**Files (7).** `config/data-spec.ts` (union member), `registry/pipeline-resolver.ts` (readSource `'over' in head` arm + sourceHeadObs `{measure:code}`), `data/desugar.ts` (desugarToPipeline timeseries arm — reuses `desugarTimeseries` verbatim, hoists its point-series to the head), `graph/extractDeps.ts` (pipeline `else if 'over' in head` → over/at→dims, clamp→addTimeBinding, ambient), `data/spec.ts` (NOT in the brief — I added it: extracted `pointSeriesRequirements` shared kernel, reused by both the `point-series` case AND a new `pipelineRequirements` `'over'` arm; without it a value-cell pipeline head warmed `[]` = latent FF-NO-EMPTY-REQS defect), + the two fitness tests.

**Byte-identity.** timeseries fold is byte-identical BY CONSTRUCTION: both `legacyDirect(timeseries)` (TimeseriesResolver→desugar→point-series) and `interpretSpec(desugarToPipeline(timeseries))` (value-cell head→readSource→reconstituted point-series) funnel to the SAME PointSeriesResolver on equivalent params. The NEW code proven is the desugarToPipeline hoist + readSource strip/unstrip round-trip.

**Fitness.** `FF-PIPELINE-EQUIV` value-cell corpus (pipeline-desugar.fitness.test.ts) — rows via `legacyDirect` two-path oracle + a requirements-parity assertion (`extractRequirements(pipeline)==extractRequirements(timeseries)`). `FF-ALL-KINDS-SHAPED` (panel coverage.fitness.test.ts, NEW block) — `VALUE_CELL_KINDS=[timeseries,growth,ratio-list,row-list]`, `NOT_YET_FOLDED` allowlist = the shrinking gap; timeseries now folds, growth/ratio-list/row-list stay allowlisted.

**Live switch UNCHANGED.** `desugar()` still routes `case 'timeseries': return desugarTimeseries(spec)` (point-series). Only `desugarToPipeline` (proof/workbench-view SSOT) shapes timeseries→pipeline. The emission flip is the later gated one-way door (gated on FF-PIPELINE-EQUIV green).

**Remaining for activation (DU4b–d, NOT DU4a).** growth (source + window/derive tail, or calc-metric browse for multi-code), ratio-list/row-list (MEASURE-axis explicit-cells form of the variant). Then the emission-flip flips the live `desugar()` switch and the DU3 fallback lane can retire.

**Cross-store routing gap (fixed 2026-07-20).** DU4a completed the value-cell head across readSource / sourceHeadObs / extractDeps / spec.ts requirements — but MISSED `measureRefs` (metric-store.ts). So `specDataSource(foldedValueCellPipeline)` surfaced NO ref → undefined → the renderer routed to the FIRST/default store. A measure homed in a non-default cube (gdp metric on a regional-first floor) then read the wrong store → fabricated 0s (Law-11 lie, FF-PIPELINE-EQUIV missed it: single-store corpus, no routing dimension). Fix = one arm: `if ('over' in head) return [head.code]` — byte-identical to the legacy `[spec.code]` routing. **LESSON: a new SourceStep variant must be completed across ALL FIVE traversals — readSource, sourceHeadObs, extractDeps, pipelineRequirements, AND measureRefs/specDataSource.** Also landed the honest-null seam (see [[reference_cell_honest_state_seam]] `storeCellAt` + `PointSeriesSpec.noData`): timeseries fold reads null for a genuinely-absent year, growth fold stays 0 (GrowthResolver parity). Extended pipeline-desugar.fitness with a two-store routing proof + FF-CANVAS-NEVER-LIES absent≠0.

**Class-M note.** SourceStep union addition = public `@statdash/engine` contract; Opus-blessed in ADR-046 Add.4 (exact schema authored by architect) → no re-escalation per [[feedback_class_m_hook]]. Degradation risk: additive optional-field union member, byte-identical fall-through, no signature change to any existing arm.
