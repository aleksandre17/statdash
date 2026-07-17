---
id: "0082"
title: "QUERY AS A VISIBLE PIPELINE + THE RAW-DATA HOME — simple at full power, once and for all"
status: GO (owner-blessed 2026-07-17 verbatim «ნდობას გიცხადებ, გააკეთე»; ADR-046 ACCEPTED; SPEC final incl. lead's §9 elevation; waves W-P0…W-P6 fire serially per WIP=1 — first build wave starts when the integrity cluster (data-truth) lands)
class: M
priority: P0
owner: lead → platform-architect (design) → build agents (waves)
implements: owner 2026-07-17 (verbatim, condensed): «query და pipeline მაქსიმალურად მარტივად და სრული ძალით, დატა-ელემენტებზე · ნედლი დატა ერთხელ და სამუდამოდ გამიჯნე, თავის კანონიკურ ადგილას · დღევანდელი query-აწყობა გაუგებარია (ტეგები, ერთად გამოტანილი) · აწყობისას ნედლი დატა ჩანდეს · და ჩანდეს რა query გამოდის» — Canon C1 continuation
depends_on: ["0072"]
links:
  - docs/architecture/proposals/CAPABILITY-INJECTION-BACKLOG.md   # rec #1 (DQ-on-ingest) folds INTO this data-home concept
  - platform/apps/panel/src/features/data-layer/                  # today's query editors (the confusion to be replaced)
---
**Intent.** The author must build a query as a VISIBLE, STEPPED PIPELINE — seeing the raw data flow through every step and the resulting declarative query alongside — while raw data itself gets ONE canonical home, separated from the semantic model and specs forever. Full power, simple perception, whole standards.

**Reference anchors (Law 4 — adopt whole):** Power Query's step-pipeline with a live grid per step · Grafana's builder↔code duality (the generated query always visible) · Vega-Lite / Tidy-Data transform grammar (declarative verbs: filter/aggregate/derive/pivot) · SDMX (our ObsQuery stays the wire truth) · the W2 governed-noun spine (metrics/dims as vocabulary, never raw codes in the author plane).

**Design deliverables (this card's DoD):** a decided SPEC (not a menu): the pipeline grammar (declarative steps over the ONE evaluator/lowering path) · the data-home IA (raw → governed model → specs → elements as the visible floor plan; DQ expectations declared at the raw floor — backlog rec #1 folds here) · the authoring surface concept (step rail + live grid + generated-query pane; where it lives in the studio IA) · Strangler route from today's tag-based editors · wave decomposition sized for WIP=1 · what is refused and why. Owner sees the concept BEFORE build waves fire.

**Hard boundaries.** Laws 1–3, 10–11 verbatim · one evaluator (@statdash/expr), one lowering path (resolveMeasureRef), ObsQuery stays the only wire query · author plane speaks governed nouns only (FF-AUTHOR-NO-QUERY class holds; the pipeline is the author's power WITHOUT raw-code exposure) · no object-model change · additive/Strangler, the old editors demote only when the new path is journey-proven.

---

## Log

### W-P0 — gates registered + baseline captured (engine-specialist, 2026-07-18)

S-sized wave: register the program's fitness gates + capture the equivalence baseline. **No `pipeline` discriminant, no `source` op, no UI, no engine behaviour change** (only a pure additive type-level `category?` seam). All bounds held.

- **`FF-PIPELINE-EQUIV` (BITING) — `platform/apps/api/src/provisioning/pipeline-equiv.fitness.test.ts` + committed baseline `platform/apps/api/provisioning/pipeline-equiv.baseline.json`.** For every DataSpec in the corpus SSOT (18 `query` specs, collected at the `data` residence), under two fixed canonical contexts (year `time:2020` + range `time:0`), records the store-read contract `extractRequirements()` derives — the {code, dims} warm/prefetch set, the pure store-free invariant a `pipeline` desugar must preserve (SPEC §1.3). Store-agnostic: metric/dim catalogs primed from the artifact's own `siteConfig` via `registerManifestMetrics`/`registerManifestDimensions` (the real boot seam), so governed metric-ids expand to DSD codes faithfully. Deterministic (canonical key/array ordering; regeneration produces an empty diff). Bites via deep-equal vs the committed baseline; regen with `UPDATE_BASELINE=1`. **This is the artifact W-P4's shadow byte-compares against; green here + `FF-JOURNEY-PIPE` gate the ⛔ W-P5 default-emission flip.**
- **`FF-VERB-COVERAGE` (BITING) — `platform/packages/core/src/data/transform/verb-coverage.fitness.test.ts`.** Pins the current 19-op registry inventory: a new/removed op fails loudly with a pointer to SPEC §1.2 (make the category decision). Proves the additive `category` seam is present + inert (every `getTransformStepCategory` is `undefined`; runtime dispatch byte-identical). The W-P3 total-coverage obligation is named as `it.todo`. The pure type-level seam (`StepCategory` union + `category?` param + `getTransformStepCategory`/`listUncategorizedOps`) lives in `packages/core/src/data/transform/step-registry.ts`, exported from the core barrel.
- **Pending gates registered (suite-visible `it.todo`, never silent):** `FF-JOURNEY-PIPE` (`platform/apps/panel/src/features/data-layer/pipeline-journey.fitness.test.ts`) · `FF-DQ-DECLARED` (`platform/apps/api/src/provisioning/dq-declared.fitness.test.ts`) · `FF-PROMOTE-ROUNDTRIP` (`platform/packages/core/src/data/promote-roundtrip.fitness.test.ts`) — each carries its SPEC reference + the wave it lands in.
- **Folded fix (0083 cluster, b544819 class) — `platform/apps/api/src/provisioning/config-cube-contract.fitness.test.ts`.** CHECK-2 previously resolved EVERY `filter.measure` through the metric catalog ("mirrors resolveMeasureRef") — but the runtime (`matchesFilter`/store-filter.ts) treats filter values as LITERALS and never resolves them. Tightened to engine-real semantics: resolution now applies ONLY to the folded top-level `measure` field (tracked via a new `literalDims` provenance set); a new **CHECK-4** fails any explicit `filter.<dim>` literal that is a governed metric-id (the exact hole that let b544819 through green). Falsified: clean on the current corpus, 18 violations when a metric-id is injected as a filter literal. Engine filter-resolution is NOT extended here — that decision is deferred to W-P4 (noted in the test header).

**Gate (parsed):** `tsc -b` EXIT 0 (full workspace) · full vitest from platform root **3694 passed | 81 skipped | 15 todo | 0 failed** (466 files; baseline was 3685+ green) · `pnpm eslint` clean on all 8 changed source files (the 20 pre-existing `ApexRenderer.tsx` lint errors untouched). **`packages/core` touched → engine dist rebuilt** (`pnpm --filter @statdash/engine run build`), though apps/api consumes none of the new exports (no functional dependency on the rebuild for this wave).
