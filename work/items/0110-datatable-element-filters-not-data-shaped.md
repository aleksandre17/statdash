---
id: "0110"
title: "dataTable element: filters matching the bound data's structure are not ready (owner report 2026-07-22)"
status: backlog
class: G
priority: P1
owner: — (characterize in the 0109 walk; lands with DW-B core-ops + C4 Offer Port)
links:
  - work/items/0104-data-workspace-unification-and-capability-restoration.md
  - docs/architecture/proposals/DESIGN-0104-elevation-reference-class.md
---
**Goal** — Owner (verbatim): «შედიხარ დატებლე ელემენტზე, იქ არსებული დატას შესაბამისი აგებულების ფილტრაციებიც არაა მზად». On a dataTable element, the author should get filter affordances DERIVED from the bound data's actual structure (its dims/columns/members — offered, governed), and today they are absent/not-ready. Characterize the exact gap live (what IS there vs what the data's structure warrants), then land the fix through the accepted grammar: DW-B core-ops band (basic filter forward on the element) + C4 Offer Port (dim/member offers from the bound source) — NOT a bespoke table-filter widget.

**DoD** — walk-documented gap → design fold into DW-B/C4 (or a justified earlier slice) → filters offered per the element's real data structure → J-walk on a real dataTable.
