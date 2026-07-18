---
name: pipeline-wp0
description: ADR-046 pipeline-as-spine W-P0 LANDED — FF-PIPELINE-EQUIV (requirements baseline) + FF-VERB-COVERAGE + category seam + 3 pending gates + b544819 folded fix
metadata:
  type: project
---

ADR-046 "the pipeline is the spine" (card `work/items/0082`, SPEC
`docs/architecture/proposals/SPEC-query-pipeline-data-home.md`). Waves W-P0…W-P6,
WIP=1. **W-P0 LANDED 2026-07-18** (commit on main): register gates + capture the
equivalence baseline. NO `pipeline` discriminant, NO `source` op, NO UI, NO engine
behaviour change (only a pure additive type-level `category?` seam).

**FF-PIPELINE-EQUIV baseline — the design choice that matters for W-P4.** Test
`platform/apps/api/src/provisioning/pipeline-equiv.fitness.test.ts`; committed
artifact `platform/apps/api/provisioning/pipeline-equiv.baseline.json`. The baseline
captures **`extractRequirements()` — the pure, store-free {code,dims} read
contract** — for every corpus DataSpec (18 `query`, collected at the `data`
residence key), under TWO fixed canonical contexts (year `time:2020`, range
`time:0`). **Requirements, NOT rows, are the invariant**: a `pipeline` whose
`source` head reads the same measures at the same grain MUST extract the identical
set (the pipe/tail issues no store read), so it's provable with no DB / no float /
no ordering nondeterminism. W-P4 desugars legacy→pipeline and re-runs this harness;
byte-identical result gates the ⛔ W-P5 default-emission flip. Store-agnostic:
catalogs primed from the artifact's own `siteConfig` (`metrics`/`dimensions`) via
`registerManifestMetrics`/`registerManifestDimensions` (the real boot seam) so
metric-ids expand to DSD codes faithfully. Deterministic (canonical key+array sort;
regen `UPDATE_BASELINE=1` → empty diff). Rows-level parity is deferred to W-P4's
shadow. See [[reference_measure_ref_seam]], [[desugar-seam]].

**Category seam (pure additive, `packages/core/src/data/transform/step-registry.ts`).**
`StepCategory` = the 7 verbs `get|filter|aggregate|derive|reshape|combine|sort`
(SPEC §1.2). `registerTransformStep(op,fn,schema?,category?)` + `_categories` map +
`getTransformStepCategory(op)` + `listUncategorizedOps()`. INERT today (no built-in
declares one → every category `undefined`, dispatch byte-identical). Exported from
core barrel. W-P3 assigns categories. `FF-VERB-COVERAGE`
(`.../transform/verb-coverage.fitness.test.ts`) TODAY pins the 19-op inventory
(new/removed op fails loud → make the SPEC §1.2 category call); flips to
total-coverage at W-P3 (the `it.todo` names it). Registry = [[transform-dispatch-registry]].

**Pending gates (suite-visible `it.todo`, never silent):** `FF-JOURNEY-PIPE`
(`apps/panel/src/features/data-layer/pipeline-journey.fitness.test.ts`) ·
`FF-DQ-DECLARED` (`apps/api/src/provisioning/dq-declared.fitness.test.ts`) ·
`FF-PROMOTE-ROUNDTRIP` (`packages/core/src/data/promote-roundtrip.fitness.test.ts`).

**Folded fix (b544819 class) — `config-cube-contract.fitness.test.ts`.** The engine
resolves a spec's TOP-LEVEL `measure` (resolveMeasureRef) but treats every
`filter.<dim>` value as a LITERAL (`matchesFilter`/store-filter.ts never resolves
filters). CHECK-2 used to resolve EVERY filter.measure through the catalog — the
generosity that let b544819 through green. Now: a new `literalDims` provenance set
marks pins that came from an explicit `filter:{}` block (vs the folded top-level
measure); CHECK-2 resolves ONLY the folded measure; new **CHECK-4** fails any
explicit filter literal that is a governed metric-id. Falsified: clean on corpus,
18 violations when a metric-id is injected as filter.measure. Engine
filter-resolution NOT extended — deferred to W-P4. Root cause detail lives in the
debugger's metric-id-filter-selfmatch note.

**Gate:** `tsc -b` EXIT 0 · full vitest 3694 pass / 81 skip / 15 todo / 0 fail ·
lint clean on 8 changed files. packages/core touched → engine dist rebuilt (apps/api
uses none of the new exports). Note: the current working branch pushes to origin/main.
