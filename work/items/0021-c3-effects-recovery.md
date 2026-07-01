---
id: "0021"
title: "C3: Effects recovery — reactive param mutation on mode switch (lost at 0ea99b6)"
status: backlog
class: M
priority: P2
owner: —
implements: SPEC §1 C3, §4 FF-EFFECTS-DECLARATIVE
depends_on: ["0011", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/static-era-regression.md
  - platform/work/effect-variable-architecture-drift.md
---
**Goal** — Re-express the lost reactive filter-mutation capability FORWARD on the perspective/expr seam (NOT a rollback of the deleted `Effect` type), so a mode toggle clears/pins stale params instead of leaving them lingering hidden.

**Implements** — SPEC §1 C3. Closes the P5 gap (visibility + reactivity become peer perspective capabilities).

**Root cause** — The static era's `effects` (change perspective A → set/clear param B) were narrowed away at `0ea99b6` (P5) when config migrated onto the perspective seam, which modeled *only* visibility (`perspective-is`), never reactivity. The deleted `Effect`/`applyEffects` was correctly removed as dead code — but the capability was lost at P5, not at the deletion. Today `წლიური↔დინამიკა` is purely presentational: entering `range` does not clear the stale `year` or pin `sector:'_T'`; leaving `range` does not clear `fromYear`/`toYear`.

**Files / modules touched**
- `PerspectiveDef` contract (`packages/core/src/config/...`) — add JSON-serializable, Constructor-authorable `onEnter`/`onExit` `{ set: Record<key, ExprVal|literal|null>, when?: VisibilityExpr }`. `set` values are whitelisted `ExprVal`/literal/`null` (clear). No functions.
- Evaluator — pure `applyPerspectiveEffects(active, prev, params) → params'` in the filter-resolution pass (the slot the deleted `applyEffects` occupied — `useFilterState`/`SiteRenderer`, after `computed`, mutating only the flat param Record). Deterministic, one pass.
- Constructor (`apps/panel`) — an "Effects" sub-pane beside Perspectives; `onEnter`/`onExit` `set`-rules as key→value rows (registry-driven).
- Config (geostat) — bind `range` perspective: `onEnter { year:null, sector:'_T' }`, `onExit { fromYear:null, toYear:null }`.
- Guard: `ops/scripts/check-laws.sh` — recovery lands under the NEW `onEnter`/`onExit` vocabulary, so the existing retired-`applyEffects`/`Effect[]`/`.effects` guards stay intact.

**Dependencies** — 0011 (O-3: build now vs defer `D-EFFECTS` — if deferred, this item drops out of the wave), 0017 (C2 — reactive param mutation must keep warm===render after the mutation). Build AFTER C4/C5/C6 (lower visibility than the drift fixes).

**Acceptance criteria (incl. fitness functions)**
- [ ] `onEnter`/`onExit` on `PerspectiveDef`; `applyPerspectiveEffects` pure, deterministic, one pass.
- [ ] Entering `range` clears `year` + pins `sector:'_T'`; leaving `range` clears `fromYear`/`toYear`.
- [ ] **FF-EFFECTS-DECLARATIVE**: `onEnter`/`onExit` `set` values are literals/`ExprVal`/`null` only — no functions; the retired `applyEffects`/`Effect[]` tokens stay absent.
- [ ] Constructor "Effects" pane round-trips losslessly (config = serialize = render).
- [ ] Warm set stays correct after a mutation (FF-WARM-COVERS-RENDER, 0017, still green post-toggle).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Forward re-expression, not a rollback (the old orphaned `Effect` stays deleted). Seam (perspectiveState transition) is already observed by `useFilterState` — deferral costs nothing to open later. Two-way door.
