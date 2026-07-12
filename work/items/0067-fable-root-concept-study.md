---
id: "0067"
title: "FABLE ROOT-CONCEPT STUDY — settle the object-model FOUNDATION (stop leaf-patching; break the circle)"
status: direction-chosen (owner GO 2026-07-12 — Option A · D-F2 retire shadow-promotion · D-F3 port-first) → build tracked in 0068
class: M
priority: P0
owner: —
implements: owner directive 2026-07-12 — "we're going in circles; lay down the ROOT concepts on which the core logic + full canonical structure assembles. Have Fable study packages/plugins from the roots, benchmark all reference platforms, tell me: too much architecture or too little?"
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - docs/architecture/decisions/ADR-039-bounded-element-selection-projection.md
  - docs/architecture/ARCHITECTURE-REGISTRY.md
---
**The owner's signal (verbatim intuition).** We declared "everything is a node/object that declares its identity/contract." We have a taxonomy — sliceType/slot/node/type/variant/chrome + more. Yet it "still doesn't come out"; his experience-driven intuition points at a **wrapper-vs-single-element** split he can't place in the architecture. We keep NOT doing one thing right and can't break through the circle (BE-1→BE-4 = per-kind bridges, not a settled root). Question he wants answered from first principles: **do we have TOO MUCH architecture in the embryo, or TOO LITTLE? are we cutting too much or too little?**

**Lead's hypothesis (to confirm/refute, not to assume).** Two parallel taxonomies fight over ONE idea ("a unit in a declared-contract tree"): a RENDER language (node/slice/variant/chrome/slot) and an AUTHORING language (bounded-element/band/itemSchema/BandSource/boundary). Because they aren't ONE, every new selectable kind (KPI card→BE-1, filter item→BE-4, section child→BE-5) forces a NEW bridge. Suspected root: **too many concepts for the same underlying thing (accidental complexity to CUT) + possibly one missing unifying primitive.** The canonical platforms model leaf AND container as ONE uniform node shape.

**The study (Fable model, platform-architect, READ-ONLY diagnosis — NOT code):**
1. Map the ACTUAL concept taxonomy in `platform/packages/plugins` from the roots (node, sliceType, slice, slot, variant, chrome, type, band, boundary, itemSchema, BandSource…) — what each REALLY is; where they overlap, duplicate, or fight.
2. Resolve the owner's wrapper-vs-leaf intuition: essential or accidental?
3. Benchmark against the CANONICAL concept-sets of the reference platforms (Builder.io Blocks/inputs · Framer · Webflow · Plasmic · JSON-Forms/RJSF schema→UI · Grafana panel plugins · Vega-Lite grammar · Backstage). How MANY concepts does each use for "a thing in the authorable tree + its declared contract"? What is their minimal canonical foundation?
4. Diagnose: OVER-built (cut what) · UNDER-built (add which primitive) · or MIS-factored (which seam is wrong).
5. Propose the ROOT concepts — the minimal canonical foundation on which core logic + full structure assembles; what to KEEP / CUT / ADD; reconcile with ADR-038, ADR-039, SPEC-rendering-core-object-model (Fable), SPEC-worldclass-authoring-ui.

**Deliverable:** a decision-grade SPEC/diagnosis doc + a clear recommendation framed as an OWNER decision (this is a foundational, near-one-way-door direction call). No code lands off this until the owner picks a direction.

**Holds:** BE-4 (0062) is landed + verified but held uncommitted — the root study may reshape its form. Reform 0066 leaf-grind PAUSED pending this foundation.
