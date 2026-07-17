---
name: project-deep-authorability
description: The deep-authorability maximal target — D7 itemSchema engine seam, the two-seam nested root cause, and pending owner-gated decisions
metadata:
  type: project
---

Deep authorability ("100% nothing-un-buildable in the Constructor") is the owner's core vision push (2026-07-10). Converged spec: `docs/architecture/proposals/SPEC-deep-authorability.md`; engine change slated for **ADR-022**.

**Why:** owner said the Constructor is "very far from the spirit" — can't reach nested items (kpi items, filter selects, hero cards, chart axes, table columns).

**How to apply:** the root cause is TWO structurally different seams — do not conflate them:
1. **Nested items in a node's own props** (kpi-strip.items, hero.cards, chart axes, table.columns…) = genuine **engine gap**. `PropField` has no `itemSchema` → Inspector falls back to raw-JSON (`JsonControl`). Fix = additive `PropField.itemSchema?: PropSchema` in `packages/core/config/prop-schema.ts` (NOT a new PropFieldType — the fitness `isOpaqueNested` already keys off `'itemSchema' in field`) + generic recursive `ArrayOfControl`/`ObjectControl` in apps/panel. The 13-field `SCHEMA_TODO` backlog in `schema-completeness.fitness.test.ts §1c` enumerates exactly these.
2. **Filter-bar controls** = **reach gap, NOT capability gap**. The per-control editor already exists and is first-class (`FiltersDrawer → ParamDefEditor → Inspector`), living only in RightDock's Page context. Controls live in `page.meta.filterSchema.bars[barId].filters{}` (a page tier, sliceType `'control'`), not on the node. Fix = a node→filterSchema drill bridge; write-through to filterSchema (never denormalize onto node.props — Law 2).

`geostat.provisioning.json` is NOT a blocker (owner suspected it; confirmed clean/declarative). The open file is just visible evidence of depth the tool can't reach.

**Pending owner gates (§9 of spec):** (1) BRIDGE vs MOVE for filter controls [rec: BRIDGE]; (2) add `itemLabel` to PropField [rec: yes]; (3) inline-vs-drill weight threshold (~4 fields); (4) `OPAQUE_BY_DESIGN` allowlist = {wrap.styles, repeat.each, geograph.geoCodeMap}; (5) raw-data pipeline stays Steward-gated (honesty boundary as lens). No hard one-way doors — all additive/reversible.

**Phasing:** D7.0 engine (ADR, full ceremony, no UI) FIRST → D7.1 nested editor → D7.2 drain SCHEMA_TODO to empty → D7.3 filter drill → D8 raw-data pipeline surface (legible ingest→cube→metric spine in Model mode).
</content>
