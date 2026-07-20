---
name: project-panel-one-data-workspace
description: ADR-051 DU1+DU2+DU3 — ONE Data workspace folds sources+model into one `data` destination (?dataFloor); DU2 kills the courier (cube rides URL); DU3 collapses to ONE editor (SpecBody fallback lane in the workbench)
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

**How it's built (DU2, kill the courier — DONE 2026-07-20, gate-green, not yet live-walked):**
- `store/sourcesHandoff.ts` DELETED (the one-shot courier). `git rm`.
- The cube now RIDES THE URL, reusing DU1 plumbing: `useStudioRoute.ts` adds
  `studioDataWorkbenchPath(seed)` (→ `/studio/data?dataFloor=model&cube=…&cubeMeasures=…&cubeStore=…`),
  `readWorkbenchSeed(params)`, `WorkbenchCubeSeed`, `WORKBENCH_SEED_PARAMS`. Seed is
  self-describing (datasetCode+measures+store, all resolved at origin — race-free/0089-faithful).
- `SourcesBody.tsx` — `onBrowseInWorkbench` now `navigate(studioDataWorkbenchPath(...))` (SAME
  `/studio/data` surface, in-workspace floor switch — NO `setSurface`, NO courier). Dropped
  `useSetSurface`/`useSourcesHandoff` imports.
