---
name: project-part-grammar-foundation
description: ADR-041 Part Grammar + Part Port (ROOT-1..4) — the object-model foundation design-lock; the accepted cut, the phase order, and the one-way step
metadata:
  type: project
---

The object-model foundation was design-locked on 2026-07-12 (owner GO). It ends the "we're going in circles" defect: containment had FOUR parallel grammars (tree slots · props value-bands · sourced bands · chrome regions), and every BE-x (BE-1 kpi, BE-4 filters, BE-5 section) was a bridge from one grammar to the authoring machinery. The fix = ONE Part port.

**Artifacts I authored (source of truth — read these, they're richer than this note):**
- `docs/architecture/decisions/ADR-041-part-grammar-and-part-port.md`
- `docs/architecture/proposals/PLAN-part-grammar-strangler-build.md` (the phased build)
- `docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md` (the diagnosis, platform-architect authored — the §5/§6 source of truth)
- Scaffold (types-only, inert, unwired, reversible): `packages/react/src/engine/partPort.ts`

**The owner's gates (accepted, non-obvious):**
- **Option A** — adopt ROOT-1 Element / ROOT-2 Part grammar (residence-at-FIELD, N residences) / ROOT-3 engine Part port / ROOT-4 Facet (Promotion = render-side only).
- **D-F2** — RETIRE the shadow kpi-card promotion machinery (`promotionMode.ts`, `kpi-strip/card/`, `kpiSpecToCardNode`). BE-1 band selection is THE answer. FF-PROMOTION-LOSSLESS retires with it.
- **D-F3** — PORT-FIRST: engine port lands first; then BE-4's `bandSource.ts` (which is **untracked / held uncommitted for exactly this reason**) re-homes as the first `sourcedParts` adapter one layer down.

**Phase order:** 1 port+PartField-aliases (engine-specialist) → 2 three adapters + BE-4 re-home (react-specialist + senior-frontend) → 3 selection-triple collapse (senior-frontend) → 4 anchor merge (react-specialist) → 5 retire promotion (engine + plugins) → **6 derive wrapper/leaf = the SOLE one-way step, gated like ADR-023 R2 (owner sign-off)**.

**Hard invariants:** zero config migration (stored `type`-tree already uniform, `sliceType` never serializes — ROM F3); alias-reversible until Phase 6; platform green after each phase.

**DoD proof of a closed circle:** add table columns (or hero-card items) as a `value` PartField — DECLARATION ONLY, no new adapter/bridge.

**Wrapper/leaf** (the owner's recurring intuition) is resolved as a DERIVED predicate: wrapper ⇔ declares ≥1 part field. See [[feedback-architect-deliver-and-stop]].
