---
id: "0058"
title: "FF-GROUP-FIELDS-EXIST — projection-integrity: a node's PropertyGroup must not reference an undeclared field"
status: backlog
class: G
priority: P2
owner: —
implements: ADR-038 projection integrity (a projected surface may not reference a field the element never declared)
depends_on: []
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
---
**Goal** — Generalize a real bug the ChartSchema drain already fixed in the concrete: `ChartGroups` referenced `view.legend` / `view.tooltip` — keys absent from `ChartSchema` — so those Inspector groups silently rendered nothing. Add the invariant as a gate across ALL node schemas: every field named in a node's `PropertyGroup[]` (and every `showWhen` ref) must exist in that node's declared schema. Silent-drop = fail.

**DoD**
- [ ] FF exists + registered; iterates the node registry.
- [ ] RED against a group referencing an undeclared field (fixture); GREEN on HEAD (chart-drain already corrected the live `ChartGroups`).
- [ ] `tsc -b --force` EXIT 0.

**Notes** — Cheap, high-signal projection-integrity gate. Complements FF-SCHEMA-COMPLETE (which proves fields ARE authorable) by proving the GROUPING references only real fields. Independent of 0056/0057.
