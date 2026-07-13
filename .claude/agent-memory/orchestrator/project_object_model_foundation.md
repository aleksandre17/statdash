---
name: object-model-foundation-reform
description: The Part-grammar/Part-port object-model FOUNDATION reform (0067 diagnosis → 0068 build) — the root fix that ends the BE-1..BE-4 leaf-bridge circle
metadata:
  type: project
---
The object model is being re-seamed onto ONE root primitive. Owner GO 2026-07-12.

**Root cause found (Fable diagnosis, `docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md`, card 0067):** the platform never declared "an element HAS PARTS" as a single grammar+port. Its absence forced FOUR containment grammars (tree `slots` · `array+itemSchema` value-bands · `META.band` sourced · chrome regions), THREE selection species (`selectedNodeId`/`selectedItemPath`/`chromeSel`), and TWO live theories of the KPI card (ADR-023 shadow-promotion flag-dark vs ADR-038/039 BE-1 band, both in-tree). That is THE circle: every "X isn't an object" (KPI card→BE-1, filter→BE-4, section child→BE-5) got a per-kind BRIDGE instead of a declaration.

**Direction chosen (Option A · card 0068):** keep the declaration trunk verbatim (ObjectMeta/schema/caps/variants/objectRegistry — matches Builder/Puck/Gutenberg 1:1); ADD ROOT-3 the engine **Part port** (`enumerateParts`/`writePart`, one `(nodeId, partPath?)` address) + ROOT-2 unify the four grammars into ONE `PartField` with **residence on the FIELD, never the node** (Puck's law); CUT kind-as-mechanism (`panel` vs `node`), node-level `META.band`, the second anchor, the hand roster. **Wrapper/leaf = DERIVED predicate** (declares ≥1 part-field), never a stored kind — this resolves the owner's long-standing "wrapper vs single element" intuition (it was ESSENTIAL but smeared across 5 disagreeing signals).
- **D-F2:** retire the `kpi-card` shadow promotion (`promotionMode.ts` + `panels/kpi-strip/card/`); BE-1 band is THE authoring answer. Promotion Law → RENDER-side only.
- **D-F3:** PORT-FIRST. BE-4 (0062) is HELD uncommitted → re-homes as the first `sourcedParts` adapter one layer down.

**Why:** stop leaf-grinding; lay the canonical foundation so a NEW kind (table columns, hero cards, chrome items) is a DECLARATION, not a bridge — the circle ends structurally.
**How to apply:** Strangler-Fig, alias/re-export discipline, ZERO config migration, platform GREEN + reversible each phase (Law 7 — NOT a rewrite). New FFs: `FF-ONE-PART-GRAMMAR`·`FF-RESIDENCE-AT-FIELD`·`FF-DERIVED-CONTAINMENT`; `FF-COMPOSITE-INTEGRITY`/`FF-NO-EXTERNAL-SPECIAL-CASE` stay green. Extends [[trunk-over-leaves]]; supersedes the BE-x-as-endpoints framing — they are now three adapters of ONE port.
