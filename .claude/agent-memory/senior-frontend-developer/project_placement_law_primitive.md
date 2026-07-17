---
name: placement-law-primitive
description: Studio Placement Law primitive (apps/panel/src/studio/placement) — canonical §3.2 scope×weight→container, the glance-via-scope + 4-band reconciliation SL-1 consumers must respect
metadata:
  type: project
---

The pure Placement Law primitive lives at `platform/apps/panel/src/studio/placement/`
(`weight.ts`, `resolveSurface.ts`, `index.ts`, `placement.fitness.test.ts`). It derives
WHERE any editable subject is authored from scope × weight — no surface hand-places its
own editor. Authority: `docs/architecture/proposals/SPEC-studio-shell-layout.md §3.1–3.4`.

**Canonical scopes (5):** `micro-target · element · nested-item · page · site`.
**Containers:** `inline · popover · dock-panel · dock-drill · focus-view · relocated-surface`.
Escalation ladder: POPOVER (glance) → DOCK-PANEL/DRILL (form) → FOCUS-VIEW (workspace);
`site` is an off-ladder weight-independent HOME (relocated-surface).

**Two non-obvious reconciliation decisions (SL-0b, commit 4d804bd) SL-1 must honor:**
- **glance is a SCOPE position, not a shape band.** `deriveWeight(shape)` returns the finer
  4-band `WeightBand` (flat/grouped/nested/oversize); `toCanonicalWeight` rolls it onto only
  `form|workspace`. The canonical `glance→POPOVER` cells are realized via the `micro-target`
  scope (a single transient property IS glance). Don't try to derive glance from magnitude.
- **The 4-band is KEPT (not collapsed to canonical 3).** Its earned value is the dock's
  INLINE-vs-DRILL split (§4/D7.1b): `nested-item·flat → inline`, heavier → `dock-drill`.
  A 3-weight axis alone cannot express that container difference. `CANONICAL_TABLE` +
  `containerWeightFamily` + FF-CANONICAL-ALIGNMENT prove the fine table projects onto §3.2.

**Why:** SL-0 reconstructed vocab from prose and diverged (missing `page` scope; scopes named
selection/nested-field/quick-edit/document). SL-0b aligned to the authoritative §3.2 table.
**How to apply:** SL-1 wires consumers (Inspector, nested-item editor, canvas overlays, Page
pane) to call `placeSubject(scope, shape)` — none decides its own placement. Thresholds
(inlineMaxFields:4, maxDrillDepth:8) are SSOT; when wiring, make D7.1b's `MAX_NESTING` and the
Inspector's `GROUP_TAB_THRESHOLD` read FROM `WEIGHT_THRESHOLDS` (Strangler-Fig, not yet done).
Related: [[project_panel_studio_shell_m12]].
