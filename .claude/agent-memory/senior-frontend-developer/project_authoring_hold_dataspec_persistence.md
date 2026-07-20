---
name: project-authoring-hold-dataspec-persistence
description: Reversible authoring-hold pauses DataSpec durable PUT; shipped DEFAULT ON (saving OFF) on dev :3013 by owner ask 2026-07-20
metadata:
  type: project
---

A reversible **authoring hold** gates DataSpec durable persistence. `store/authoringHold.ts`
(`DEFAULT_AUTHORING_HOLD`, `useAuthoringHoldStore`, `isAuthoringHeld`) is the SSOT flag;
guarded at the seam in `store/api-actions.ts` (`updateDataSpec` returns after the optimistic
store write when held → sets save phase `'paused'`; `flushDataSpecSaves` early-returns when
held). Honest chip in `DataModelingPanel` head: "Draft — not saving" + an "Enable saving"
toggle (Law 11 — never fake-saved). `DataSpecSavePhase` gained `'paused'`.

**Why:** owner was experimenting on live dev :3013 and the auto-save (commit 39a32e99) was
persisting experimental edits and corrupting stored specs. Asked 2026-07-20 to stop saving
until it stabilizes. Shipped with hold **DEFAULT ON (saving OFF)** and deployed to :3013.

**How to apply:** this is the SEED of the real fix — a proper draft → explicit-publish model.
If the owner later asks why specs don't persist, or asks to re-enable saving: flip the hold OFF
(permanent = `DEFAULT_AUTHORING_HOLD = false` + redeploy; live = "Enable saving" toggle or
`useAuthoringHoldStore.getState().setHeld(false)`). The persistence fix is GATED, not deleted —
flipping OFF restores exact auto-save. Auto-save contract lives in `store/dataSpecPersist.test.ts`
(that suite opts hold OFF in beforeEach; new tests there prove the hold ON/OFF behavior).
Related: [[project_page_lifecycle_workflow]] (pages already have draft→publish; specs do not yet).
