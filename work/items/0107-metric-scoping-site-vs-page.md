---
id: "0107"
title: "Metric scoping — site (global) vs page-scoped MetricDefs + scoped offers + promote gesture (owner idea 2026-07-22)"
status: backlog
class: G
priority: P2
owner: —
links:
  - docs/architecture/proposals/DESIGN-0104-elevation-reference-class.md   # C4 Offer Port projects by scope; DW-A is the landing wave
  - work/items/0104-data-workspace-unification-and-capability-restoration.md
---
**Goal** — Owner (2026-07-22): «იქნებ მეტრიკებიც გამიჯნოს — კონკრეტული გვერდის და გლობალური, რომელიც ყველა გვერდს მოემსახურება». Reference-class concept: definition scoping (Power BI model vs report measures; Looker model vs Explore scope). Add a declared `scope` to `MetricDef` (`site` | `page:<id>`); offer projections (C4 Offer Port) rank page-scope first + relevant globals (kills the "200-item wall of metrics forward on the element"); a **promote** gesture lifts page → site — the same governance ladder as raw→governed promotion (0084 precedent). Extends the ADR-050 spine (Site ⊃ Page), no new grammar.

**DoD** — scope declared on MetricDef (additive, default `site` = today's behavior) · pickers/offers project by scope with page-first ranking · promote gesture live · steward sees scope; author just sees a shorter, relevant list · FF: offers on a page never rank a foreign page's metrics above that page's own.

**Notes** — Fold into **DW-A** (ONE MetricCatalogView wave) — scope is an axis of the metric IA, not a separate surface; QC-3 dedup lands in the same wave. Design detail (where scope lives in provisioning, page-metric lifecycle on page delete) = DW-A design review. Owner's dislike of "metrics pushed forward on dataTable" is the symptom this treats: relevance by scope, not a global wall.
