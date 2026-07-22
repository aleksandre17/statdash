---
name: part-grammar-track
description: "ADR-041/042 Part-grammar + Part-port unification — the ONE containment grammar (Law 10). ADR-041 Phase 6 capstone LANDED (wrapper/leaf derived, kind-as-containment retired). ADR-042 Slice 0 (placePart, the MANIPULATE axis) LANDED. CONSOLIDATED from 2 sibling files."
metadata:
  type: project
---

ADR-041 unified the four historical containment grammars (slots · value-band · sourced band · chrome) into ONE `PartField` grammar + Part port (under ADR-038 Bounded-Element). ADR-042 lifts the MANIPULATE (structural-edit) axis onto that same port. Together: a new element kind is a DECLARATION, never a new bridge/grammar.

## ADR-041 Phase 6 (containment) — landed 2026-07-12, the sole one-way step
Wrapper/leaf is now a DERIVED predicate; no mechanism reads a KIND/FLAG for containment.
- **Two predicates** (`packages/react/src/engine/slice-meta.ts`, exported): `isWrapper(meta) = partFieldsOf(meta).length > 0` (ANY residence — kpi-strip IS a wrapper) vs `isNodeContainer(meta) = partFieldsOf(meta).some(p => p.residence==='slot')` (the node-tree drop-target answer — SLOT-scoped only). Conflating these is the trap: "isDropTarget → isWrapper" taken as any-residence would wrongly make kpi-strip/filter-bar node-drop targets. `isDropTarget` (app `insertNode.ts`) derives from `isNodeContainer`.
- `partFieldsOf` MUST stay the LAST function in slice-meta.ts (two fitness tests slice it to-EOF); new predicates go BEFORE it.
- **BandDescriptor** kept as a thin node-level alias; canonical form = the `sourced` PartField `partFieldsOf` emits. Retiring the last node-level residence (FF-RESIDENCE-AT-FIELD → `[]`) needs a field-level sourced-declaration surface + filter-bar META migration — deliberately kept OUT of the one-way door as a later reversible EXPAND step.
- **FF-DERIVED-CONTAINMENT is hard `[]`**: permitted kind/flag homes are only `registerSlice.ts` (registry-view), `objectRegistry`/`slice-meta` (declaration), plugins `catalog.ts` (palette-view facet).
- Tooling fix: a check-laws tripwire (glob-scanning panel src) forbade tokens the FF suite MUST hold as BITES fixtures. Root fix: `.claude/kit/hooks/post-edit-laws.py` now exempts `*.fitness.*`/`*.test.*` from content law_patterns (production source stays fully covered).

## ADR-042 Slice 0 (manipulation) — landed, additive/reversible/byte-identical, no UX change
`placePart(element, op: PlacementOp, ctx)` — the structural sibling `writePart` never got, on `PartSource` (`packages/react/src/engine/partPort.ts`). `PlacementOp` verbs: `insert|move|remove|reorder`. Replaces forked machinery (two drag transports, a `moveNode` on one residence only, a nest-vs-reorder HEURISTIC in `OutlineTree` rather than a resolved plan).
- **4 residence adapters implement it:** `slotParts` → `node-children` (thin router; tree algebra stays in store reducers); `valueParts` → `node-props` array splice; `sourcedParts` (`bandSource.ts`, page-filters) → `filter-schema`; `chromeParts` → `site-chrome` order write (minimal — full multi-region reindex deferred). Only the slot adapter is gesture-wired; value/sourced/chrome are additive/unit-tested, not yet wired to a gesture.
- `PlacementPlan` + `resolvePlacementPlan` + `planPlacement` (`apps/panel/src/canvas/insertNode.ts`) generalize `InsertPlan`/`resolveInsertPlan` (kept intact, byte-identical when `source` absent).
- **ONE commit site:** `apps/panel/src/canvas/placeNode.ts` — no direct `moveNode`/`insertNodes` calls anywhere else (FF-ONE-PLACEMENT-GRAMMAR glob-greps this).
- **Not yet built (later slices):** Slice 1 = canvas drag-to-move on dnd-kit, retire native `dataTransfer` (owner-GO-gated one-way transport flip). S2 section-de-privilege. S3 renderer-emitted anchors. S4 value/sourced/chrome gesture-wiring. S5 dock facet-tab IA. S6 data-layer isolation.

Related: [[object-meta-one-type-system]] (ADR-023 base), [[slicemeta-export-chain]].
