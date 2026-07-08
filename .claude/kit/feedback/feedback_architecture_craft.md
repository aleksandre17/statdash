---
name: architecture-craft
description: "Architecture craft: elevate to best concept, adopt standards fully, canonical naming, platform-grade verticals, reference=result"
metadata: 
  node_type: memory
  type: feedback
---

# Architecture Craft: Elevate, Adopt Fully, Name Canonically

The existing architecture always bends UP to the best concept — never the reverse. This is the standing conceptual bar for every fix, name, and rollout, in every domain.

## Adapt architecture to the best concept — reshape up, never bend the concept down

**Rule:** when fixing or improving anything, find the canonical, best-in-class concept FIRST, then reshape the existing architecture to it. A locally-clean fix that preserves a mediocre pattern is rejected — relocating a smell is not the same as reconceiving it.

**Why:** a rejected fix example: a magic-key violation (`vars['_pageColor']`) was "fixed" by moving it to a differently-named bag (`presentation['color']`) — still a generic layer imperatively special-casing each concern. The standard: "the existing bends to the best, never the reverse," across everything, everywhere — not a design-only rule.

**How to apply:**
- Frame every task at the conceptual level — "what is the canonical, best-in-class way the best platforms/standards model this?" — then migrate to THAT. Never anchor a task to "rename/relocate/typed-ify the current pattern."
- Shared/generic layers (renderers, engines, registries) must be CLOSED for modification, OPEN for extension (OCP) — a new concern is a new registered capability, the shared body untouched. A fix that makes a shared layer grow an `if thisConcern` branch or special-case a named key is wrong; reach for the polymorphic/registry/declarative model the codebase already uses elsewhere.
- A mechanically-framed task ("decompose for SRP", "refactor this file") produces mechanical relocation — every dispatch must explicitly mandate conceptual depth: find the canonical concept, eliminate the root-cause hardcode (not move it), reveal senior/architect-level foresight. "Best" must be VISIBLE in the output, balanced by YAGNI (depth is not gold-plating).
- Genericity reflex: whenever a helper/hook/type/module is created, ask "is this generic — reusable by other elements, now or future?" If yes, it belongs in the SHARED layer, never trapped in or named after one element's folder. A privileged/element-named module holding generic vocabulary is a smell to split and de-privilege.

## Canonical semantic naming — names carry domain-standard meaning, not borrowed jargon

**Rule:** every name (node type, plugin, class, token, config value, i18n label) must say WHAT THE THING IS using its canonical/domain-standard term — never borrowed generic web/marketing jargon, never an arbitrary label. Names are architecture, held to the same bar as structure.

**Why:** a `hero` node was really a page-intro/banner with entry-cards — "hero" is borrowed marketing jargon, not a stats-dashboard concept, and its label was a literal mistranslation, a real i18n defect a naming pass should catch.

**How to apply:**
1. Audit all names for semantic + canonical accuracy: node/plugin types, class prefixes, tokens, config discriminant values, i18n labels.
2. Rename to the canonical term that reflects the thing's real role, under one consistent taxonomy decided by the architect, not ad-hoc per name.
3. Architecture leads, so legacy conforms to the vision, never the reverse — execute renames as a Strangler with zero regression: type literal + folder + registration + every reference + i18n labels move together, gated and verified.
4. Don't be timid about a deliberate, improving rename when there's a revert-net.

## Maximal adoption doctrine — adopt fully, complete every layer, nothing unused

**Rule:** if a concept strengthens the platform's capabilities, adopt it FULLY, never partially; proactively hunt for powerful concepts not yet adopted; what's adopted must be COMPLETE — used on every layer, nothing left unused.

**Why:** a "cathedral without a congregation" (a built, fitness-locked capability with zero production consumers) is a violation, not an acceptable YAGNI deferral — never frame partial adoption as "conscious deferral."

**How to apply:**
- "Mechanism shipped, adoption pending" is REMAINING WORK at full priority — plan the full every-layer wiring plus a real consumer plus a fitness function that proves it's actually used.
- Completion discipline: a capability is done only when a fitness asserts a real runtime consumer exists.
- The one boundary: "adopt fully" ≠ "open every speculative door" — an empty fitness-locked door is itself unused, so adopt a concept WITH its real consumer, never as speculative machinery. Still separate genuinely-strengthening concepts from incumbent-specific cruft.
- Removing a dead half-thing (an unused discriminant with no resolver, a redundant duplicate path) is itself a valid form of "nothing unused" — completion can mean delete, not only wire.

## Platform-grade whole vertical — every tier at the same maximal bar

