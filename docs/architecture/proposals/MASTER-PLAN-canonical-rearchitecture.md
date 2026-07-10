# MASTER PLAN — Canonical Rearchitecture (AR-49 → the object-model + rendering + shell unification)

> **Author:** orchestrator (lead), synthesizing two independent Fable-5 studies + the layout arc + deep-authorability. **Date:** 2026-07-10 (overnight autonomous run, owner-authorized). **Status:** roadmap → executing.
> **The vision (owner):** the best-in-class Constructor nobody else has — everything canonical, unified, agnostic, dynamic; every anti-pattern/degradation killed; the best concepts/patterns/architectures from the leading platforms, unified. This doc is the single scheme; the full designs live in the linked SPECs.

## The three unified backbones (one coherent model)
1. **WHAT renders — object model** (`SPEC-rendering-core-object-model.md`, Fable study 1): **"One Type System, One Tree, Two Residences."** Collapse 3 registries + 2 composition mechanisms + the unregistered item tier into ONE type system; "kind" (node/panel/page/chrome/control) = a facet, not a mechanism. A **Promotion Law** (≥2 node-facets {id, visibility, style, own DataSpec, RBAC, reorder} → a type; below → a value) decides residence: kpi-card + hero-card **promote** to types; table-columns / chart-encodings / filter-controls correctly **stay values** (Grafana/Vega canon). D7/itemSchema = the value band's **canonical** editor (reframed, kept).
2. **HOW data flows + updates — rendering architecture** (`SPEC-rendering-architecture.md`, Fable study 2): **Grammar → config-compiled Reactive Query Graph → pluggable realizers.** The grammar (GoG/DataSpec) + the render pipeline are reference-grade (kept). The debt is the data/reactivity plane — coarse re-render patched by fragile string cache-keys (2 are patches over shipped bugs). Fix: **compile the whole dashboard's dependency graph from the declarative config** (`extractDeps` is total because Law 2) → surgical, exact invalidation; subsumes the cache/warm/poll patches + the bug class. "Nobody compiles a dashboard-scale dataflow graph from config — we can." + a static `ChartEmitter` (ChartOutput→SVG) closes the server-side/export hole.
3. **WHERE it's edited — shell/placement** (`SPEC-studio-shell-layout.md`): the Placement Law (`place(scope,weight)→container`) — unaffected + strengthened; its scope-axis maps 1:1 onto residence; focus-view = a **separate Studio route** (owner clarification). SL-0/0b/1 built; SL-2..5 remain.

The three cohere: kpi-card promotion (backbone 1) ⇄ per-card graph node (backbone 2) ⇄ selectable object in the shell (backbone 3). One declarative config; one type system; one reactive graph; one placement law.

## Sequenced roadmap — reversible first, one-way-doors LAST (held for owner)
**Legend:** ✅ done · 🔁 reversible (autonomous) · ⛔ one-way-door (STOP — owner sign-off with green evidence).

### Object model
- ✅ D7.0–D7.3 (itemSchema value-band editor — reframed as canonical, kept)
- 🔁 **R0** — ADR-023 + the 6 fitness scaffolds (ONE-TYPE-SYSTEM, KIND-IS-FACET, TWO-RESIDENCES-ONLY, NO-FACET-REINVENTION, PROMOTION-LOSSLESS, ONE-COMPOSITION-GRAMMAR)
- 🔁 **R1** — type-system unification (3 registries → 1 `ObjectMeta` with kind-facets; engine-internal, config byte-identical, alias-reversible)
- 🔁 **R2-expand** — kpi-card as a promoted leaf-data-panel type ALONGSIDE the itemSchema (behind a flag; `interpretKpi` → renderNode pipeline; FF-PROMOTION-LOSSLESS in shadow)
- ⛔ **R2-contract** — remove the old kpi item path (the one-way door; only after FF-PROMOTION-LOSSLESS green on ALL stored configs)
- 🔁 **R3-expand** — hero-card promotion (expand) · ⛔ R3-contract
- ⏸ R4 chrome residence (defer, after SL) · ⏸ R5 control split (defer, YAGNI)

### Rendering
- 🔁 **V0** — ADR-024 + FFs + **baseline measurements** (the honesty gate)
- 🔁 **V1** — `extractDeps` SSOT (standalone value; the config→dependency static analyzer)
- 🔁 **V2** — reactive graph engine in **shadow mode** (FF-GRAPH-PARITY diff vs current)
- ⛔ **V3** — render-path switch (the one-way door; golden-DOM + latency-gated, soak window)
- 🔁 **V4** — subsume warm/stream/poll (after V3) · 🔁 **V5** — `ChartEmitter` (ChartOutput→SVG, independent — build now) · ⏸ V6 extra strategies (defer)

### Shell / layout
- ✅ SL-0/SL-0b (Placement Law primitive) · ✅ SL-1 (dock 3-zone)
- 🔁 **SL-2** — Focus-View = a **separate Studio route** (owner clarification) + re-home Model mode · 🔁 **SL-3** popover · 🔁 **SL-4** overflow escalation · 🔁 **SL-5** relocate audit

## Overnight execution order (autonomous, each DoD-gated + committed, STOP before ⛔)
R0 → R1 → V0 → V1 → V2(shadow) → SL-2 → SL-3 → SL-4 → SL-5 → V5(ChartEmitter) → R2-expand → R3-expand → **STOP** (hold R2-contract / R3-contract / V3-switch for owner).
Each step: principled agent (mission-command brief, model per decision-density) → DoD gate (functional + live/parity-verified + canon-checked + full converged gate incl. independent root `tsc -b` for packages work) → commit (no push) → next. Anti-pattern hunt + the self-policing gate rollout run alongside. Nothing degrading laundered into a brief; laws + arrow held throughout.

## Owner one-way-doors (on return, with green evidence)
D-ROM-1 adopt object model (proceeding on the reversible R0–R2-expand) · **D-ROM-2 kpi-card contract** · D-ROM-3 hero-card contract · D-RRA-1 adopt rendering (proceeding on reversible V0–V2) · **D-RRA-2 V3 render-switch** · D-RRA-3 ChartEmitter (proceeding — cheap high-value).
