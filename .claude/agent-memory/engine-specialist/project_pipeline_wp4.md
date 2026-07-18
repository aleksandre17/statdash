---
name: pipeline-wp4
description: ADR-046 pipeline-as-spine W-P4 LANDED — pipeline discriminant + source head op + desugarToPipeline (shadow-only) + FF-PIPELINE-EQUIV live shadow; live desugar UNCHANGED
metadata:
  type: project
---

ADR-046 "the pipeline is the spine" (card `work/items/0082`, SPEC
`docs/architecture/proposals/SPEC-query-pipeline-data-home.md`). **W-P4 LANDED 2026-07-18**
(the ENGINE wave, `packages/{core}` + apps glue). Builds on [[pipeline-wp0]] (baseline +
category seam) and W-P1/2/3 (panel workbench, built over `query.pipe`).

**The `pipeline` discriminant + `source` head — the design that shipped.**
- `PipelineSpec = { type:'pipeline', pipe: PipeStep[], encoding }` added to the `DataSpec`
  union (`config/data-spec.ts`) + `DATASPEC_DISCRIMINANTS` + the Exact exhaustiveness assert.
- `SourceStep` (`PipeStep = SourceStep | TransformStep`) — the ONE store-aware HEAD, 3 variants
  discriminated STRUCTURALLY (no flag): `{op:'source', metrics, by?, time?, where?}` (governed /
  author), `{op:'source', query, clamp?}` (steward), `{op:'source', rows}` (inline). Deliberately
  NOT a `TransformStep` union member (a source in the pure tail is a misuse) — avoids a config↔
  data type cycle too.
- `source` registered in the runtime step-registry (`transform/index.ts`) with `category:'get'` +
  `sourceSchema` + an IDENTITY handler (blend precedent — its REAL read is out-of-pipe). This makes
  `getOpsInCategory('get')===['source']` → the palette Get card projection is live. `CATEGORY_PIN`
  in FF-VERB-COVERAGE gained `source:'get'`; `grouped.get` flipped `[]`→`['source']`.
- `PipelineResolver` (`registry/pipeline-resolver.ts`, registered in resolvers.ts): reads the
  `source` HEAD by DELEGATING to the equivalent legacy resolver (governed→`metric` resolver,
  steward→`query` resolver, inline→rows as-is) then `applyPipeline` over the pure tail. Byte-
  identical to the legacy read BY CONSTRUCTION (same resolver, no re-impl). No new store port / no
  new evaluator. NOTE: build the delegated MetricSpec via rest-spread `{op:_op, ...grain}` — a bare
  `time:` key trips FF-NO-PRIVILEGED-LITERAL (registry-scoped). Same trick in `spec.ts`
  pipelineRequirements.

**The BIG decision — live desugar is UNCHANGED (shadow-only lowering).** `desugarToPipeline(spec)`
(exported from `data/desugar.ts`) lowers `query`→ and `transform`→`pipeline` (SPEC §1.3 table), but
is NOT wired into the live `desugar()` used by interpretSpec. Live query/transform resolution is
untouched → FF-DESUGAR-EQUIV keeps them identity primitives, byte-identity holds, the wave is fully
revert-clean. Rationale (decisive): the FF-PIPELINE-EQUIV shadow resolves each corpus spec BOTH
ways (legacy vs `desugarToPipeline`) — that "both ways" ONLY makes sense if the legacy path still
exists separately; a live query→pipeline switch would collapse them. The ⛔ W-P5 flip is the
CONSTRUCTOR EMISSION default + tag-editor demotion, NOT the read-time desugar. Convenience specs
(timeseries/growth/ratio-list/pivot) re-target in W-P5.

**Equivalence proven BY CONSTRUCTION.** `extractRequirements` refactored: `queryRequirements` +
`metricRequirements` kernels shared by the legacy branches AND the new `case 'pipeline'`
(`pipelineRequirements` dispatches on the source-head variant to the SAME kernel). So the desugared
pipeline extracts an identical {code,dims} contract — FF-PIPELINE-EQUIV can't drift. Shadow test
(`apps/api/.../pipeline-equiv.fitness.test.ts`) upgraded 2→11 tests: both-ways corpus equivalence +
7 synthetic per-discriminant fixtures (query year/range/pin/tail/clamp + transform). Row-parity net:
`packages/core/src/data/pipeline-desugar.fitness.test.ts` (8 tests) proves interpretSpec(pipeline)
row-equals the legacy resolvers on a real ExternalStore + governed-source ≡ metric spec.

**Reactive graph kept sighted.** `measureRefs` (metric-store.ts) + `scanSpec` (extractDeps.ts)
gained `case 'pipeline'` dispatching on the source head (governed=metric edges, steward=obs/clamp
edges, inline=read-free) + tail transforms + encoding. specDimKey is generic (uses
extractRequirements) → works free.

**Barrel:** `MEASURE_DIM` now exported (W-P1 pre-note #4; de-inlined in panel columnLabels.ts +
PipelineStepGrid AUTHOR_HIDDEN_FIELDS). Also exported: `PipelineSpec`/`SourceStep`/`PipeStep`/
`MetricSpec`/`MetricRef`/`desugarToPipeline`.

**Get-card UX fork (flagged, NOT forced) — a W-P5 decision.** The W-P3 pre-note predicted "Get flips
to insertable (zero panel change)"; the W-P3 realized+tested design says Get is DISABLED ("the source
is already the first step"). Correct for the query-shaped workbench (must not add a 2nd source to its
tail). I kept Get NON-insertable-as-tail (`verbProjection.ts`: `isHead = category===STEP_CATEGORIES[0]`)
while the engine projection is live. Whether a FRESH workbench turns Get into "add source / pick
metric" REQUIRES converting the workbench from query-shaped (`query.pipe`, TransformStep[]) to
pipeline-shaped — that pairs with W-P5's emission flip + tag-editor demotion, NOT this engine wave.
DataWorkbench/PipelineStepGrid/GeneratedQueryPane/PipelineBuilder are all `type==='query'`-narrowed.

**Gate:** tsc -b EXIT 0 · full vitest (numbers in card log W-P4) · lint clean on changed · engine
dist rebuilt (apps/api consumes dist). See [[reference_desugar_seam]], [[reference_measure_ref_seam]],
[[reference_transform_dispatch_registry]], [[reference_extractdeps_seam]].
