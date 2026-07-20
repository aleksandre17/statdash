---
name: one-data-workspace
description: ADR-051 (I authored) — One Data Workspace, source-is-step-0; Option A of the 0102 data-fragmentation facet; surface unification + retire the two doubles; wave plan DU1-DU6
metadata:
  type: project
---

`docs/architecture/decisions/ADR-051-one-data-workspace-source-is-step-0.md` (I authored, 2026-07-20, owner-blessed FULL autonomy). The Surface-axis close of the [[project-canonical-panel-ia]] data-fragmentation facet (Option A). This IS ADR-050 R6, elevated from "polish" to unification. Complements [[query-pipeline-data-home]] (ADR-046 = the grammar, DONE).

**Three axes:** Grammar=DONE(ADR-046) · Surface=this ADR(archipelago→one) · Residence=deferred to ADR-052/Option B (inline `CanvasNode.props.data` vs named `NamedDataSpec` reference-binding; sequenced AFTER A).

**Verified ground truth (2026-07-20):** source-is-step-0 already TRUE in engine (the `source` head = workbench Get card, `DataWorkbench.tsx:176-193`); workbench already emits `pipeline` on write; the generic `SpecBody` dispatch (`DataSpecEditor.tsx:87-110`) already authors every non-pipeline kind by DECLARATION (OCP-clean, no per-type switch). The fragmentation is PURELY: (1) two rail doors `sources`+`model` (`rail.ts:38-45`); (2) courier teleport `store/sourcesHandoff.ts` = `browseCube→setRole('steward')→setSurface('model')` (`SourcesBody.tsx:45-54`), consumed at `DataModelingPanel.tsx:136-143`; (3) TWO spec editors — `DataWorkbench` + a parallel `DataSpecEditor` "Raw editor (advanced)" accordion mounted in BOTH `DataModelingPanel.tsx:229-241` AND `DataFacetField.tsx:199-212`.

**Reference class (adopted whole):** Power Query (Applied Steps, Source=literal step 0, one editor, one preview — we surpass with PER-STEP grid) · Grafana (source→query builder↔code→transform→preview, one panel flow) · Retool (query names its resource at head; catalog co-located, not a separate screen; full component-binds-named-query = Option B).

**Wave plan (DU1-DU6, WIP=1, senior-frontend owns UI waves):** DU1 unified Data workspace shell (fold `sources`+`model` → one 'data' target; rail.ts + focusViewRegistry.tsx + StudioShell + useCommandRunner deep-link) → DU2 kill courier (delete sourcesHandoff, in-workspace selection seeds source step) → DU3 absorb the "Raw editor (advanced)" as the workbench's ONE co-located fallback lane (retire the parallel accordion in both hosts; keep generic SpecBody INSIDE workbench `if(!model)` branch) → DU4 fold non-pipeline kinds into pipeline natively kind-by-kind via desugar SSOT (engine-specialist owns desugar; timeseries/growth/ratio-list/row-list) → DU5 ⛔ reuse ADR-046 W-P5 emission flip + demote fallback to steward-only, gated FF-ALL-KINDS-SHAPED + FF-PIPELINE-EQUIV → DU6 data-floor polish. Raw editor NEVER deleted while a kind is uneditable (absorb@DU3 → fold@DU4 → remove@DU5).

**FFs (each lands with its wave):** FF-ONE-DATA-WORKSPACE · FF-SOURCE-IS-STEP-0 · FF-NO-DATA-COURIER · FF-ONE-SPEC-EDITOR · FF-ALL-KINDS-SHAPED. Reuse FF-PIPELINE-EQUIV as the ⛔ gate. Gate = pnpm lint + tsc -b apps/panel + the wave FF. DoD = live J-walk on :3013 (never gate-green alone): J-DATA-HOME (DU1/DU2), J-PIPE-extended (DU3/DU4/DU5).

**How to apply:** Option B (ADR-052 reference-binding) is scheduled AFTER A, not rejected. Refuse a fourth data surface / a second spec editor / a config query-language. The debugger owns the separate "constructor gets stuck" symptom (likely the courier choreography).
