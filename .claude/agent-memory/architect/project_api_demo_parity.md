---
name: api-demo-parity
description: Root causes blocking the NEW API/SDMX-cube statdash demo (statdash-geostat :3002) from rendering charts/labels/dynamics at OLD-version parity; the engine pipe machinery survived de-tenanting — the gaps are in the ApiStore adapter contract + seed data, not the configs
metadata:
  type: project
---

The NEW demo (statdash-geostat, http://192.168.1.199:3002, DB-provisioned from apps/api/provisioning/geostat.provisioning.json) renders worse than the OLD static-config first-tenant version (http://192.168.1.199:5171/ka). The OLD spec lives in git at commit `7a47e5d^` (pre-restructure): apps/geostat/src/pages/{accounts,regional,gdp}.{config,sections,kpis,filters}.ts and src/data/{accounts,regional,gdp}/{raw,adapter,store}.ts.

**Why:** de-tenanting (ADR-0028) moved page configs into provisioning JSON and replaced static stores with the live ApiStore→SDMX-cube path. The rich pipe machinery (pipe ops, `$cl`/`$d` refs, range-clamp) ALL survived — provisioning JSON still carries pipe:27, $d:29, $cl:10, lookup:23, aggregate:17. So the gaps are NOT config-rework gaps; they are adapter-contract + seed-data drifts.

**Root causes (evidence-grounded, verified against live API):**
1. DISPLAY CHANNEL NEVER POPULATED (labels/colors missing everywhere) — `stats` store-builder (packages/plugins/datasources/stats-registrations.ts) constructs `new ApiStore(...)` passing `classifiers` but NEVER `display`. ApiStore (packages/core/src/data/store-api.ts) has no `display` field. CachedStore.display = source.display = undefined (store-impl.ts:93). `resolveDisplayRef` (core/src/data/codelist.ts) injects ONLY `code` from the classifier entry and reads label/color from the EMPTY display overlay → `{$d:'x'} fields:['label','color']` returns `{code}` only. Labels exist in `store.classifiers` (fromStatsClassifiers carries label/color) but the `$d` path ignores them.
2. CLASSIFIER WIRE DRIFT — live `/classifiers/<dim>` returns `label:{en,ka}` (LocaleString OBJECT) + `parent_code`; `fromStatsClassifiers` (plugins/datasources/stats-api.ts) expects flat `label` string + `parent_id`. Labels become objects; hierarchy breaks.
3. OBS WIRE DRIFT — `obs_value` is a STRING ("42367.21..."), engine RawObsRow expects number|null; `fromStatsObsRow` passes it verbatim → aggregate/pct/growth math breaks. AND `seq_pos` lives in `obs_attribute.seq_pos` (snake) but fromStatsObsRow spreads only dim_key — `seqPos` never reaches the row, so accounts sort `by:'seqPos'`/derive find nothing.
4. SEED-DATA GAP — `/classifiers/aggregates` returns `{data:[]}`; accounts hero pipe joins `{$cl:'aggregates'}` for isClosing + `{$d:'aggregates'}` for measure labels. Empty → sort/group degrade, measure labels gone. Also measure codes drifted (OLD `B2G` via CODE_MAP vs new `B2G_B3G`, `D4_D1`).
5. REGIONAL `_T` POLLUTION — REGIONAL_GVA carries geo `_T` (national) alongside R2..R12. regions-bar query pins `geo:{$ctx:'geo'}` (empty→all) so aggregate-by-geo includes `_T` which dominates/replaces the per-region bars. Fix: `geo:{$ne:'_T'}`.
6. GEO DUP — geo classifier has BOTH ISO (GE-TB) and Rn (R2) for the same region (15 entries); geoCodeMap maps GE-TB→R2; `{$d:'geo'}` lookup keyed on Rn codes resolves, but ISO dupes pollute selectors.

**Map node:** OLD `georgraph` → NEW `geograph` (renamed, registered, config uses `geograph` correctly). Map emptiness is the SAME data/label root cause, not a missing node.

**Dataset codes (correct, not a gap):** accounts→ACCOUNTS_SEQUENCE[measure,account,side,time]; gdp→GDP_ANNUAL[approach,measure,time,geo]; regional→REGIONAL_GVA[measure,geo,sector,time].

**How to apply:** favor engine/adapter-level systemic fixes (display channel, obs/classifier mappers in stats-api.ts) over per-config band-aids — gaps 1-3 are platform-wide. The pipe engine is correct; do not touch resolvers. See [[project_gdp_page_dim_underspecification]], [[feedback_first_tenant_erosion]].
