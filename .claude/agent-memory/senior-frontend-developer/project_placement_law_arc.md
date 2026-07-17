---
name: project-placement-law-arc
description: AR-49 studio-shell Placement Law — where the canon/spec actually lives, the escalation port shape, and the SL slice state (SL-5 done)
metadata:
  type: project
---

AR-49 "studio-shell layout" is built as numbered slices SL-0..SL-5 on branch
`feat/ar49-m0-metric-first-authoring`. The Placement Law = `place(scope,weight)→container`
with an escalation ladder `inline→popover→dock-panel→dock-drill→focus-view`.

**Why:** the reported defect was a "crammed right dock" — heavy authoring surfaces stacked
in the bounded Inspector dock. The law makes a crammed dock *unrepresentable*: an oversize
subject escalates to a focus-view by construction.

**How to apply:**
- The brief-referenced `docs/architecture/proposals/SPEC-studio-shell-layout.md` does NOT
  exist on disk. The canonical spec (§3.1 weight, §3.2 scope×weight table, §3.4 focus-view)
  lives INLINE as doc-comments in `apps/panel/src/studio/placement/{weight,resolveSurface,index}.ts`.
  Read those, not the missing md.
- The escalation DIP port is `apps/panel/src/inspector/focusEscalation.tsx`
  (`useFocusEscalation` / `FocusEscalationRequest`). As of SL-5 it is a discriminated union:
  `source:'node-field'` (host binds selected-node field live — SL-4) | `source:'self-bound'`
  (editor sources its own store — SL-5, page-scoped subjects). StudioShell is the host;
  `makeEscalatedTarget` builds the dynamic focus-view target. Reuse this port — do not invent
  a second escalation path.
- Deriving placement: NEVER branch in the kernel. The consumer that owns a schema maps it to
  the abstract `SubjectShape` (pattern: `nestedItemPlacement.schemaSubjectShape`,
  `features/filters/filterPlacement.filterPipelineShape`); the law decides the container.
- Slice state: SL-5 DONE (commit c6de9f7) — page filters pipeline is the first REAL escalation.
  Audit (`apps/panel/src/studio/placementAudit.fitness.test.ts`) marks `visibility expr`
  (element, node-field path) and `perspectives builder` (page, self-bound path) as the
  audited-but-not-yet-wired next candidates. Chart encoding is already relocated to the
  Steward Model focus-view; re-mounting it on an author dock trips FF-AUTHOR-NO-QUERY.
- Observation: `studio/placement` is now consumed by BOTH `inspector/` and `features/` — it
  is becoming an app-wide primitive and arguably should relocate to a neutral
  `apps/panel/src/placement/` so no one feature/surface "owns" it. Sanctioned intra-app
  coupling for now (no lint gate); flag if it deepens further.
