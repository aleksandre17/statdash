---
id: "0062"
title: "BE-4: filter items as bounded elements — the filter-bar's filters become declared, selectable units"
status: backlog
class: M
priority: P1
owner: —
implements: ADR-038 Bounded Element Law — generalize BE-1 (declared value-band selection) to the filter-bar
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - platform/packages/plugins/nodes/filter-bar/default/meta.ts
  - platform/apps/panel/src/canvas/bandItems.ts
---
**Goal** — The owner: *"the filtration items are also not objects."* The filter-bar's individual filters (account select, year-select, from/to, …) are NOT selectable/authorable bounded elements. Root: unlike `kpi-strip.items[]` (a declared `array`+`itemSchema` value-band that BE-1 makes selectable), the filter-bar's filters live in the page `filterSchema.bars.bar.filters` map — NOT declared as a node value-band. So `bandFieldsOf` finds nothing → no per-filter selection.

**The Bounded-Element way** — model the filter items as a DECLARED band (or the filter-bar's declared child contract) so the SAME generic `bandItemsOf`/selection (BE-1, `bandItems.ts`) projects each filter as a bounded, selectable, authorable element — deriving from the declaration, ZERO filter-bar special-case. A new control type = a new declared item, selectable for free.

**DoD (VERIFIED live on :3013)**
- [ ] Clicking an individual filter selects it as a bounded element; the dock shows ONLY that filter's contract (its `ParamDef`: type/label/options/default…).
- [ ] Achieved by DECLARATION + generic projection — no `type === 'filter-bar'` in a generic layer (FF-NO-EXTERNAL-SPECIAL-CASE stays green).
- [ ] Playwright real-boot proves per-filter bounded selection.

**Notes** — Root question to settle first: is the filter contract best declared ON the filter-bar node (a filters value-band) or does the page `filterSchema` seam need a declared projection? Architect the seam so it's ONE generic mechanism with kpi-strip's band, not a parallel path. Reconcile with the runner's `defineFilters` filterSchema (don't fork the SSOT).
