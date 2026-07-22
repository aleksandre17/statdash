---
name: placement-law
description: "The Studio Placement Law — the pure primitive at apps/panel/src/studio/placement (§3.2 scope×weight→container), the escalation port shape, and where the canon actually lives on disk. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (placement-law-primitive, placement-law-arc).

The pure Placement Law primitive lives at `apps/panel/src/studio/placement/` (`weight.ts`,
`resolveSurface.ts`, `index.ts`, `placement.fitness.test.ts`). It derives WHERE any editable
subject is authored from scope × weight — no surface hand-places its own editor.
`place(scope,weight) → container`, escalation ladder `inline → popover → dock-panel →
dock-drill → focus-view`.

**Where the canon actually lives (don't chase the missing doc):** the
brief-referenced `docs/architecture/proposals/SPEC-studio-shell-layout.md` does NOT exist on
disk. The canonical spec (§3.1 weight, §3.2 scope×weight table, §3.4 focus-view) lives INLINE as
doc-comments in `weight.ts`/`resolveSurface.ts`/`index.ts`. Read those, not the missing md.

**Canonical scopes (5):** `micro-target · element · nested-item · page · site`.
**Containers:** `inline · popover · dock-panel · dock-drill · focus-view · relocated-surface`.
Escalation: POPOVER (glance) → DOCK-PANEL/DRILL (form) → FOCUS-VIEW (workspace); `site` is an
off-ladder weight-independent HOME (relocated-surface).

**Two non-obvious reconciliation decisions:**
- **glance is a SCOPE position, not a shape band.** `deriveWeight(shape)` returns a finer 4-band
  `WeightBand` (flat/grouped/nested/oversize); `toCanonicalWeight` rolls it onto only
  `form|workspace`. The canonical `glance→POPOVER` cells are realized via the `micro-target`
  scope (a single transient property IS glance) — don't try to derive glance from magnitude.
- **The 4-band is KEPT (not collapsed to canonical 3).** Its earned value is the dock's
  INLINE-vs-DRILL split: `nested-item·flat → inline`, heavier → `dock-drill`. A 3-weight axis
  alone can't express that container difference. `CANONICAL_TABLE` + `containerWeightFamily` +
  FF-CANONICAL-ALIGNMENT prove the fine table projects onto §3.2.

**The escalation DIP port** is `apps/panel/src/inspector/focusEscalation.tsx`
(`useFocusEscalation`/`FocusEscalationRequest`) — a discriminated union: `source:'node-field'`
(host binds selected-node field live) | `source:'self-bound'` (editor sources its own store,
page-scoped subjects). `StudioShell` is the host; `makeEscalatedTarget` builds the dynamic
focus-view target. Reuse this port — do not invent a second escalation path. See
[[project_panel_studio_map]] for the realized containers (RightDock/FocusView/EditPopover).

**Deriving placement: NEVER branch in the kernel.** The consumer that owns a schema maps it to
the abstract `SubjectShape` (pattern: `nestedItemPlacement.schemaSubjectShape`,
`filterPlacement.filterPipelineShape`); the law decides the container.

**Consumed by BOTH `inspector/` and `features/`** — it is an app-wide primitive, arguably should
relocate to a neutral `apps/panel/src/placement/` so no single feature "owns" it (no lint gate
enforces this yet; flag if the coupling deepens).
