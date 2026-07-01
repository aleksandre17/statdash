---
name: project-geostat-source-quirks
description: Non-obvious data-quality defects in the 3 raw GeoStat NA Excel files in DATA/ — must be honored by any Excel→canonical ingest (ADR-0030)
metadata:
  type: project
---

Verified data-quality facts about the 3 raw GeoStat National-Accounts Excel files in `DATA/` (discovered building `work/legacy-to-canonical.js`). These are SOURCE defects, not derivable from the canonical output — re-confirm against the raw files before trusting.

- **File 1 `1.National Accounts_Data.xlsx` — ENG sheet value column is YEAR-SHIFTED on the GDP balancing rows.** GEO sheet 2010 GDP = 22148.65 (correct, satisfies the GDP identity); ENG sheet shows 27896.85 (which is actually GEO's 2012 value). 24 cells affected (the `(B1g)` balancing/resource rows). **GEO sheet is the value SSOT for ALL observations**; ENG is used for labels only.
  **Why:** the ENG numeric column for the GDP row is misaligned in the source workbook.
  **How to apply:** never take obs_value from the ENG sheet; take values from GEO, labels bilingual.

- **File 1 — B6G label typo in source KA.** Same SNA code `(B6g)` carries two KA spellings: "განკარგვა**რი**" (Uses/balancing col, typo) vs "განკარგვა**დი**" (aggregate col, correct). The converter keeps first-seen + flags the divergence (does NOT silently pick). Correct spelling = "განკარგვადი".

- **File 3 `რეგიონული_მშპ_22_12_2021.xlsx` — regional ACTIVITY breakdown does NOT close to the region total.** Σ(8 NACE activities + "Other") per region ≈ region's `_T`, but differs by a large residual (e.g. Tbilisi 2010: activities sum 10326.52 vs region total 11683.95). This is EXPECTED (partial GVA breakdown; net-taxes/FISIM not in the activity rows), flagged as informational, never an error. By contrast Σ(11 regions) = the Total-GDP row EXACTLY (reconciles to <ε).
  **Why:** the per-activity table is a partial sectoral GVA breakdown, not an exhaustive decomposition.
  **How to apply:** do not treat the region/activity gap as a conversion bug.

- **File 3 is ka-only + vertically STACKED.** 11 regions (Block A, col-B ids 2-12) + 1 Total row (blank id → geo `_T`); then 11 per-region activity sub-tables in Block-A order, each preceded by paired spacer rows. One sub-table header (block 8) uses Georgian "დასახელება/კოდი" instead of "name/id" — header detection must accept both. Region EN names are curated (official), activity ids are sparse (1,3,6,7,8,12,15,16 + blank="Other"→OTH).

- **Excel file-lock hazard on DATA/canonical/ outputs.** The user frequently has the canonical `.xlsx` open in Excel (leaves `~$*.xlsx` lock files). The converter handles this with retry-with-backoff then a `.new.xlsx` sidecar + a flag — it never crashes or loses output. If a re-run "fails", check for an Excel lock before suspecting the converter.
