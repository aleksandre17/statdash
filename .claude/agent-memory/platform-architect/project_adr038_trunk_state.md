---
name: project-adr038-trunk-state
description: ADR-038 Bounded-Element trunk is ALREADY BUILT on feat/ar49 — ObjectMeta + itemSchema recursion + FF-SCHEMA-COMPLETE; the value-band-node-promotion (nodeProjection/registerNodeProjector) is the anti-pattern to REVERT not complete
metadata:
  type: project
---

The ADR-038 Bounded-Element Law is ~85% IMPLEMENTED and LAWFUL on `feat/ar49-m0-metric-first-authoring` (tip 6f7e913, 2026-07-11). Do NOT rebuild it.

- **Canonical Bounded-Element contract = `ObjectMeta`** (`packages/react/src/engine/slice-meta.ts`): every element declares ONCE `schema`(PropSchema) · `slots`(SlotDef.accepts) · `caps` · `groups` · and deep `PropField.itemSchema`. One type system, kind-as-facet (ADR-023 R1, commit 322e1a1).
- **All derived surfaces are already GENERIC projections**: Inspector←`SchemaSource`→`nodeRegistry.getSchema/getGroups`; deep/nested authoring←generic recursive nested-item editor over `itemSchema` (D7.0/D7.1) + drill-in (D7.1b); palette←caps/category; validation←renderNode slots.accepts; section grammar←ONE registry `{id,appliesTo,render,order}` (SPEC §3.1).
- **The KPI card is ALREADY a lawfully-declared bounded element, authorable by generic recursion**: `KpiStripSchema.items` declares `itemSchema: KpiItemSchema` (+`itemLabel`), `KpiItemSchema.value`→`KpiValueItemSchema` (value.measure = enum-ref 'metrics', governed). Selecting the strip + drilling an item = full card authoring, zero per-type code. THIS is ADR-038's "drill into any element by generic recursion over its own declaration."
- **FF-ELEMENT-DECLARES-CONTRACT already exists as `FF-SCHEMA-COMPLETE`** (`packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts`): #1 non-empty schema for every placeable; #1a defaults↔schema + JSON-Schema round-trip lossless; #1c nested 100%-gated (SCHEMA_TODO drained to {}, OPAQUE_BY_DESIGN argued allowlist recursing at any depth). Writing a new one duplicates it (Law 6).

**THE ONE anti-pattern = the WIP to REVERT, not systematize:** `a43b3c6 wip(react): object-model activation (kpi-card as object) — PARTIAL, UNVERIFIED` + the UNTRACKED `apps/panel/src/canvas/nodeProjection.ts` (`registerNodeProjector('kpi-strip',{toNode: kpiSpecToCardNode})`). Hand-wired value-band→node projection = a SECOND redundant authoring mechanism duplicating itemSchema recursion; external knowledge of kpi-strip internals = the exact FF-NO-EXTERNAL-SPECIAL-CASE violation. ADR-038 §Consequences itself says "revert the WIP hand-wire; derive projection from each promoted type's declared META." SPEC-worldclass-authoring-ui.md's canvas gesture is double-click-to-enter-Studio (Framer), NOT per-item node promotion.

**Authoring-object-model SSOT = `docs/architecture/proposals/SPEC-worldclass-authoring-ui.md`** (Fable/AR-49 M4.3): section registry + SummaryCard grammar (kill raw-JSON fallback) + Chart Studio stage. Genuinely-remaining gaps: SummaryCard control for rich values; RightDock section-registry completion; `FF-GROUP-FIELDS-EXIST` (ChartGroups references view.legend/view.tooltip absent from ChartSchema — a real silent-dropped-group bug). Parallel agents in flight: `agent/ar49-drain-chart-schema` (owns ChartSchema/inspector — don't touch). See [[worktree-base-hazard]] · [[maximal-orthogonality]].
</content>
