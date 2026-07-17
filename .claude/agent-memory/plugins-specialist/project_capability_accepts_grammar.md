---
name: capability-accepts-grammar
description: Composition nesting is a capability grammar (HTML5 content model), not per-slice accepts type lists — how to make a new content block placeable
metadata:
  type: project
---

Composition/nesting ("what nests in what") is a CAPABILITY grammar, not a hardcoded per-slice `slots.accepts` type list. Modelled on the HTML5 content-model standard.

**The mechanism (all in `packages/react/src/engine/slice-meta.ts`):**
- A slot declares its content model via `SlotDef.acceptsCaps: string[]` (capability set) and/or `accepts: string[]` (identity type list). The ONE membership predicate is `slotAdmits(slot, {type, caps})` — a DISJUNCTION: admitted iff `type ∈ accepts` OR `caps ∩ acceptsCaps ≠ ∅`. Neither declared ⇒ open (any child).
- The placement capability token is **`flow`** (NodeCap / `CAPS.FLOW`) = "flow content" — a page-content block admissible in any generic content region. Distinct from behavioural caps (export/collapsible/etc): it answers "WHERE may I be placed".
- `section.children` declares `acceptsCaps: ['flow']` (no concrete type list). Content blocks declare `caps: ['flow']`.

**How to apply:** To make a NEW content block placeable in a section (and page-body via auto-wrap), DECLARE `flow` in its meta `caps` — ZERO edit to section/page (OCP). Do NOT add the type to any container's `accepts` list (that's the retired anti-pattern). Page-STRUCTURE (page-header, filter-bar, perspective-bar, section, repeat, page roots) deliberately does NOT declare `flow`, so it stays excluded from generic content regions. featured-slider/stats-carousel are intentionally non-flow (page-top content, still homeless by design).

**Consumers routed through `slotAdmits` (one SSOT):** `nestAccepts` (apps/panel `insertNode.ts`, drop/palette gate), `renderNode` slot-placement warning (engine), `FF-COMPOSITE-INTEGRITY` + `FF-CAPABILITY-ACCEPTS` fitness (apps/panel canvas). The port projects `acceptsCaps` onto `PartField` (`partFieldsOf`).

Rejected alts (recorded so they're not re-litigated): (1) widening `section.accepts` to a bigger hardcoded list — the anti-pattern, not a grammar; (2) a new generic `content-container` node — heavier structural change + config migration, and still just moves the list.
