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

**SEMANTIC FINDING (verify-first 2026-07-12 — build it CORRECTLY, not blindly).** A naive "every `groups[].fields` entry ∈ `schema[].field`" gate is WRONG and would false-RED. Root: `NodeRegistry.getSchema` returns ONLY the declared `meta.schema` (no augmentation), and the Inspector's `groupFields` filters group fields by schema membership (`byField.get(fp)`). BUT groups legitimately reference **system dot-paths** that are NOT schema fields — `view.toggle`/`view.defaultOpen`/`view.noCollapse`/`view.width` and `variants.emphasis` (e.g. `SectionGroups`), where `view`/`variants` are EXCLUDED system keys (per schema-contract's SystemKeys). The chart bug (`view.legend`) was different: `legend` is a REAL top-level `ChartSchema` field mis-referenced as `view.legend`. **So the correct gate:** a group field is valid iff it is (a) a declared schema field (exact), OR (b) a KNOWN system-authored path (`view.<knownViewProp>`, `variants.<declaredVariant>`) — and INVALID when its top-level looks like a schema concept but the exact path doesn't resolve (the `view.legend` class: `legend` exists top-level but `view.legend` does not). Needs: the canonical set of system-authored `view.*` props + how the Inspector actually renders them (a `view`-control mechanism vs the schema path — trace `FieldControlRegistry`/a view section). Until that's pinned, the gate would be a false-red. DEFER to a correct build with these semantics resolved.
