---
name: geostat-canonical-data-model
description: Live geostat data uses CANONICAL codes (geo _T=national, R2=Tbilisi, sector _T=total, kebab GDP measures) — NOT the ops/ seed bundle's name-codes; authoritative sources + the KPI share-denominator pattern
metadata:
  type: project
---

The LIVE geostat store queries **canonical DSD codes**, authoritatively documented in
`platform/apps/geostat/src/data/golden-canonical-alias.ts` (the static→canonical ACL):

- **geo**: `_T` = the materialised national grand-total row; `R2`..`R12` = regions
  (R2 = Tbilisi; R = static-int+1, slot 1 is `_T`). A `GE` code also exists but is
  unused by regional data. REGIONAL_GVA materialises explicit `geo=Rk,sector=_T`
  per-region totals AND one `geo=_T,sector=_T` grand total; there is **NO**
  `geo=_T,sector=<specific>` marginal row (so a share denom pinned to `geo:_T` breaks
  for a selected sector — use a leaf-sum instead, see below).
- **sector**: `_T` is the hierarchy root (leafSet expands it to all activity sectors).
- **GDP measures**: kebab canonical — `gross-domestic-product-at-current-prices`,
  `real-gdp-growth-rates`, `gdp-per-capita-usd`, **`gdp-deflator`** (approach `_Z`,
  geo `GE`; 2025 = +4.6%, obs_status `P` preliminary). Metric registry `code` fields
  ARE these canonical codes; `resolveMeasureRef` maps a metric-id → its code.

**TRAP:** `ops/seed-data/geostat/*.bundle.json` (the local seed-pipeline source) is a
STALE name-coded dataset (geo `tbilisi`, sector `AGRI`, measure `GDP_DEFLATOR`) with
DIFFERENT VALUES (e.g. Tbilisi 2024 = 42982 vs canonical 49374.7). Do NOT verify KPI
math against it. Authoritative data = `DATA/canonical/*.xlsx` (fact sheet is the last
worksheet: cols approach/measure/geo/time/obs_value/…) + `DATA/canonical/FEATURED.json`
(the governed featured-metrics curation — the SSOT for the landing slider's coordinates).

**Regional "share of national" KPI pattern (the reg-share 637% root-cause fix):** a
share DENOMINATOR must be an INVARIANT national base, never follow the selection.
- num.geo = `{$ctx:geo, $ne:_T}` (follows the picked region; unselected ⇒ leaf-sum = national)
- denom.geo = `{$ne:_T}` (ALWAYS the national leaf-sum; a bare `{$ne}` = pure exclusion,
  drops the `_T` aggregate so `_val` sums leaves). → no region = 100% (Georgia),
  Tbilisi = 53.1%. The OLD bug: hardcoded-R2 numerator ÷ `{$ctx:geo,$ne:_T}` denom that
  followed the selection. `DimFilterRef` now has a discriminated-union arm for bare
  `{$ne}` (it previously required `$ctx`); the `config-cube-contract` fitness guard
  treats a share DENOM as fan-out ('query' tier), not an under-pinned single read.

The `share` KpiTrendSpec discriminant (num/denom, 'flat' dir, 'pct' format) lets a
featured card show an absolute value + its % of a base — see [[project_action_field_ref_seam]]
for the sibling `$ctx`/`$ne` ref семантика.
