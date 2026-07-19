---
name: assembly-by-declaration
description: Card 0100 / ADR-049 program — the panel stops assembling objects by dispatch+by-hand and assembles by DECLARATION; two primitives (DataSpec authoring registry → composed-preset)
metadata:
  type: project
---
Foundational program launched 2026-07-19, owner-blessed («გენდობი, მიდი, იყავი ლოჯისტიკოსი/მეცნიერი/იდეოლოგი, საუკეთესო საერთაშორისო პატერნები») after a two-lens READ-ONLY circle-break study answering his four-part panel complaint: not loosely-coupled · concept↔logic entangled · object-assembly hard for a non-expert · built capabilities not leveraged.

**Root (synthesized):** the panel assembles an object by **dispatch** (`switch(type)` picks the editor) and **by hand** (a dropped tile = a blank shell to hunt-fill) — same defect, two levels, not declaration-driven.

**Two primitives (sequenced, both Strangler, both EXTEND ADR-038/041 — no fifth grammar, no engine object-model change):**
- **P1 — DataSpec authoring-contract registry** (the *binding* axis gets the port ADR-041 gave *containment*). Kills the three `DataSpecEditor` `switch(type)` (SpecBody import · defaultSpec · SPEC_CATALOG stub). Each bind-kind DECLARES `make()` + authoring surface (PropSchema OR registered rich editor). Anchor: extend the `SchemaSource` pattern (transformStep/filterParam) UP to DataSpec kind. Gate `FF-NO-DATASPEC-SWITCH` lands FIRST as ratchet + `FF-DATASPEC-AUTHORING-COMPLETE`.
- **P2 — Composed-Preset projection** — a preset = partial element declaration on the same object registry, projected into the palette as an insertable whole (the reference-class "composed starting point": Builder Blocks/Puck defaultProps/Form.io templates/Grafana viz-suggestions). Rides substrate un-bury: drop `DataFacetField:124` gate · wire `VisibilityBuilder` (~42 gaps) · build `TrendField` (raw JSON ~33 places). Buried DataWorkbench/⚡/thresholds ship pre-wired inside each preset.

**Why the order:** P2 stands on P1 (a preset pre-fills a *bound DataSpec*, declarable only once `make()` exists). WIP=1 — P1 built→gated→deployed→shown before P2.

**Docs:** `work/items/0100-assembly-by-declaration.md` · `docs/architecture/proposals/STUDY-panel-coupling-root-databind.md` · `STUDY-panel-assembly-capability-composed-preset.md` · ADR-049 (PROPOSED, in flight).

**Why it matters / how to apply:** this is the current TRUNK (supersedes leaf work on 0082's tail); it's the concrete answer to the standing framework-grade dissatisfaction [[project_framework_grade_verdict]] and the capability-injection mandate [[project_capability_injection_pipeline]]. Related: [[feedback_circle_break_root_study]] (this IS that pattern executed), [[object-model-foundation-reform]] (the containment-axis precedent), [[feedback_activate_not_shadow]] (P2 = activation, ship pre-wired not shadowed).