**Rule:** a capability is not done when it works only in the renderer. The SAME maximal bar applies to every tier: the renderer (how it renders), the authoring/Constructor layer (how a non-engineer authors it with no code — inspector controls, registries, validation visible in the authoring UI), and the API/provisioning layer (how it's persisted, served, validated — refs-exist, illegal states unrepresentable, fail-fast). The bar itself: competitive with the strongest reference platforms (Tableau/PowerBI/Looker/Cube/Malloy/Vega-Lite/SDMX), forward-leaning, future-proof, flawless. Require the whole vertical in every capability brief — never renderer-only.

**Foundational/irreversible decisions get special treatment:** don't rush, don't build first — a deliberate, read-only exploration plus a critical red-team/synthesis pass (a different lens) comes first, grounded in real reference-platform concepts and how those teams solved their problems, reasoning across both a future-lens and a problem-lens. The team decides with senior conviction and brings ONE decided architecture (not a menu); the owner ratifies the single irreversible call. Decide adopt-now vs defer-behind-a-named-door on the real data plus the maximal-adoption doctrine (orthogonality / a real consumer, never speculative axis-count).

## Elevate, don't patch — proactive design vision, not reactive defect-fixing

**Rule:** for UI/responsive/design work, "fix the breaks" is the FLOOR, not the goal — elevate the whole design to the highest market standard, coherently and proactively, without being told.

**Why:** a responsive pass that fixed real defects was still rejected as "not the best responsive design" because it was reactive CSS-patching: it over-corrected the page measure (making inner pages feel squeezed), it missed an obvious quality issue (a fixed-column KPI grid instead of an intrinsic `auto-fit minmax` grid) that was deliberately left uncaught as a test, and it ignored the platform's own layout capabilities.

**How to apply:**
1. Evaluate the WHOLE UI as a senior product-designer + architect and raise it to best-in-class (Tableau/PowerBI/Looker/Stripe-dashboard-grade) — not a defect checklist.
2. Use the platform's own layout-node system (grid, columns, stack, row, wrap, card, spacer, divider) — the platform should eat its own dog food, composing with these over ad-hoc CSS.
3. One common design guideline: every element obeys a single design-language spine (measure, spacing scale, intrinsic responsive grids, container-queries, breakpoint tokens).
4. Be proactive — observe cramp/squeeze/imbalance/illegibility without being told, via real-browser checks across the full breakpoint ladder.
5. Intrinsic beats breakpoint: fixed column counts and hard max-width caps are the smell; prefer fluid `clamp()`, `auto-fit/minmax` grids, and `@container`.
6. The 3-tier style-override cascade, applied uniformly on every node: the plugin element ships an ideal responsive default (full breakpoint coverage, perfect with zero config) → the JSON config/styles override it (responsive-aware) → any inner node can override its outer node's style, again via config/style (inner wins on specificity).
7. Compose structure via layout nodes, never bespoke section/page divs — page/section structure is layout-node composition with one consistent handwriting; bespoke divs are retired via Strangler.

**Recurrence lesson:** the same feedback recurred because a later brief was narrow again (fixed specific sizing issues, missed the vision) — the failure was the BRIEFING being narrow, not the executing agent under-thinking. Actively inject this vision into every UI/responsive/composition brief; never ship a narrow fix where elevation was wanted.

**Hard constraints (apply to every change, in every domain):** vision, individualism, and criticality must SERVE improvement and the highest-standard research — and must NEVER produce regression, hardcoding, over-rigid blueprinting, antipatterns, static-ization (killing responsiveness/extensibility), or any degradation. Every change is held to the full converged green-gate plus real-browser verification before it ships; anything that degrades an existing guarantee is rejected/reverted, never relayed onward.

## Reference result, not implementation — a screenshot defines WHAT, never HOW

**Rule:** a visual reference (screenshot, existing version, competitor) specifies the RESULT wanted — what the UI should look like — never HOW to build it. Wanting it to look a certain way must never be satisfied by dropping quality.

**Why:** matching a reference by hardcoding, per-screen special-casing, or duplicating a primitive the core already owns is exactly the drift that causes regressions (a lossy axis hack, two rival rendering engines for the same job, effects lost in a "byte-identical" migration).

**How to apply:** the RESULT must equal the reference; the PATH must be the highest-concept architecture — declarative/config-driven, DRY/single-source-of-truth, no hardcoding, no anti-patterns, all conditional logic (visibility/perspective/effects) properly covered. Always refine/elevate the EXISTING code (Strangler) toward the best concept — never rewrite-from-scratch and never hardcode-to-match the picture. Treat this as a standing Definition-of-Done on every render/UI item, with a QC pass filtering specifically for hardcode/DRY/anti-pattern violations.