- `DataModelingPanel.tsx` — seed effect reads `useSearchParams` (`cube`/`cubeMeasures`/`cubeStore`),
  clears the seed params FIRST (read-then-clear, replace) so it's one-shot, then `withStewardCube`
  + `createDataSpec` + select (unchanged seeding logic). Because it now uses `useSearchParams`,
  ALL its render sites need a Router — wrapped `ModelSurface.test` + `DataModelingPanel.test` in
  `MemoryRouter` (it only mounts via ModelSurface in prod, which is inside StudioShell's Router).
- FF: `noCourier.fitness.test.tsx` (`FF-NO-DATA-COURIER`) — asserts courier module gone + no
  file references it + SourcesBody has no `setSurface`/courier + uses `studioDataWorkbenchPath` +
  panel reads the URL seed. Source-scan uses a local `stripComments()` (prose may name the retired
  symbol; real imports are code and survive) + self-excludes its own path (names the symbols in its
  regex).
- ROLE DECISION (flagged, kept): `setRole('steward')` REMAINS in SourcesBody. The workbench mounts
  ONLY behind the steward lens (`DataModelBody` role-branch → `ModelSurface`), and shaping a raw cube
  is a steward act by FF-AUTHOR-NO-QUERY ("author never picks a raw cube"). So FF-NO-DATA-COURIER
  targets the COURIER (store + cross-surface teleport), NOT the in-workspace lens selection. Removing
  the lens-set would land the author on the read-only Dictionary = broken shaping view. Cleaner
  decoupling (per-request shaping context, no global persisted lens flip) is ADR-052 follow-up.
**How it's built (DU3, ONE editing surface — DONE, gate-green, not yet live-walked):**
- The generic `SpecBody` dispatch is now EXPORTED from `DataSpecEditor.tsx` and co-located
  INSIDE `DataWorkbench.tsx`'s `if (!model)` branch as a FALLBACK LANE (`data-testid=
  workbench-fallback-lane`) — reached for kinds the three panes can't yet shape
  (row-list/timeseries/growth/ratio-list/pivot/metric). It carries NO kind `<Select>` (that
  stays the DataSpecEditor picker), so a pipeline spec (which never reaches this branch) can
  never trip the `out-of-range 'pipeline'` MUI warning — that DU2 warning is GONE.
- Removed the two parallel `DataSpecEditor` accordions: `DataModelingPanel.tsx` "Raw editor
  (advanced)" (+ its Accordion/ExpandMoreIcon imports) and `DataFacetField.tsx` "Raw editor
  (steward)" (+ the lazy `DataSpecEditor` import + now-unused `useRole`/`isSteward`). The
  facet's non-pipeline summary now says "open the workbench to edit it".
- **DU3 COMPLETION (2nd pass, HEAD after DU2 `dbe5e142`) — the ONE-surface claim now holds
  across BOTH hosts.** The 1st pass left a gap: `DataModelingPanel` still had a SEPARATE
  `DataSpecEditor` mount (with its kind `<Select>`) for a non-workbench-shaped selected spec
  in its grid-view editor pane — so the same non-pipeline kind edited through TWO surfaces
  (Model floor `DataSpecEditor` vs inspector door fallback lane). FIXED: the early full-width
  workbench-takeover gate changed from `workbenchSpec = selectedSpec && isWorkbenchShaped(...)`
  to just `if (selectedSpec)` — EVERY selected spec (pipeline/query OR any other kind) now
  takes over the panel full-width through the ONE `DataWorkbench`, which internally routes to
  the three panes OR the SpecBody fallback lane. Deleted the grid-view `selectedSpec` editor
  block (kind Chip + `DataSpecEditor` + Divider) and the `DataSpecEditor`/`isWorkbenchShaped`
  imports from `DataModelingPanel.tsx`. A non-pipeline spec from the Model floor now edits
  through the SAME fallback lane as the inspector path — genuinely one surface, no kind Select.
- FF: `oneSpecEditor.fitness.test.tsx` (`FF-ONE-SPEC-EDITOR`) — WIDENED to span both hosts:
  workbench-in-isolation (row-list → fallback lane present+editable, panes absent; pipeline →
  panes present, no lane); `DataModelingPanel` with a workbench-shaped spec (three panes, no
  `workbench-raw-advanced`/kind-Select sibling) AND — the added blind-spot test — a NON-pipeline
  `selectedSpec` (`modeling-workbench` takeover → lazy `workbench-fallback-lane` editable,
  rail/grid absent, NO kind-Select); source-scans DataFacetField for `DataWorkbench` present +
  `DataSpecEditor` absent. The gate now fails if a 2nd non-pipeline surface exists in either host.
- Test updates: `authorNoQuery.fitness.test.ts` PIPE_EDITOR regex `DataSpecEditor`→
  `DataWorkbench`; `DataModelingPanel.test.tsx` — the two "reveals the real DataSpecEditor" /
  "edit via kind Select" tests rewritten to assert the workbench fallback-lane path (edit
  through the JSON-fallback textbox writes via `updateDataSpec`, no kind Select).
- Strangler-safe: `DataSpecEditor`/`SpecBody` NOT deleted (DU5 retires the fallback after DU4
  folds the kinds into the pipeline). No `packages/core` change.

**DU3 DATA-LOSS FIX (2026-07-20) — edit-persistence asymmetry closed:**
- Defect (pre-existing, `b1e9f8e0`/AR-49 M1.3a): the Model-floor workbench `onChange` wired to
  the STORE `updateDataSpec` (optimistic/local only) — edits were LOST on reload. Create already
  persisted (POST via `createDataSpec` api-action); edit did not (no PUT). Both the three-pane
  pipeline edits AND the fallback-lane edits funnel through the ONE `onChange`, so both were lost.
- Fix: `DataModelingPanel.tsx` `onChange` now calls the API-persisting **api-action**
  `updateDataSpec` (`store/api-actions.ts`), NOT the store action. That api-action was refactored:
  IMMEDIATE optimistic store write (snappy controlled value) + a DEBOUNCED (400ms), COALESCED-per-id
  durable PUT (latest patch wins). New `flushDataSpecSaves()` force-flushes pending PUTs; the panel
  calls it on a `useEffect` cleanup keyed to `selectedSpecId` (fires on back-to-list / select-another
  / unmount) so a debounced edit is never dropped by navigation.
- Honest state (Law 11): new tiny `store/dataSpecSave.store.ts` (separate from the history-tracked
  constructor store, like page saveStatus) tracks per-spec `saving|saved|error`; the workbench head
  renders a status chip (error chip is clickable = retry). Failure never shows fake-saved; optimistic
  edit is never silently reverted.
- The api-action `updateDataSpec` changed signature `async→void` (fire-and-forget; `flushDataSpecSaves`
  is the awaitable). It had ZERO non-test callers before this, so no fan-out.
- Tests: `store/dataSpecPersist.test.ts` (durable PUT + coalesce + debounce-fires + honest-error +
  optimistic-immediate); `DataModelingPanel.persist.test.tsx` (BOTH shapes → api-action, mocks
  DataWorkbench to emit onChange; flush-on-leave). `DataModelingPanel.test.tsx` mock now overrides
  `updateDataSpec`/`flushDataSpecSaves` (prevents a real-PUT timer leak). Gate: full panel suite
  171 files/1249 tests green, tsc clean, lint 0 errors.
- FLAKE NOTE: `DataModelingPanel.test.tsx` fallback-lane test occasionally times out on the REAL
  lazy `DataWorkbench` import under a COLD transform cache (pre-existing; passes reliably warm). The
  persist test mocks DataWorkbench so it's immune.

**Non-obvious / gotchas:**
- `STUDIO_SURFACES` DELIBERATELY keeps `'sources'` + `'model'` as redirect-only legacy union
  members (documented) so the still-live courier `SourcesBody → setSurface('model')` keeps
  type-checking + working. DU2 deletes the courier, then they leave the union. Don't "clean
  them up" before DU2.
- The focus-view region aria-label is now `Data` (was `Data model`). Tests assert region
  `{ name: 'Data' }`.
- DU2 = delete the courier (`sourcesHandoff.ts`); DU3 = collapse the second raw editor into
  the workbench fallback lane, ONE surface across both hosts (DONE — 2nd pass closed the
  DataModelingPanel non-pipeline gap). Roadmap: DU4 folds non-pipeline kinds INTO the
  pipeline (desugar → source-is-step-0) so the panes shape them; DU5 then retires the
  SpecBody fallback lane. Do NOT delete `DataSpecEditor`/`SpecBody` before DU5.
- **WALKABILITY (why the live J-PIPE-extended walk was blocked):** NO author gesture currently
  mints a non-pipeline `NamedDataSpec` in the spec browser. Both `createDataSpec` callers in
  `DataModelingPanel` (cube-seed, Show-Me `handleSuggestionInsert`) emit `pipeline`/`query`;
  `buildSuggestedSpec` emits `type:'query'`; and the kind `<Select>` that could convert a spec
  to another kind is (correctly) gone. So the dev seed's 18 query specs + 1 kpi metric leave
  zero reachable non-pipeline target in the Model-floor host → the walker must POST a
  non-pipeline `NamedDataSpec` (e.g. row-list) to dev `/api/config/data-specs` to walk it
  (answer **b**). The inspector-door host CAN reach it via an element carrying a non-pipeline
  inline spec, independent of the NamedDataSpec list.
- e2e (`e2e/studioRouting.e2e.ts`, `dataModelReachable.e2e.ts`, `steward.e2e.ts`) updated to
  click the single `Data` rail button + switch to the Model floor; NOT run in the gate (need
  a live server) — verified only by the owner's live J-walk. Probe scripts under
  `platform/e2e/probes/probe-0091-*.mjs` still reference the old doors (throwaway, not updated).

Related: [[project_panel_studio_map]] · [[project_panel_four_moment_shell]] ·
[[project_panel_data_workbench_wp2]] · [[project_panel_skeleton_restore_r3]]
