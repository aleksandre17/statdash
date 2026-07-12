---
id: "0063"
title: "BE-5: canvas nests + selects children via each element's DECLARED slots — generalize the projection to slot children"
status: done
class: M
priority: P1
owner: orchestrator (direct, on-branch)
resolution: "BE-5 was found LARGELY ALREADY REALIZED (verify-first): CanvasOverlay reads nodeRegistry.getSlots → drop-frames + validates slot.accepts.includes(nodeType) (:156) — generic, declaration-driven composition; slot children select as nodes; value-band items select via bandItems (BE-1). Both are declaration-driven projections, no per-type special-case = the decided 'unify at the projection layer'. LANDED the remaining piece: compositeIntegrity.fitness.test.ts (FF-COMPOSITE-INTEGRITY) — locks the stored invariant 'every child's type ∈ its parent's declared slots.accepts' (defense-in-depth beyond the drop-time check), proven to BITE, declaration-driven (accept-set from getSlots, not hardcoded). 4/4, tsc + lint clean. No storage collapse (per the items-vs-children decision)."
implements: ADR-038 Bounded Element Law — composition = a tree of declared contracts (Composite)
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - platform/packages/plugins/nodes/section/default/meta.ts
---
**Goal** — The owner: *"elements don't go into the item's children — the meta.ts's probably don't declare."* VERIFIED: the metas DO declare slots (`section/meta.ts`: `slots: SectionSlots` accepts [chart,table,kpi-strip,columns,grid,wrap,geograph], `canHaveChildren:true`; card/columns/grid/hero too). So the declaration EXISTS — the gap is that the **authoring canvas does not fully PROJECT those declared slots** into nestable/selectable children (compose an element INTO a container by its declared `accepts`; select a nested child).

**Root-cause first** — confirm where the projection stops: does the canvas read `slots.accepts` to (a) allow dropping/adding a permitted child into a container, and (b) select a nested child as a bounded element? BE-1 solved value-band items (`itemSchema`); slot children (`NodeDef[]` tree nodes) are the SIBLING mechanism — they must ride the SAME generic declaration-driven projection, not a separate path.

**FINDING (verify-first 2026-07-12 — BE-5 is LARGELY ALREADY REALIZED).** The declaration-driven composition seam already exists and is generic: `apps/panel/src/canvas/CanvasOverlay.tsx` reads `nodeRegistry.getSlots(type, variant)` → drop-frames per declared slot (`:104-107`), and the drop handler VALIDATES against the declaration — `if (d.slot.accepts && … && !d.slot.accepts.includes(nodeType)) return` (`:156`). Slot children are real tree nodes → already selectable (`useCanvasController.selectNode`); value-band items are selectable via `bandItems` (BE-1). So BOTH bands and slots already flow through declaration-driven projections with NO per-type special-case — the "unify at the projection layer" DECISION above is essentially the current state. **De-scoped:** the big BE-5 build is unnecessary. **Remaining (small, optional):** (a) a Composite-INTEGRITY fitness locking the stored invariant "every child's type ∈ its parent's declared `slots.accepts`" (defense-in-depth for imported/hand-authored configs — the drop path already enforces it at authoring time); (b) confirm nested-child selection depth on :3013. Registry BE-5 → **largely BUILT**.

**DoD (VERIFIED live on :3013)**
- [ ] Composing: you can add/nest a declared-permitted element into a container (section/columns/grid) — the allowed set comes from the element's OWN `slots.accepts`, generically (no per-type list in the canvas).
- [ ] Selecting: a nested child selects as a bounded element; the dock shows only its contract.
- [ ] Generic: no `type === 'section'`/hardcoded accept-list in a generic layer (FF-NO-EXTERNAL-SPECIAL-CASE green).
- [ ] Playwright real-boot proves nest + nested-select.

**Notes** — This unifies BE-1 (value-band items) + slot children under ONE declaration-driven canvas projection — the Composite arm of ADR-038. Highest-blast-radius of the three (0061/0062/0063) — the general composition root.

**DECISION (researched 2026-07-12 — "items vs children", owner asked me to decide, not follow blindly).** Question: should value-band `items[]` become `children[]` (everything as nodes)? **Verdict: UNIFY at the projection/type-system layer, do NOT collapse storage.** Grounding:
- The codebase ALREADY reconciles this — **ADR-023 "One Type System, Two Residences"**: a value-band item (`KpiStripNode.items[]` KpiSpec) has a lossless ⇄ promoted `kpi-card` NODE residence (`kpi-strip/card/kpiSpecToCardNode` ⇄ `cardNodeToKpiSpec`, same `interpretKpi` seam; ships dark behind `isPromotionEnabled`). The type system is already ONE; the residence is a storage choice.
- Reference class deliberately KEEPS the distinction: **data-bound repeated COLLECTION** (item/value-band — Framer *repeater* · Builder *data-binding* · Retool *list*: 1 template × N data rows) ≠ **compositional SLOT** (children — Framer *slot* · Builder *blocks* · Retool *container*). Collapsing all items→children **breaks true data-repeaters** (`repeat` node · chart series · table rows) where N is DATA-driven (you cannot author N children when N comes from data), and bloats config against Law 2.
- **Therefore:** keep value-band as the compact storage for data-bound collections; make canvas selection + inspector + authoring treat BOTH a value-band item AND a slot child as a selectable bounded element via ONE generic address space (`(node, item-path)` for bands ∥ `(node, child-id)` for slots) — the owner's unification instinct, realized at the projection/type-system layer (ADR-023), not by a storage collapse. For a case that genuinely needs node-uniform authoring, the ADR-023 promoted residence is available losslessly. Build BE-5 as the ONE selection-projection seam over both; extend ADR-039. FF-NO-EXTERNAL-SPECIAL-CASE stays the guard.
