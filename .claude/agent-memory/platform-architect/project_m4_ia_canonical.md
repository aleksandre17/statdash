---
name: project-m4-ia-canonical
description: AR-49 M4 canonical-IA spec for the Strata Studio — the Guided-Canvas doctrine, the four owner ideas, and the single apps-only boundary exception (D7)
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-authoring-reconception-M4-ia-canonical.md` is the canonical AR-49 M4 spec (I am its sole author). It folds the owner's 2026-07-10 direction into the IA milestone.

**The overarching doctrine (§1.5) — "the tool leads; the user is never lost, never blocked."** Guidance by *affordance*, never wizard/gate. It is the formal successor to the deleted 3-step wizard. EXPAND capability, more canonical — not restrict. Four instruments (guided empty-states+CTAs, readiness signals, suggestions, a legible Navigator) are all *projections of registries/graphs we already own* (capability registry, `computeMetricImpact`, save-guard) so guidance is self-maintaining + fitness-checked. The ONLY permitted block is *structural impossibility* (can't bind to a node whose container doesn't exist — already a mechanical no-op in `insertNodePatch`), never *workflow order* (FF-NO-WORKFLOW-GATE forbids the wizard's return).

**The four ideas → spec sections / waves:**
- Idea 1 page-type at creation → §2.8 / Wave 9. Lift existing `features/templates/StarterTemplate` → `PageTypePreset` registry (config data, Law 1/2); `blank` type mandatory (parity guardrail). Optional additive `page.meta.type` (D6, expand-contract).
- Idea 2 hierarchy "chrome-first" → §2.9 / Wave 10. Reframed as *non-blocking*: the whole hierarchy (frame→section→node) legible in `outline/OutlineTree` + readiness dots; NOT a hard gate.
- Idea 3 full config from interface (the keystone) → §2.10 / Wave 8. The seam ALREADY EXISTS: `inspector/Inspector.tsx` is a generic schema-renderer over `nodeRegistry.getSchema` via the `SchemaSource` port (Seam-2). Work = *completeness gate* (FF-SCHEMA-COMPLETE), not reinvention.
- Idea 4 right-dock dead space → §2.11 / Wave 7. `studio/RightDock.tsx` has a fixed 160px empty island + always-stacked page panes (the void + 3× empty-states). Fix = tri-context one-dock (node/chrome/Page) + schema-group tabs + fill-by-construction.

**Key architectural facts (verified in code, not just proposed):**
- Inspector = generic PropSchema renderer already built (Seam-2). Schema is co-located with each element as SSOT (e.g. `HeroSchema` beside `interface HeroNode` in `packages/plugins/nodes/hero/default/HeroNode.ts`). Top-level coverage is good but UNGATED; nested/array items (e.g. `cards: HeroCardDef[]`) render as opaque `array` — incomplete + ungated.
- Owner refinement is correct: NEVER runtime-reflect TS types (erased). Register explicit PropSchema + assert completeness at COMPILE time (`AssertSchemaCovers`) + runtime non-empty gate.

**Idea 6 (2026-07-10) → companion `docs/architecture/proposals/SPEC-M4.1-contextual-authoring.md`** (main spec is at the 450-line hard ceiling — bloat hook `md`=300×1.5; folded idea 6 into a companion + ONE net-zero cross-ref line in the main spec). Unifying law: **"contextual relevance in every surface"** (left dock = ADD / right dock = EDIT / canvas+Navigator+breadcrumb = GO) — the left-dock twin of Wave 7's right dock; extends §1.5 by reference.
- **Thread A (context-aware Insert palette) = APPS-ONLY, not a one-way door.** Accept-set seam ALREADY declared: `SlotDef.accepts` on `NodeSliceMeta/PageSliceMeta.slots` (Builder.io slots) + `getMeta().canHaveChildren` (leaf discriminant; panels pin `false`). Apps predicate `nestAccepts()` in `canvas/insertNode.ts` is the SSOT (shared by Outline drag + palette drop + `resolveInsertParent`). The RULE exists but only NEGATIVELY — `resolveInsertParent` silently redirects an incompatible insert to page-top (the owner's silent-fail). Fix = positive palette filter + refine `nestAccepts` to gate on `canHaveChildren` (it currently conflates leaf vs open-container: slot-less → permissive `true`). Extends Wave 1. Decision **D-M4.1-A** (routing change, apps-only, reversible). Only arrow-crossing scenario = `SlotDef.acceptsCaps` for capability-level accept — deferred (YAGNI).
- **filter-bar nuance:** it's a LEAF node; its inner bars/controls are `sliceType:'control'` in page `filterSchema` (a different tier, not child nodes). Do NOT invent a cross-tier slot — the palette honestly offers no node-insert and nudges to the Inspector (`barIds`).
- **Thread B (drill to any depth):** selection is ALREADY any-depth (`selectNode(nodeId)` + Outline roving nav; Inspector opens at any depth). Missing = canvas drill gesture (dbl-click enter / Esc exit) + breadcrumb (pure ancestor-walk, apps-only, adj. Wave 7) + Navigator chrome tier (Wave 10). **Honest split:** select/navigate to any NODE = apps-only now; edit a nested non-node ITEM (e.g. `HeroNode.cards[]` sub-field) = gated on D7 (`itemSchema` engine PropField). No node depth unreachable.
- **New fitness:** FF-PALETTE-CONTEXTUAL (exactly the compatible child set; no silent mis-route), FF-DRILL-ANY-DEPTH (every node selectable at any depth, Inspector opens, full breadcrumb).

**Why:** Owner wants the WHOLE of Strata (incl. UI) canonical + proactively guiding, expanding capability while more organized. See orchestrator memory [[authoring-reconception]] for the broader initiative.

**How to apply:**
- Idea 3 is the keystone but has ONE honest apps-only exception (**D7**): nested `itemSchema` *rendering* needs an additive `object`/`array-of` PropField discriminant in `packages/react/engine` — OCP-clean, owner-gated, sequenced like M3's growth-noun. Tiers (a) runtime non-empty + (b) compile-time 1:1 are apps-only and ship now; tier (c) nested rendering waits on the engine seam. Do NOT casually cross the apps-only boundary for the nested case without owner sign-off.
- Everything else in M4 is apps-only (arrow untouched).
- "In no case worse than now" is a hard guardrail on every idea — each must be a strict superset (blank page-type kept, page panes re-homed not removed, no new block introduced).
- No git-commit for this work (owner deploys/pushes on their cadence).

**Reconciled from twin — two load-bearing rules:** (a) the M4 spec doc has a hard 450-line ceiling (bloat hook) — merge/tighten in place, never append; (b) **page-TYPE lives in `packages/plugins/pages/`** (registered `sliceType:'page'` slices — `inner-page`, `container-page`, `landing` variant); an apps-side `PageTypePreset` must REFERENCE that slice for identity (frame/chrome/slots derive from it) and add only structure/semantics — never re-declare frame/chrome apps-side or "landing" gets two definitions. `blank` type always present.
