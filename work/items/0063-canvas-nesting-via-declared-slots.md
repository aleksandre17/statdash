---
id: "0063"
title: "BE-5: canvas nests + selects children via each element's DECLARED slots — generalize the projection to slot children"
status: backlog
class: M
priority: P1
owner: —
implements: ADR-038 Bounded Element Law — composition = a tree of declared contracts (Composite)
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - platform/packages/plugins/nodes/section/default/meta.ts
---
**Goal** — The owner: *"elements don't go into the item's children — the meta.ts's probably don't declare."* VERIFIED: the metas DO declare slots (`section/meta.ts`: `slots: SectionSlots` accepts [chart,table,kpi-strip,columns,grid,wrap,geograph], `canHaveChildren:true`; card/columns/grid/hero too). So the declaration EXISTS — the gap is that the **authoring canvas does not fully PROJECT those declared slots** into nestable/selectable children (compose an element INTO a container by its declared `accepts`; select a nested child).

**Root-cause first** — confirm where the projection stops: does the canvas read `slots.accepts` to (a) allow dropping/adding a permitted child into a container, and (b) select a nested child as a bounded element? BE-1 solved value-band items (`itemSchema`); slot children (`NodeDef[]` tree nodes) are the SIBLING mechanism — they must ride the SAME generic declaration-driven projection, not a separate path.

**DoD (VERIFIED live on :3013)**
- [ ] Composing: you can add/nest a declared-permitted element into a container (section/columns/grid) — the allowed set comes from the element's OWN `slots.accepts`, generically (no per-type list in the canvas).
- [ ] Selecting: a nested child selects as a bounded element; the dock shows only its contract.
- [ ] Generic: no `type === 'section'`/hardcoded accept-list in a generic layer (FF-NO-EXTERNAL-SPECIAL-CASE green).
- [ ] Playwright real-boot proves nest + nested-select.

**Notes** — This unifies BE-1 (value-band items) + slot children under ONE declaration-driven canvas projection — the Composite arm of ADR-038. Architect the seam so both bands and slots flow through one generic mechanism. Highest-blast-radius of the three (0061/0062/0063) — the general composition root.
