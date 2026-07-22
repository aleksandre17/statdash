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
**Goal (owner-clarified 2026-07-22)** — «დატაბლეში ნოდებს ვგულისხმობ — ნოდიდან რომ შედიხარ დატაზე, ხომ უნდა ჩანდეს, **რა დატაა და როგორ აიგო**». The node's data door must answer TWO questions at a glance:
1. **WHAT the data is** — source, metrics, dims, honest state = **C5 Binding Summary (wave E3)**; kills the false "not bound" (QC-2) in the same stroke.
2. **HOW it was built** — the visible step chain (Get → Filter → Derive…, 7-verb badges), NOT a bare count. **E3 scope extension (this card's contribution): `summarizeBinding` carries the named step list (label + category), the facet renders it as the build-path.** One door → the workbench for full editing. (E4's lineage door later deepens this to per-cell.)
Secondary (the original phrasing): structure-derived filter affordances on the element = DW-B core-ops + C4 offers — unchanged, lands after E3.

**DoD** — node data facet answers "რა დატაა" (honest summary) + "როგორ აიგო" (named step chain) for EVERY spec kind (total by construction, C5) → one door to the workbench → J-walk on a real dataTable node; filters part per DW-B.
