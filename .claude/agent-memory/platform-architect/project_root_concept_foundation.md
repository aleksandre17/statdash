---
name: project-root-concept-foundation
description: 0067 Fable root-concept study — verdict MIS-FACTORED + one missing primitive (the Part grammar/port); wrapper-vs-leaf = derived predicate not kind; owner gates D-F1/2/3 pending
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md` (I am sole author, 2026-07-12, card 0067) is the settled root-concept diagnosis. Owner had halted leaf-work ("going in circles"); asked TOO MUCH or TOO LITTLE architecture.

**Verdict:** BOTH, causally linked — UNDER-built at the root (ONE missing primitive: "element HAS PARTS" as a single grammar + port) and OVER-built above it (four containment grammars: slots / props value-bands / sourced bands / chrome regions; three selection species; two anchor mechanisms; TWO in-tree theories of the KPI card — ADR-023 R2 shadow promotion (`kpi-card` slice + `promotionMode`, flag-dark) vs ADR-038/039 BE-1 band selection (live, verified) — the smoking gun of the circle).

**Wrapper-vs-leaf (owner's intuition):** ESSENTIAL (Composite canon) but ACCIDENTALLY placed — smeared across 5 disagreeing signals (sliceType, canHaveChildren, slots, itemSchema, META.band). kpi-strip = kind-leaf but contract-wrapper; filter-bar = tree-leaf whose parts live in page SSOT. Canonical fix: wrapper ⇔ contract declares ≥1 part field (derived predicate, never a stored kind).

**Benchmark result:** field converges on ~3 roots (uniform node · registered contract · children AS a contract field — Puck slot-as-field-type is the crispest; Builder blocks input, Gutenberg InnerBlocks, RJSF recursion). NO leader has a second containment grammar or a separate authoring taxonomy.

**Proposal (ROOT-1..4):** Element (built) · Part grammar (unify SlotDef/itemSchema/BandDescriptor into ONE PartField concept; residence = property of the FIELD per Puck's law — `META.band` node-level placement is a named mis-seam) · Part port (engine-level generalization of BE-4's BandSource: enumerateParts/writePart, one address `(nodeId, partPath?)`, one anchor; slot/value/sourced adapters — BE-1/4/5 become adapters) · Facet (keep; Promotion Law reframed RENDER-side only — authoring reach is residence-independent under the port). New FFs: FF-ONE-PART-GRAMMAR · FF-RESIDENCE-AT-FIELD · FF-DERIVED-CONTAINMENT. Zero config migration.

**How to apply:** no code lands until owner picks direction. Gates: D-F1 adopt roots (rec yes) · D-F2 retire kpi-card shadow promotion OR keep flag-dark for render facets only — ONE answer must remain · D-F3 port-first vs land held BE-4 as-is (rec port-first; BE-4/0062 is held uncommitted for this). If Option A adopted: extends (not forks) ADR-038/039 + [[project-object-model-canon]] ("Two Residences" → "One Part Grammar, N residences") + [[project-adr038-trunk-state]]. Reform 0066 leaf-grind stays paused pending the call.
