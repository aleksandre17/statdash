---
id: "0056"
title: "Revert the object-model-activation WIP (a43b3c6 + untracked nodeProjection.ts) — the only live ADR-038 violation"
status: done
class: M
priority: P1
owner: orchestrator (direct, on-branch)
implements: ADR-038 §Consequences (revert the hand-wired projector; derive projection from declared META)
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - .claude/agent-memory/platform-architect/project_adr038_trunk_state.md
---
**Goal** — Remove the ONE live Bounded-Element violation in the tree, root-cause. `a43b3c6 (wip(react): object-model activation — PARTIAL … UNVERIFIED)` commits a canvas activation whose `apps/panel/src/canvas/setupCanvasRegistry.ts` imports + calls `registerNodeProjector('kpi-strip', { toNode: kpiSpecToCardNode })` from the **untracked** `apps/panel/src/canvas/nodeProjection.ts` — an external per-type projector holding a bespoke value-band→node lowering in a generic layer. ADR-038 §Consequences prescribes REVERT, not completion.

**Why this is correct (not a loss of good work)** — The "trunk" this WIP purported to build already EXISTS and is lawful: `ObjectMeta` (`packages/react/src/engine/slice-meta.ts:191`, ADR-023 "One Type System") is the canonical declare-once contract; the KPI card is already deeply authorable with ZERO per-type code via `KpiStripSchema.items.itemSchema → KpiItemSchema → KpiValueItemSchema` recursion (Inspector drill-in, visible on :3013). Promotion ships DARK (`isPromotionEnabled('kpi-card') === false`). The WIP adds a SECOND, redundant authoring mechanism (Law 6 / DRY breach) + encodes external knowledge of kpi-strip internals (FF-NO-EXTERNAL-SPECIAL-CASE breach). SPEC-worldclass-authoring-ui.md's canvas gesture is double-click-to-enter-Studio, not per-item canvas promotion → the projector solves a UX the design doesn't adopt (YAGNI).

**Dispute on record** — the WIP author argued in-comment it is a "generic registry for canvas SELECTION, not an anti-pattern." Overruled: itemSchema recursion already authors the card; canvas-selection-of-promoted-cards is speculative under the committed SPEC. The lawful render-side `kpiSpecToCardNode` INSIDE the kpi-strip plugin (an element operating on its own value band) STAYS, behind `isPromotionEnabled`.

**DoD**
- [ ] `a43b3c6` reverted (its 6 canvas/inspector/registration edits) + untracked `nodeProjection.ts` + `nodeProjection.fitness.test.ts` removed.
- [ ] `git grep registerNodeProjector` = ∅ (tracked).
- [ ] Independent `find -name '*.tsbuildinfo' -delete` + `tsc -b --force` EXIT 0.
- [ ] `packages/plugins/panels/kpi-strip/promotion-lossless.fitness.test.tsx` still GREEN (lawful shadow promotion intact, ships dark).
- [ ] KPI-card authoring via Inspector `items[]` drill-in unaffected (live :3013 spot-check).

**Notes** — Reversible (git). Work DIRECTLY on `feat/ar49-m0-metric-first-authoring` (no worktree — the revert has descendants; resolve conflicts in place). The owner personally flagged this exact hardcode earlier and asked to "look at it"; this settles it. Blocks 0057 (the gate that keeps it out).

**RESOLUTION (2026-07-11, orchestrator, on-branch)** — Reality was smaller than the architect's reconstruction: a43b3c6's TRACKED hand-wire was ALREADY superseded by a later commit (Move 1 / parallel commits), so `git grep registerNodeProjector` in tracked HEAD was already ∅ and `git revert a43b3c6` staged a ZERO net diff (no-op — cleared via `git revert --quit`). The only LIVE remnant was the **untracked orphan** `nodeProjection.ts` + `nodeProjection.fitness.test.ts` (dead on disk, imported by nothing) — deleted. Verified: registerNodeProjector absent (tracked + disk); `tsc -b --force` EXIT 0; `promotion-lossless.fitness` 8/8 (lawful shadow intact, ships dark). No tracked commit resulted (untracked deletion = no git delta). 0057 remains valuable — the gate that stops re-introduction.
