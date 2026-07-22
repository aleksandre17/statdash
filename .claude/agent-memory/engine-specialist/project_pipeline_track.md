---
name: pipeline-track
description: "ADR-046 \"pipeline is the spine\" — consolidated wave record (W-P0→W-P5c, DU4a, DU4c/d). Current shape: query/transform/pivot/timeseries fold live onto the pipeline spine; growth/ratio-list/row-list remain on legacy resolvers pending architect-owned extensions. CONSOLIDATED from 6 sibling files — one map, zero knowledge dropped."
metadata:
  type: project
---

ADR-046 "the pipeline is the spine" (card `work/items/0082`, SPEC `docs/architecture/proposals/SPEC-query-pipeline-data-home.md`, ADR-051). Waves W-P0…W-P6, WIP=1. Owning agent: trim further on next touch (distillate, not log).

## The shipped design
`PipelineSpec = {type:'pipeline', pipe: PipeStep[], encoding}` in the `DataSpec` union. `PipeStep = SourceStep | TransformStep`. `SourceStep` is the ONE store-aware HEAD, discriminated STRUCTURALLY (no flag, by shape) across 4 variants: `{metrics,by?,time?,where?}` (governed/author) · `{query,clamp?}` (steward) · `{rows}` (inline) · `{over,code,coords?,at?,grain?,rollup?}` (value-cell, DU4a). `PipelineResolver` reads the head by DELEGATING to the equivalent legacy resolver, then `applyPipeline` over the pure tail — byte-identical BY CONSTRUCTION (same resolver, no re-impl, no new store port). **Requirements, not rows, are the invariant**: `extractRequirements` shares kernels (`queryRequirements`/`metricRequirements`/`pointSeriesRequirements`) between legacy branches and the `pipeline` case, so a desugared pipeline can't drift from its legacy twin — this is what makes FF-PIPELINE-EQUIV provable store-free.

`desugarToPipeline(spec)` (`data/desugar.ts`) lowers `query`/`transform`/`pivot`/`timeseries` → `pipeline` (SPEC §1.3). **Wired LIVE** (W-P5a) for `query`/`transform`/`pivot`; timeseries folds via DU4a delegation to `PointSeriesResolver`. Stored configs resolve through the ONE spine at read/warm time (expand-contract, never rewritten). `growth`/`ratio-list`/`row-list` stay on their direct legacy resolvers (the DU3 fallback lane) — NOT yet foldable (see Escalations below).

Category seam (`transform/step-registry.ts`): `StepCategory` = 7 verbs `get|filter|aggregate|derive|reshape|combine|sort` (SPEC §1.2); `source` registered `category:'get'`. `FF-VERB-COVERAGE` pins the op inventory (new/removed op fails loud).

## The DU4a lesson (generalizes beyond this program)
**A new `SourceStep` variant must be completed across ALL FIVE traversals**: `readSource` (resolve), `sourceHeadObs` (warm), `extractDeps` (reactive graph), `pipelineRequirements` (warm superset), AND `measureRefs`/`specDataSource` (store ROUTING). DU4a missed the 5th on first pass — `specDataSource` returned no ref for the value-cell head → renderer routed to the default store → a measure homed in a non-default cube read the WRONG store → fabricated 0s (a Law-11 lie), invisible to a single-store test corpus. Fixed with one arm (`if('over' in head) return [head.code]`). Treat this as the checklist for any future store-aware discriminant addition.

## Escalations (architect-owned, do not force)
- **Value-cell fold (RESOLVED by DU4a for timeseries only).** `timeseries`/`growth`/`ratio-list` read via `storeVal`/`storeValAt`, not a pure `{source}+tail` shape — proven empirically non-foldable into the 3 original head variants. DU4a's 4th variant (`over`+`code`) closed this for **timeseries** only (1:1 delegation to PointSeriesResolver). growth/ratio-list/row-list remain open — see below.
- **growth** needs a multi-code calc-metric browse (Addendum 2) — not yet designed.
- **ratio-list (DU4c) / row-list (DU4d) — ASSESSED, DEFERRED, flagged for ADR-046 Addendum 5.** Neither folds into the DU4a variant: ratio-list reads TWO cells per row (numerator + a PER-PAIR denominator, emits `{measure,value}` not `{pct}`); row-list has per-cell HETEROGENEOUS params (`negate`/`pctOf`/`isTotal`/explicit label+color) plus a store-META enrichment read (label/color via LocaleString). Needs a `cells:{...}[]` shape — ratio-list's is `{code,denom,label?}`, row-list's is `{code,label?,color?,negate?,pctOf?,isTotal?}`; whether they share one shape or need two, and whether the cell owns store-meta fallback, is an open architect design question. Improvising it would be an under-designed variant field (Law 10) — not built.
- **Calc-browse foreign-pin lie (W-P5c) — RESOLVED.** A grain-∅ browse of a NATIONAL calc metric on a page pinning a FOREIGN dim (e.g. `geo=adjara`) read `storeValAt(code,{geo:adjara})=0` → `0/prev` folded to **-100** (Law-11 lie). Closed by ADR-047 Wave A — see [[reference_metric_natural_seam]] (naturality is DERIVED from obs, never declared; foreign pins neutralize to `''`). The grain-∅ browse mechanism itself (`browseBaseMetric`/`browseCalcMetric`, no injected default grain, honest null at the first-period edge) is otherwise landed and correct where the metric has real data at the coordinate.

## Current state (what's live vs what's not)
LIVE (default `desugar()` routes through the spine): query, transform, pivot, timeseries. NOT live (still direct legacy resolvers, DU3 fallback lane): growth, ratio-list, row-list. The Constructor-EMISSION default flip + tag-editor demotion (the ⛔ one-way door) fires only once all discriminants fold byte-identical and FF-PIPELINE-EQUIV covers them — not yet.

## Class-M note
`SourceStep` union additions are public `@statdash/engine` contract changes; DU4a's 4th variant was Opus-blessed in ADR-046 Add.4 (architect-authored exact schema) → no re-escalation needed for a byte-identical, additive, optional-field union member — see [[feedback_class_m_hook]].

See [[reference_desugar_seam]], [[reference_measure_ref_seam]], [[reference_transform_dispatch_registry]], [[reference_extractdeps_seam]], [[reference_source_kind_spectrum]], [[reference_cell_honest_state_seam]] (storeCellAt + PointSeriesSpec.noData honest-null, landed alongside DU4a's timeseries fold).
