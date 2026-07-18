---
name: query-pipeline-data-home
description: Card 0082 SPEC — "the pipeline is the spine": one `pipeline` DataSpec + `source` head op + three-pane authoring surface (rail·live grid·generated query) + four-floor raw-data home; DQ rec#1 folds in
metadata:
  type: project
---

I OWN `docs/architecture/proposals/SPEC-query-pipeline-data-home.md` (2026-07-17, card `work/items/0082-query-pipeline-data-home.md`). Owner's 5 wants: query+pipeline simple-perception/full-power on data elements · raw data separated once-and-for-all · today's query build is confusing (tags shown together) · raw data visible while building · resulting query visible while building.

**The decision — "the pipeline is the spine."** ONE canonical `pipe: TransformStep[]` whose HEAD is a new `source` step (store-aware, governed-noun read via `resolveMeasureRef`) and whose tail is the existing pure transform verbs. New additive `pipeline` DataSpec discriminant (`registerSpec`, OCP); all 8 legacy discriminants desugar into it (expand-contract); default emission flips to `pipeline` only after `FF-PIPELINE-EQUIV` green on stored corpus (the ⛔ one-way door, mirrors M-SQ/ADR-034 pattern).

**Ground truth that shaped it (verified reads):**
- The confusion is diagnosable in `DataSpecEditor.tsx`: an 8-discriminant `Select` → 8 bespoke editors, and inside `query` you get `FieldWells` (chips→wells) + `PipelineBuilder` (step cards) + JSON accordion ALL at once = the owner's "tags shown together."
- We ALREADY OWN the pipeline grammar+lowering: ~18-op runtime registry `listTransformOps()`, each op carries handler + authoring `PropSchema` (OCP), authored through the ONE generic Inspector (`TransformStepEditor.tsx`). Lowering = `interpretSpec → desugar → registry.resolve → resolveMeasureRef` (`packages/core/src/data/spec.ts`, `transform/index.ts`).
- The pipe lives in THREE homes today (`query.pipe`, `transform.steps`, `ratio-list.pipe`) — the smell the spine fixes.
- The MISSING pieces: (a) one spine, (b) a LIVE per-step grid (Power Query surpass — nobody in our class has it), (c) the tag-zoo retired into a **7-verb** author grammar (Get/Filter/Aggregate/Derive/Reshape/Combine/Sort) that PROJECTS a new additive `category` field on each op (declaration→projection; NO new engine verbs invented — YAGNI).
- Cell honest-state grammar (`data/cell.ts`: ok/no-data/unbound/loading/masked/error) already exists → the live grid renders it (no fake 0, Law 11).

**Three-pane surface:** step rail (reuse `PipelineBuilder`) · live data grid = **projection of the reactive graph** (SPEC-rendering-architecture, per-step node, NO preview cache) rendering Cell states + governed headers · generated-query pane (Grafana builder↔code duality, read-only default; steward sees lowered ObsQuery). Author plane speaks governed nouns ONLY (FF-AUTHOR-NO-QUERY); steward lens adds raw codes/ObsQuery/DQ.

**Raw-data home = four-floor ladder** in the DATA rail (BLUEPRINT-panel-canonical-relay): Raw sources (apps/api+contracts, DQ declares here) → Governed model (core) → Specs/pipelines (config) → Elements (render). "Separated once and for all" = the dependency arrow made VISIBLE as IA. `CAPABILITY-INJECTION-BACKLOG.md` rec#1 (DQ-on-ingest, SDMX-grade over existing two-tier validation floor, failures ride Cell states) folds at Floor 1.

**Waves (WIP=1):** W-P0 ADR+FFs · W-P1 live grid (apps) · W-P2 three-pane shell (apps) · W-P3 7-verb palette (apps) · W-P4 `source`+`pipeline` discriminant (L, core+contracts) · W-P5 flip default emission ⛔ + demote tag editors · W-P6 raw-home IA + DQ (L). Journeys J-PIPE + J1-extended.

**Bounds held:** no object-model change (ADR-041/042), no metric-grammar change (ADR-034/045), ObsQuery stays wire truth, one evaluator, additive/Strangler. Registry AR-rows + ADR number are the LEAD's to assign.
