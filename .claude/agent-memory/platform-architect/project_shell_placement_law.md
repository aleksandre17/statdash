---
name: project-shell-placement-law
description: AR-49 M4.2 canonical Studio shell layout + overflow model — the Placement Law (scope × derived weight → closed container set); focus-view generalizes Model mode
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-studio-shell-layout.md` (I am sole author, 2026-07-10) — the canonical answer to the owner's "right dock gets cramped" pain. LIGHT spec, 201 lines.

**The load-bearing reframe:** a crammed dock is not a sizing bug, it is a **missing LAW**. Fix = a deterministic **Placement Law** `place(scope, weight) → container` over a CLOSED container set; a subject whose derived weight exceeds a container's budget **escalates to the next container automatically** → cramming becomes structurally unrepresentable (the "make illegal states unrepresentable" thesis applied to chrome; same doctrine as the rendered-page @container cascade in [[grid-maximal-grammar]]).

**Two axes:** SCOPE (micro-target · element · nested-item · page · site/data-model/workspace) × WEIGHT (glance / form / workspace) — **weight is DERIVED** by generalizing the deep-authorability §4 formula (`fieldCount + 2·nested + 2·rich-type[DataSpec|ChartDef|VisibilityExpr|MetricCalc]`), NOT hand-assigned. FORM_BUDGET default 8 (one tunable constant, D-SL-2).

**Closed container set:** Rail · Left dock (ADD/global) · Canvas (home + focus-view host) · Right dock (element/page EDIT, form-budget, 3-zone: header=context XOR breadcrumb / body=facet form / footer=actions) · **Popover** (glance, anchored) · **Focus-view** (workspace, canvas-region takeover, breadcrumb-back) · ⌘K. Escalation ladder: POPOVER→DOCK/DRILL→FOCUS-VIEW (element/nested); page/global escalates outward to a relocated surface.

**KEY unification (owner's explicit "one model not two"):** the deep-authorability §4 taxonomy (INLINE/DRILL-IN/POPOVER/INNER-PAGE) + D7.1b drill-in ARE `place()` restricted to scope=nested-item — NOT a parallel system. ONE weight primitive governs both nested-editor taxonomy AND whole-shell placement; ONE breadcrumb spine ties dock-drill↔focus-view.

**KEY grounded seam:** **Model mode is already an un-generalized focus-view** (`enterDataModel` swaps role-lens+surface + takes over the canvas). SL-2 extracts reusable `<FocusView>` shell + focus-view target registry (OCP) and re-homes Model onto it (proves it, zero regression). This is a DRY/OCP smell fix — bespoke Model takeover would be forked by the next workspace editor (chart encoding, metric calc, filters pipeline).

**Relocate verdicts (§5, all = place() applied):** page config/perspectives STAY in dock Page context (page·form); FiltersDrawer ESCALATES→focus-view (page·workspace — the reported cram); raw pipeline→Model focus-view (D8 confirmed); global tokens→Style left-dock surface, element style→dock facet (scope-split); chart encoding/metric calc→focus-view.

**Phasing (apps-only, reversible):** SL-0 placement primitive (law as code, no UI) → SL-1 dock zone contract → SL-2 FocusView shell → SL-3 Popover primitive → SL-4 escalation+budget guard → SL-5 relocate audit. 9 FFs incl. FF-NO-CRAMMED-DOCK, FF-PLACEMENT-DERIVED, FF-OVERFLOW-DETERMINISTIC, FF-FOCUSVIEW-CANVAS-REGION, FF-MODEL-IS-FOCUSVIEW.

**NO new one-way door / NO arrow crossing** — all apps/panel chrome; full-fidelity nested drill still rides the already-gated D7 `itemSchema` seam (this spec opens nothing new). Owner gates: D-SL-1 focus-view = canvas-area not full-viewport (rec: canvas-area, keeps rail+dock+breadcrumb); D-SL-2 FORM_BUDGET=8; D-SL-3 dock stays bounded 240–560px, depth pops OUT (never widen to hold a workspace editor — Figma/Webflow confirm).

**How to apply:** this is the layout unification of M4 Wave 7 (tri-context dock) + M4.1 (contextual law) + deep-authorability §4/D7.1b — extends, never regresses. At Leader's Scans treat as the shell-layout SSOT; route SL-0..SL-5 as apps-only build steps.

**2026-07-11 HONEST VERDICT (owner still saw the problem after SL-0..5):** the law is KEPT as kernel but was INCOMPLETE — (1) it's a *negative* law (evicts editors, never says what the dock positively shows → eviction became invisibility; rich values fell to raw JSON via `FieldControlRegistry` JsonControl default); (2) the focus-view terminal is subject-less (form in a void, WYSIWYG loop broken); (3) weight is derived from knowingly-incomplete schemas (SCHEMA_TODO) so it mis-weighs. Completed by [[worldclass-authoring-ui]] (Summary Corollary + Stage Contract, ADR-037). §3.4's form-only focus-view realization and the SL-5 bespoke filters affordance are SUPERSEDED; everything else stands.
