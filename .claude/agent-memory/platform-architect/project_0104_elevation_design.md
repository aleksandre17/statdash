---
name: elevation-reference-class-0104
description: I OWN DESIGN-0104-elevation-reference-class.md — the apex elevation design; thesis = push declaration to decision granularity then derive; 7 concepts C1-C7, reshaped wave order E0-first
metadata:
  type: project
---

I OWN `docs/architecture/proposals/DESIGN-0104-elevation-reference-class.md` (2026-07-22,
card 0104 Phase 3, design-only; lead elevation pass → owner adjudication pending).

**THESIS (load-bearing):** the 0104 regression = symptom of a MISSING DECLARATION — kind-level
authoring contract exists (`SPEC_CATALOG` schema-or-editor) but NO step-level contract and NO
declared capability set, so admissibility was a hand gate (`isWorkbenchShaped`,
`workbenchModel.ts:35`). Every elevation = ONE move four ways: **push the declaration down to
the granularity where the decision is made, then DERIVE the decision.**

**7 concepts:** C1 Step Contract (heads get what tails have — SourceStep variants declare
schema|editorKey+provides; dedicated editors DECOMPOSE into head/step editors, `registerStepEditor`
idiom) · C2 Capability Matrix (`SpecManifestEntry.capabilities` required ⊆ editor `provides`
derived admissibility + probe layer so claims can't lie; regression class unrepresentable,
degrades to fallback not read-only) · C3 Authoring Lifecycle (client draft + validated PUT 422 +
append-only revision log; kills `DEFAULT_AUTHORING_HOLD`; server draft slots deferred) · C4 Offer
Port (role-keyed OfferProvider, `measure-code`/`source-ref`; promotes bindSuggestions pattern;
GAP-3 folds in) · C5 Binding Summary (`summarizeBinding` via desugar+extractDeps, total by
construction — kills facet false-unbound) · C6 Lineage Door (`explainCell`→LineageRecord as
GRAPH PROJECTION, never trace side-channel; v1 = popover+export, no DAG viz) · C7 Shape Gallery
(picker = SPEC_CATALOG projection incl. pipeline; post-DU5 kinds = pure starting shapes).

**QC-1 root LOCATED:** plumbing tokens are DECLARED in the engine catalog itself —
`spec-catalog.ts:201,204,219,239` (`SpecField.type` = raw TS strings as author-facing hints).
Fix = reclassify `plane:'system'` + Step Contract faces; FF-NO-PLUMBING-TOKENS.

**Reshaped wave order (declared explicitly, needs owner bless):** E0 lifecycle FIRST (hold means
:3013 not saving → all J-walks untruthful) → E1 matrix → E2a timeseries keystone (+C4+C7) →
E2b growth → E2c pivot (+FF-NO-PLUMBING-TOKENS) → E2d transform → E3 summary → DW-C → DU6 →
DW-A(+QC-3 unique options) → DW-B (cheaper: reuses step editors) → E2e/f (post Add.5) → E4
lineage → DW-D → E5 visual (token-derived chart theme SSOT in styles) → DU5 ⛔. E2-before-DU6
rationale: don't re-lay the floor around a fork twice.

**3 doors for owner:** DU5 enriched (kinds→shapes, dedicated editors+fallback DELETED) ·
revision-log contract shape (E0) · capability-id vocabulary lands in specManifest (E1).

See [[one-data-workspace]] (ADR-051 this completes), [[data-workspace-redistribution]] (DW waves
preserved/folded), [[query-pipeline-data-home]] (three-pane spine), [[binding-autocomplete]]
(C4's proven precedent).
