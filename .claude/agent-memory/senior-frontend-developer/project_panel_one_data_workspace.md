---
name: project-panel-one-data-workspace
description: ADR-051 DU1 — the ONE Data workspace folds the sources+model rail doors into one `data` destination; floor model via ?dataFloor query
metadata:
  type: project
---

ADR-051 DU1 ("One Data Workspace — the source is step 0") folds the two former peer rail
doors (`sources` + `model`) into ONE `data` destination whose internal IA is the
four-floor ladder (Sources → Model → Pipelines → element). Pure surface unification — NO
engine change, `packages/core` untouched.

**Why:** owner-blessed 2026-07-20 (card `work/items/0102-canonical-panel-ia.md`,
data-fragmentation facet). The surface was an archipelago: two top-level doors bridged by a
role-flip + nav-teleport courier (`store/sourcesHandoff.ts`) + a second parallel spec editor.
See `docs/architecture/decisions/ADR-051-one-data-workspace-source-is-step-0.md`.

**How it's built (DU1, the shell/IA slice):**
- `studio/rail.ts` — RAIL_ENTRIES has ONE `data` entry (first); `sources`/`model` gone.
- `studio/DataWorkspaceBody.tsx` (new) — composes `SourcesBody` + `DataModelBody` as FLOORS
  of one focus-view (a ToggleButtonGroup `data-floor-selector`), not separate screens. Open
  floor rides `?dataFloor=sources|model` (default `sources` = step 0). Registered as the
  single `data` focus-view target in `focusViewRegistry.tsx`.
- `studio/useStudioRoute.ts` — `DATA_FLOOR_PARAM='dataFloor'`, `studioDataPath(floor?)` helper.
- `studio/StudioRoutes.tsx` — 301-style `<Navigate replace>` redirects `/studio/sources`→
  `/studio/data`, `/studio/model`→`/studio/data?dataFloor=model` (static routes beat `:surface`).
- `command/useCommandRunner.ts` open-data-model → `navigate(studioDataPath('model'))`.
- `surfaces/InsertSurface.tsx` onboard CTA → `studioDataPath()` (Sources floor, where the ONE
  upload door actually lives — fixed a latent incoherence: it used to point at `model`).
- FF: `oneDataWorkspace.fitness.test.tsx` (`FF-ONE-DATA-WORKSPACE`).

**Non-obvious / gotchas:**
- `STUDIO_SURFACES` DELIBERATELY keeps `'sources'` + `'model'` as redirect-only legacy union
  members (documented) so the still-live courier `SourcesBody → setSurface('model')` keeps
  type-checking + working. DU2 deletes the courier, then they leave the union. Don't "clean
  them up" before DU2.
- The focus-view region aria-label is now `Data` (was `Data model`). Tests assert region
  `{ name: 'Data' }`.
- DU2 = delete the courier (`sourcesHandoff.ts`); DU3 = delete the second raw editor
  (`DataSpecEditor` "Raw editor (advanced)" accordion). Both were left working in DU1.
- e2e (`e2e/studioRouting.e2e.ts`, `dataModelReachable.e2e.ts`, `steward.e2e.ts`) updated to
  click the single `Data` rail button + switch to the Model floor; NOT run in the gate (need
  a live server) — verified only by the owner's live J-walk. Probe scripts under
  `platform/e2e/probes/probe-0091-*.mjs` still reference the old doors (throwaway, not updated).

Related: [[project_panel_studio_map]] · [[project_panel_four_moment_shell]] ·
[[project_panel_data_workbench_wp2]] · [[project_panel_skeleton_restore_r3]]
