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

## Walk findings
> chief-engineer live walk, 2026-07-22, dev studio :3013, page=regional. Two dataTable nodes inspected: `sectors-1` (unbound) and `geo-map-0` (bound REGIONAL_GVA, real region rows). Selection reached via the node's frame handler because the canvas hitbox is collapsed — see card 0109 Symptom B. Screenshot: `work/authoring-truth/0109/C-01-datatable-inspector-behavior-filterparam.png`.

**The bound table's REAL structure (geo-map-0).** Rendered columns: `რეგიონი` (Region) · `მლნ ₾` (value) · `წილი` (share). 11 region rows (თბილისი, აჭარა, იმერეთი, …). Bound dims (from the observations query): **geo/region** (13 members), **measure** (`GVA`), **sector** (`_T`), **time** (2024). So the data-warranted filter surface = member pickers over region / sector / measure / year, sourced from the bound cube's DSD.

**What the dock ACTUALLY offers for a dataTable.** Four sections: **შიგთავსი/Content** (a column-header field + a hand-authored `სვეტები`/Columns list — add/rename/move/remove of DISPLAY columns, freeform, NOT derived from the data's dims), **მონაცემები/Data** (preliminary toggle + "bind a governed metric / open workbench" + metric palette), **სტილი/Style**, **ქცევა/Behavior**.

**The delta (the gap the owner reports).** The ONLY thing named "ფილტრი" in the dock lives under **ქცევა/Behavior → ინტერაქციები (Interactions)**: a row-click handler whose "ფილტრის პარამეტრი" is a `<select>` of the **page's** filter-param keys (`mode/year/region/sector/spanTo/toYear`) that the click WRITES TO. That is a **cross-filter interaction target drawn from the page filter schema**, not a filter over the table's own bound data. There is **zero** affordance that projects the bound source's dims/members into governed filters ON the element (no "show only these regions", no sector/measure member picker sourced from the DSD). Confirms the card's premise: the fix is the **C4 Offer Port** (dim/member offers from the bound source) forwarded through the **DW-B core-ops** basic-filter band — not a bespoke table widget, and not the existing page-param cross-filter.
- Note the coupling to 0109 Symptom B: today you cannot even *click* a table on the canvas to open this dock (its selection frame is collapsed) — so C is gated behind B for any live J-walk.

**SURFACED bug (i18n).** On `sectors-1` the Content "სვეტის სათაური" (column header) textbox renders literally `[object Object]` — a `LocaleString` object handed to a plain text input without resolution (systemic-findings #3 class). Logged in 0109 dossier too.
