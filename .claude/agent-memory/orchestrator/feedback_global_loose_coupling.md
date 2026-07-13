---
name: global-loose-coupling
description: Owner directive — work GLOBALLY/systemically (root, not element-by-element), loose coupling everywhere (architecture AND UI), per the Fable diagnosis. Drive processes continuously when the owner is away.
metadata:
  type: feedback
---
Two standing design directives + one operating mode, from the owner (2026-07-12):

**1. Work GLOBALLY, not element-by-element.** Don't fixate on eliminating one specific element/bug — solve the CLASS at the root (the Fable ROOT concepts). Symptoms (a nav loop, "blank page only adds a section", a mis-placed dock config) are handled as expressions of the root, resolved systemically — not as isolated whack-a-mole. "რაც გითხრა ფაბლემ, გაითვალისწინე" — the diagnosis IS the frame.

**2. Loose coupling EVERYWHERE — architecture AND UI.** The Part port already embodies it engine-side (DIP/Ports&Adapters). Apply it equally to the UI/Studio: every surface (dock, palette, canvas, chrome) is a GENERIC PROJECTION of the declaration/port — never hardcoded per-element coupling. This is ADR-038's "authoring surfaces are generic projections" extended to the whole panel.

**3. Continuous autonomous management when the owner is away.** "უნდა წავიდე, არ გაჩერდე, უწყვეტად მართე პროცესები." Keep the pipeline moving via the agent-completion loop: verify → route next → repeat, no idle waiting. Design the high-visibility/subjective changes (Studio IA restructure) and HOLD the BUILD of those + any one-way door (Phase 6) for his return to react; build the clearly-correct systemic work (port wiring, making declared things reachable) autonomously.

**How to apply:** every routing/design choice asks "does this solve the class, and is it a generic projection (loose)?" See [[object-model-foundation-reform]], [[circle-break-root-study]], [[trunk-over-leaves]].
