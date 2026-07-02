# SPEC — Regional cross-filter behavior (grounded in owner reference shots scriness/img_1,5,6,11 + img_2)

The composition panel RE-PURPOSES by selection; the comparison + KPIs + map SCOPE to selection. This is how it worked before (owner reference) and must be restored + refined.

## Regional page — per state

### State A — NO region selected (default, `geo=_T`/all) — ref img_1
- **Map:** all regions, plain choropleth (no highlight).
- **Composition panel (right):** `GDP by region` = **DONUT of ALL regions** (center = national total, e.g. 80 979); each region a slice.
- **Comparison panel (bottom):** `GDP — regional comparison` = **hbar of ALL regions**, multi-colored, ranked (Tbilisi → Racha).
- **KPIs:** national (total 80 979, share 100%, national growth).

### State B — 1–2 (N) regions selected — ref img_5 (Imereti+Shida Kartli), img_11 (Imereti, dynamics)
- **Map:** HIGHLIGHT the selected region(s) (dark), rest muted.
- **Composition panel (right) RE-PURPOSES →** `Sectoral structure — regional comparison`: **x = sectors, stacked/grouped by the SELECTED regions** (img_5: each sector a bar, stacked yellow=Imereti + orange=Shida Kartli). i.e. show the selected regions' SECTORAL composition, compared.
- **Comparison panel (bottom):** `GDP — regional comparison` = hbar of **ONLY the selected regions** (img_5: just Imereti 6270.6 + Shida Kartli 3414.9).
- **KPIs:** the selected regions' COMBINED values (img_5: 9 686 total; share vs national 12.0%).
- **Panel title** reflects the selection (img_11: "იმერეთი").
- **Dynamics mode:** the sectoral-structure **stacked-area = the selected region's sectors over time** (img_11).

### Selection semantics (the directional rule)
- **Select region → pin `geo`, DISPLAY the `sector` dimension** (region's sectors). Region-comparison collapses to the selected regions; composition switches region→sector.
- **Select sector → pin `sector`, DISPLAY the `geo` dimension** (that sector across regions) — the region-comparison shows that sector's regional distribution.
- Multi-select = up to N (2 shown); `= ANY`.

## GDP page chart types (ref img_2/img_6) — confirm/keep
- Production approach = **donut** (sectors, center = GDP).
- Expenditure approach = **waterfall/contribution bridge** (C + I + X − M = GDP; import negative, `=GDP` closing bar).
- Income approach = **treemap**.
- Capital-formation structure = **% donut**.

## Acceptance (verify by DISPLAY, not query)
- Default regional: donut(all) + bar(all) + national KPIs.
- Select 2 regions → composition = sectoral-structure of those 2 (read rendered rows = sectors, values = the 2 regions); bar = only 2 regions; KPIs = their sum; map highlights.
- Select sector → region-comparison shows that sector across regions.
- No `[object Object]`, no duplicated region labels, values match source.
