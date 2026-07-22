---
name: project-panel-one-data-workspace
description: ADR-051 DU1+DU2+DU3 — ONE Data workspace folds sources+model into one `data` destination (?dataFloor); DU2 kills the courier (cube rides URL); DU3 collapses to ONE editor (SpecBody fallback lane in the workbench)
metadata:
  type: project
---

ADR-051 DU1 ("One Data Workspace — the source is step 0") folds the two former peer rail doors
(`sources`+`model`) into ONE `data` destination whose internal IA is a four-floor ladder (Sources
→ Model → Pipelines → element). Pure surface unification — no engine change, `packages/core`
untouched. **Why:** the surface was an archipelago — two top-level doors bridged by a role-flip +
nav-teleport courier + a second parallel spec editor.

**DU1 (shell/IA):** `studio/rail.ts` RAIL_ENTRIES has ONE `data` entry; `sources`/`model` gone.
`studio/DataWorkspaceBody.tsx` composes `SourcesBody`+`DataModelBody` as FLOORS of one focus-view
(a ToggleButtonGroup), not separate screens — open floor rides `?dataFloor=sources|model` (default
`sources` = step 0). `StudioRoutes.tsx` redirects the old `/studio/sources`/`/studio/model` paths.
FF: `FF-ONE-DATA-WORKSPACE`.

**DU2 — kill the courier (DONE, gate-green).** `store/sourcesHandoff.ts` (the one-shot courier)
DELETED. The cube now RIDES THE URL: `studioDataWorkbenchPath(seed)` builds
`/studio/data?dataFloor=model&cube=…&cubeMeasures=…&cubeStore=…` (self-describing — datasetCode +
measures + store all resolved at origin, race-free); `DataModelingPanel.tsx`'s seed effect reads
`useSearchParams`, clears the seed params first (read-then-clear, one-shot), then seeds via the
unchanged `withStewardCube`+`createDataSpec` logic. FF: `FF-NO-DATA-COURIER` (courier module gone
+ no references + `SourcesBody` uses the URL path, not `setSurface`).
**Role decision (flagged, kept):** `setRole('steward')` REMAINS in `SourcesBody` — the workbench
mounts only behind the steward lens (shaping a raw cube is a steward act, FF-AUTHOR-NO-QUERY), so
FF-NO-DATA-COURIER targets the COURIER specifically, not this in-workspace lens selection. A
cleaner decoupling (per-request shaping context, no persisted lens flip) is a follow-up.

**DU3 — ONE editing surface (DONE, both hosts).** The generic `SpecBody` dispatch (exported from
`DataSpecEditor.tsx`) is co-located INSIDE `DataWorkbench.tsx`'s `if(!model)` branch as a
FALLBACK LANE — reached for kinds the three panes can't yet shape (row-list/timeseries/growth/
ratio-list/pivot/metric); it carries NO kind `<Select>` (a pipeline spec never reaches this
branch, so the old out-of-range MUI warning is gone). The two PARALLEL `DataSpecEditor` mounts
(`DataModelingPanel`'s "Raw editor (advanced)" accordion and `DataFacetField`'s "Raw editor
(steward)" accordion) were removed — a non-pipeline spec now edits through the SAME fallback lane
from EITHER host (Model floor or the inspector door), genuinely one surface. FF:
`FF-ONE-SPEC-EDITOR` — fails if a second non-pipeline surface exists in either host.
Strangler-safe: `DataSpecEditor`/`SpecBody` NOT deleted (DU5 retires the fallback once DU4 folds
the remaining kinds into the pipeline).

**DU3 DATA-LOSS FIX — edit-persistence asymmetry closed.** Pre-existing defect: the Model-floor
workbench `onChange` wired to the STORE `updateDataSpec` (optimistic/local only) — edits were LOST
on reload (create persisted via POST, edit did not). Fix: `onChange` now calls the API-persisting
**api-action** `updateDataSpec` — IMMEDIATE optimistic store write + a DEBOUNCED (400ms),
COALESCED-per-id durable PUT; `flushDataSpecSaves()` force-flushes on navigation-away so a
debounced edit is never dropped. Honest state (Law 11): `store/dataSpecSave.store.ts` tracks
per-spec `saving|saved|error`, rendered as a status chip (error = clickable retry).
**NOTE (authoring-hold, 2026-07-20 onward):** durable PUT persistence for DataSpec edits is
currently PAUSED behind a reversible flag — see [[project_authoring_hold_dataspec_persistence]].
The mechanism above is intact; only the save is gated off by default.

**Non-obvious / gotchas:**
- `STUDIO_SURFACES` deliberately keeps `'sources'`+`'model'` as redirect-only legacy union
  members — don't clean them up before the courier that used them is fully gone.
- Roadmap: DU4 folds non-pipeline kinds INTO the pipeline (desugar → source-is-step-0) so the
  panes shape them (see [[project_panel_editor_capability_parity]] for how DU4's first attempt was
  narrowed back after a trust-recovery finding); DU5 then retires the SpecBody fallback lane. Do
  NOT delete `DataSpecEditor`/`SpecBody` before DU5.
- **Walkability gap:** no author gesture currently mints a non-pipeline `NamedDataSpec` in the
  spec browser (every `createDataSpec` caller emits `pipeline`/`query`) — to walk a non-pipeline
  kind, POST one directly to dev `/api/config/data-specs`. The inspector-door host CAN reach one
  via an element carrying a non-pipeline inline spec, independent of the NamedDataSpec list.
- e2e (`studioRouting.e2e.ts`, `dataModelReachable.e2e.ts`, `steward.e2e.ts`) click the single
  `Data` rail button + switch floors; not run in the gate (need a live server).

Related: [[project_panel_studio_map]] · [[project_panel_four_moment_shell]] ·
[[project_panel_pipeline_program]] · [[project_panel_substrate_presets]]
