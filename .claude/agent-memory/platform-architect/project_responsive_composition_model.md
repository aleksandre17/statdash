---
name: project-responsive-composition-model
description: Ratified owner-vision model — declarative responsive composition = ONE grammar (structure ⊥ style), resolveStyle merge + 3-boundary @layer, layout-node SSOT
metadata:
  type: project
---

Owner's core architectural vision, elevated in `platform/work/DESIGN-responsive-composition.md` (design-only, my authorship). The owner's A (3-tier style cascade) and B (layout-node composition SSOT) are ONE model: **a grammar of composition** where *structure* (layout nodes) and *style* (NodeStyles) are the two orthogonal axes of one node, resolved by ONE cascade. Ties to the orthogonality law ([[feedback-maximal-orthogonality]]).

**The canonical cascade (SSOT precedence, lowest→highest):** `resolveStyle(node,ctx) = mergeResponsive(① registryDefault(type) ② ctx.distributed ③ node.view.styles ④ ctx.placement)`, a deep per-breakpoint later-wins merge, output through the EXISTING `applyNodeStyles` var+flag engine (no new runtime CSS). Precedence GUARANTEED by a scoped CSS `@layer engine.reset, tier1-default, tier2-config, tier3-override;` — NOT a full-sheet reorder (YAGNI).

**Root cause of the owner's "keeps becoming a challenge":** precedence today rests on the fragile inline-var-beats-stylesheet trick (`styles/src/resolvers/node.ts:114`) with NO `@layer`, so Tier-1 opaque `@container` CSS (`layout.css`) and Tier-2 config vars fight on specificity + import order. `@layer` + one style representation (NodeStyles at all tiers = merge not fight) makes it clean by construction.

**Key current-state facts (verify before acting — tree in flux):** Tier-2 engine `applyNodeStyles` is strong/canonical (keep). TWO grid primitives = duplication: `row`/`.panel-row` (viewport media collapse, hardcoded 1280, `panel-layout.css:11,137`) is LEGACY vs `columns`/`.layout-columns` (container-query, responsive count, `layout.css:27`) is CANONICAL. Page body `.page-content` (`page-layout.css:57`) is a bespoke flex div. `align` is a DEAD capability — CSS `[data-align]` exists (`layout.css:34,105`) but no schema field on Columns/Grid/Stack and shells emit no `data-align`. Tier-3 split across `WrapStyleContext` (distributed) + `LayoutItemProvider`/`mergePlacement` (placement) — retain as transport, unify merge.

**Strangler plan P0–P5 + 5 FFs:** ONE-STYLE-CASCADE, NO-BESPOKE-SECTION-DIV, EVERY-NODE-RESPONSIVE-DEFAULT, NO-DEAD-CAPABILITY, NO-DUP-COLUMN-PRIMITIVE. Retire `row`→`columns` (B1 alias→B3 delete), page body→`stack` node (B4), wire `align`.

**Supersedes/enables:** supersedes a985 (`DESIGN-css-responsive-standard.md`) precedence-half (trick→@layer, its responsive axis kept); enables `DESIGN-panel-sizing-cqi.md`/AUDIT-BRIEF map-collapse + double-emission cleanup by giving sizing ONE home in the node model.

**How to apply:** treat this as the binding target for any responsive/style/composition work; refuse bespoke composition divs and CSS-only capabilities; new capability = schema field + emit + FF, never CSS-only.
