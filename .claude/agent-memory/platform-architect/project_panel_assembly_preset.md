---
name: panel-assembly-preset
description: STUDY I own on panel assembly-hardness + capability underuse — root = missing composed-preset/defaultProps primitive; rec = Preset projection over registry
metadata:
  type: project
---

I OWN `docs/architecture/proposals/STUDY-panel-assembly-capability-composed-preset.md` (2026-07-19,
owner circle-break signal: "assembling an object is still hard for a non-expert; not leveraging what we
built"). Composition-UX + capability-underuse lens (parallel architect owned internal-coupling).

**Load-bearing verdict:** element parity is DONE; the missing thing is the **composition primitive**. Every
dropped object is a BLANK SHELL — `defaultProps`/preset/template do NOT exist (verified: registry meta carries
label/icon/caps/category/requires only). The whole reference class ships a "composed starting point" we lack:
Builder Blocks, Puck `defaultProps`, Form.io templates, Grafana viz-suggestions+field-config. Assembly today =
**drop-then-hunt** across 4 disjoint gestures / 3 surfaces (palette insert → discover inspector → escalate to
DataWorkbench → hunt scattered compound parts).

**Two durable code facts:**
- DataWorkbench (Power-Query 3-pane + live grid) — the `canWorkbench` gate at `DataFacetField.tsx`
  is now KIND-AGNOSTIC (`!!escalation`, FF-WORKBENCH-KIND-AGNOSTIC) — the old query/pipeline/unbound
  `spec.type` gate is GONE (verified 2026-07-20); every bind-kind reaches the workbench.
- VisibilityBuilder built + wired to filters/perspectives/params/page but NOT KPI/featured `when` nor node
  `view.visibleWhen` (~42 occ). ⚡bind/responsive/thresholds fire only for BINDABLE_TYPES fields.

**Recommendation:** Option A = **Composed-Preset projection** (a preset = a partial element declaration:
type+sensible props+bound DataSpec+pre-wired trend/threshold/visibility/style, registered on the SAME open
registry, projected into the palette as an insertable whole). It (1) is pure config/SSOT/lossless (Law 2 ok),
(2) declaration→projection with ONE additive registry field (no per-type special-case), (3) turns "assemble a
blank" into "pick a whole, tweak", (4) IS the capability-injection mechanism — buried DataWorkbench/Visibility/
⚡/thresholds ship PRE-WIRED inside each preset = default surface not a hunt. On Option-B (unbury: drop the :124
gate, wire VisibilityBuilder, build TrendField) as substrate; sequence toward Option-C (intent/metric-first
insert = AR-49 completion). FFs: FF-PRESET-IS-CONFIG + FF-PRESET-NO-SPECIAL-CASE. ADR extends ADR-038/041,
additive/Strangler, no engine/object-model change.

See [[authorability-parity-audit]] (TrendField A1, the parity backlog = Option B), [[governed-canvas-vision]]
(AR-49 = Option C), [[project-authoring-experience-architecture]] (Manipulate/Placement port, orthogonal),
[[query-pipeline-data-home]] (DataWorkbench spine), [[conditional-formatting]] (threshold payload).
