---
id: "0064"
title: "BE-6: query builder + data pipeline as a GENERIC projection on every node that declares it accepts data"
status: backlog
class: M
priority: P1
owner: —
implements: ADR-038 Bounded Element Law applied to DATA-BINDING + AR-40/AR-50 semantic layer surfacing (owner-observed 2026-07-12)
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - docs/architecture/ARCHITECTURE-REGISTRY.md
  - platform/apps/panel/src/features/data-layer/editors/query/PipelineBuilder.tsx
---
**Goal** — The owner: *"together with the semantic layer we have a QUERY builder and a DATA PIPELINE too, which should work on EVERY node that accepts data."* These are BUILT (`features/data-layer/`: `PipelineBuilder`, `QuerySpecEditor`, `DataSpecEditor`, `TransformStepEditor`, `PivotEditor`, `DataModelingPanel`) but surfaced only in the steward Model mode / specific panels — NOT generically wherever data is accepted. Make the query builder + data-pipeline editor (+ the semantic metric/dimension binding) a **GENERIC projection available on ANY node that DECLARES it accepts data**.

**The Bounded-Element way (data-binding arm of ADR-038)** — a node that accepts data DECLARES that contract (`data?: DataSpec` on section; the chart/table/kpi/geograph data seam). The inspector/authoring then offers the query+pipeline+bind editors on that node **derived from the declaration** — no `type === 'chart'`, no burying behind one role/panel. A new data-accepting node gets full data-authoring FOR FREE. Reconcile the role-lens (AR-49 M2: raw modeling = steward) with reachability: the CAPABILITY is generic on every data node; the ROLE gates depth, it does not hide the seam.

**DoD (VERIFIED live on :3013)**
- [ ] Selecting any data-accepting node exposes its data-authoring (bind a governed metric / open the query builder / edit the pipeline) — derived from the node's declared data contract.
- [ ] Generic: no per-type branch; a fitness asserts every node declaring a data contract projects the data-authoring surface (FF, extends FF-SCHEMA-COMPLETE / FF-NO-EXTERNAL-SPECIAL-CASE).
- [ ] Role-lens preserved (steward depth) but the seam is reachable per the declaration (closes the "built-but-buried" grievance).
- [ ] Playwright real-boot proves data-authoring on ≥2 different data-accepting node types via ONE generic path.

**Notes** — Part of the grand unification: ONE declaration-driven system — data source (AR-51) · data-accepting node (this) · UI element (BE line) are all self-declaring objects; every editor/renderer/pipeline is a generic projection. Reuse the built `features/data-layer/*` editors + the semantic layer (AR-40/AR-50) — surface, don't rebuild. Architect the declared "accepts-data" contract seam first.
