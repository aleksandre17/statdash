---
name: adr041-part-grammar
description: ADR-041 Part-grammar reform — Phase 6 capstone landed; wrapper/leaf derived, kind-as-containment retired, the FF-DERIVED-CONTAINMENT one-way gate
metadata:
  type: project
---

ADR-041 (The Part Grammar + Part Port, under ADR-038) unified the four containment grammars (slots · value-band · sourced band · chrome) into ONE `PartField` grammar + Part port. **Phase 6 (the SOLE one-way step) landed 2026-07-12** — wrapper/leaf is now a DERIVED predicate; no mechanism reads the KIND/FLAG for containment.

**Why:** the diagnosis (Fable 0067) — the model kept re-asking "what are this element's parts?" once per grammar; each answer was a locally-lawful bridge (BE-1/4/5). ADR-041 makes the next kind a DECLARATION, not a bridge.

**How to apply (durable seam facts, verify against code before acting):**
- **Two predicates in `packages/react/src/engine/slice-meta.ts` (exported):** `isWrapper(meta) = partFieldsOf(meta).length > 0` (ANY residence — the owner's wrapper/leaf home; kpi-strip IS a wrapper) and `isNodeContainer(meta) = partFieldsOf(meta).some(p => p.residence === 'slot')` (the node-tree drop-target answer). Both take `PartBearingMeta = Pick<ObjectMeta,'slots'|'schema'|'band'>` so `StoredMeta` (from `nodeRegistry.getMeta`) passes with no cast. `partFieldsOf` MUST stay the LAST function in slice-meta.ts — two fitness tests slice it to-EOF and raw-match for `sliceType`/`canHaveChildren`; put new predicates BEFORE it (function-hoisting handles the forward call).
- **The trap:** the plan's shorthand "isDropTarget → isWrapper" is WRONG if taken as any-residence — kpi-strip (value part) / filter-bar (sourced part) would become node-drop targets. Node containment is SLOT-scoped. The fence comment (`noExternalSpecialCase.fitness.test.ts`) already said "isWrapper … restricted to slot residence." `isDropTarget` (app `insertNode.ts`) now derives from `isNodeContainer`; byte-identical because the plugins semantic gate proves `canHaveChildren===true ⟺ declares a slot part` corpus-wide.
- **BandDescriptor (Delta 3):** kept as a thin node-level surface ALIAS; canonical form = the `sourced` PartField `partFieldsOf` emits. NOT relocated onto a field — that (retiring the last node-level residence → FF-RESIDENCE-AT-FIELD `[]`) needs a NEW field-level sourced-declaration surface form + filter-bar META migration = a reversible EXPAND step, deliberately kept out of the one-way door. `filter-bar` is the SOLE `band` user.
- **FF-DERIVED-CONTAINMENT is now hard `[]`:** engine tooth (`.canHaveChildren` reads = only `registerSlice.ts` ingestion) + app tooth (allowlist emptied, BASELINE 0) + plugins semantic tooth (non-contradiction via shipped `isNodeContainer`). Permitted permanent kind/flag homes: `registerSlice.ts` (registry-view), `objectRegistry`/`slice-meta` (declaration), plugins `catalog.ts` (palette-view — carries the facet like StoredMeta, not a decision).

**Tooling defect fixed en route:** the `ADR041-part-grammar-no-bridge` check-laws tripwire (`.claude/project.json`, glob `platform/apps/panel/src/**`, whole-file `re.search`) forbade tokens the FF suite MUST hold as BITES fixtures (`registerPartSource('kpi-strip',…)`). A tripwire whose own msg says "SSOT = the FF suite" cannot gate its own guard. Fixed at root: `.claude/kit/hooks/post-edit-laws.py` now exempts `*.fitness.*` / `*.test.*` from content `law_patterns` (mirrors the existing `.claude/project.json` self-scan skip). Production source still fully covered.

Related: [[object-meta-one-type-system]] (ADR-023 base), [[slicemeta-export-chain]].
