---
name: project-authoring-hold-dataspec-persistence
description: DataSpec Authoring Lifecycle (C3) — draft→publish→history band; the authoring-hold is DELETED (superseded 2026-07-22, card 0104 E0)
metadata:
  type: project
---

The reversible **authoring-hold** is **DELETED** (card 0104 E0, commit 2fed78e7, 2026-07-22).
It was the SEED; the real model shipped and superseded it. NO capability lost — the hold's only
capability was "don't save"; publish/discard supersedes it (the hold was this model with the
Publish button missing). Gone: `store/authoringHold.ts`, `DEFAULT_AUTHORING_HOLD`, `dataSpecSave.store.ts`
(+ its `'paused'` phase), the "Draft — not saving"/"Enable saving" chip.

**The Authoring Lifecycle (C3, DESIGN-0104 §2·C3) — the current model:**
- **Drafts are CLIENT-SIDE.** `store/dataSpecDraft.store.ts` (zustand+persist, localStorage
  `statdash.dataspec-drafts`). Every edit → optimistic store write + `recordEdit` (NO PUT).
  Keyed by docId; carries the published `base` SNAPSHOT (discard target + staleness guard —
  used instead of a fetched revisionNumber, which DataSpecRow doesn't carry). `changeCount` = the
  chip's «n ცვლილება». A draft **survives reload**: `rehydrateDataSpecDrafts()` (called by
  `initFromApi` after setDataSpecs) re-applies `current` over the loaded published spec IF base
  still matches; a stale base (published advanced) is dropped (published wins, never resurrected).
- **Publish = explicit.** `publishDataSpec(id)` (api-actions) → validated PUT. 422 `config-invalid`
  → `dataSpecPublish.store` phase `error` + `violations[]` (rendered AT-field, Georgian). 403 restore
  → `forbidden` (admin-only, server-truth). Success clears the draft. `discardDataSpec` restores base.
  `fetchDataSpecRevisions`/`restoreDataSpecRevision` hit `/data-specs/:id/revisions[/:revId[/restore]]`.
- **The band:** `features/data-layer/lifecycle/AuthoringLifecycleBand.tsx` — ONE component, placement-
  DERIVED via `lifecycleBandPlacement.ts` (→ resolveSurface). Mounted in BOTH zooms: DataModelingPanel
  workbench-head (full) + browser row (`dense`, dirty-only). **The design named the inspector "DATA
  facet" as the 2nd zoom but that's WRONG** — the facet edits an INLINE `element.data` spec (no
  config.data_spec docId), so config-revision lifecycle can't apply there (inline specs publish with
  their PAGE). The real compact zoom of a stored spec = the Model-floor list row.
- **Wire contract:** `ConfigViolation`/`ConfigInvalidProblem` now in `@statdash/contracts` (problem.ts);
  `ApiError.problem?: ProblemDetails` carries the parsed RFC-9457 body (read `err.problem.violations`).
  apps/api still has its own byte-identical `ConfigViolation` copy — adopting the contract is a follow-up.
- Fitness: `dataSpecPersist.test.ts` (FF-DRAFT-EXPLICIT-PUBLISH / FF-PUT-VALIDATED),
  `lifecycle/AuthoringLifecycleBand.test.tsx`, `lifecycle/lifecyclePlacement.fitness.test.ts`.

Related: [[project_page_lifecycle_workflow]] (pages have their own draft→publish FSM).
