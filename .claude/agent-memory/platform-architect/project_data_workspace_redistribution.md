---
name: data-workspace-redistribution
description: I OWN DESIGN-data-workspace-canonical-redistribution.md — the owner's 5 live-review data-workspace problems resolved as ADR-051 DU6+ mini-waves; thesis = 4/5 are one root (hand-placed + forked, not projected + placement-routed)
metadata:
  type: project
---

I OWN `docs/architecture/proposals/DESIGN-data-workspace-canonical-redistribution.md`
(2026-07-20, design-only, owner-blessed). Resolves the owner's 5 live-review problems on the
0102 trunk; elevates ADR-051 DU6 from polish + opens 4 mini-waves. No engine/object-model/
grammar change — surface/IA + disclosure + placement-routing only.

**THESIS (load-bearing):** 4 of 5 are ONE root — surfaces were *placed by hand and forked
ad-hoc* instead of *projected from one declaration* + *placed by the Placement Law*
(`studio/placement/` resolveSurface+weight, already built for exactly this). Two moves: **A**
metric = first-class projected object (one `MetricCatalogView`, declared modes, one home);
**B** route every data-workspace surface through resolveSurface. #3 is the honest exception
(renderer is world-class; pure disclosure-default tuning).

**The 5 verdicts:** #1 metric-scatter = **REFINE** (owner right; stronger target = Looker/dbt
"one definition, many views" → `MetricCatalogView` modes pick/manage/entry/flow/browse; 5 loci
→ 1 home + N projections; SDMX floor law: raw measure+classifier=Sources, governed metric=
Model, so CubeInventory/PromoteMetric stay OUT of the metric home). #2 table-ops = **ADOPT
instinct/REFINE mechanism** (ops are form/glance-weight mis-routed to a workspace focus-view;
add a core-ops band in DATA facet writing declarative TransformStep tail; don't dumb down the
workbench). #3 classifier scent = **ADOPT** (3→1 collapse: closed-card scent chips +
default-expand dim LIST, codelists stay click-to-open; reject auto-expand-all). #4 model floor
= **REFINE + REJECT the browse/edit mutual-exclusion** (section: collapsible flow strip +
co-located browse+manage primary + steward-only "Sources & pipelines" disclosure; lens now
gates ONLY modeler-visibility → dissolves exclusion, strengthens FF-AUTHOR-NO-QUERY; de-dup the
double-mounted DataFlowMap). #5 popups = **ADOPT/REFRAME onto the Placement Law** (route the
hand-placed spots through resolveSurface) + the ONE real architectural add: the ladder has NO
modal → name a 2nd orthogonal **interruption** axis with `confirm-dialog` law-gated to
destructive/blocking ONLY (FF-MODAL-BLOCKING-ONLY), fold into ADR-049/SL Placement lineage.

**Waves (WIP=1):** DW-C(#3, first, quick win, senior-frontend) → DU6(#4, senior-frontend) →
DW-A(#1, after DU6, sf+me) → DW-B(#2, sf+engine-specialist) → DW-D(#5, trailing, sf+me ADR
addendum). All revert-clean. FFs: FF-ONE-METRIC-VIEW, FF-MODEL-BROWSE-EDIT-COLOCATED,
FF-DATAFLOW-SINGLE-MOUNT, FF-COREOPS-NOT-FOCUSVIEW, FF-CLASSIFIER-SCENT,
FF-DATA-SURFACE-PLACEMENT-DERIVED, FF-MODAL-BLOCKING-ONLY. Live-screenshot flags: #3, #4, #2.

See [[one-data-workspace]] (ADR-051 this extends), [[query-pipeline-data-home]] (the workbench
spine DW-B reuses), [[panel-assembly-preset]] (canWorkbench :124 gate now STALE — kind-agnostic
`!!escalation`), [[shell-placement-law]] (the Placement Law this points at the data workspace).
