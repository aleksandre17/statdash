---
name: project-gdp-page-dim-underspecification
description: The front-config risk when GDP_ANNUAL becomes 4-dim — GDP page panels filter by measure+time only and the obs route does NOT aggregate (dim_key @> containment returns raw rows)
metadata:
  type: project
---

The GDP page (`id:"gdp"` in `apps/api/provisioning/geostat.provisioning.json` ~line 2356) declares filterSchema context dims of ONLY `{time, fromYear, toYear}` — NO measure/geo/approach control. Its panels' DataSpec queries pin only `measure` + a `time` filter (e.g. `query.measure:"GDP_GROWTH"`, or `query.measure:["OS_GROSS","D1","MIXED_INC","NET_TAX_PROD","GDP"]` with `filter.time.$ctx`).

The observation read route (`apps/api/src/routes/stats/observations.ts`) does **NO server-side aggregation**: it is `WHERE dataset_code=$1 AND dim_key @> $filter::jsonb` (GIN containment) returning RAW rows. The renderer pipe (derive/sort/lookup) does not SUM either.

**Consequence (the detail that bites):** a query pinning only `{measure,time}` against a dataset with UNPINNED dims returns one row per unpinned-dim combination. On the current 3-dim GDP `[measure,geo,time]` this already works only because geo has effectively one series the page wants (or seed had a single geo). On a real 4-dim GDP `[time,approach,measure,geo]`, pinning `{measure,time}` returns geo×approach rows → duplicated/garbled series, NOT a single value.

**Why:** confirmed by reading the GDP page config + observations.ts during the dogfood-ingest plan.

**How to apply:** if real GDP becomes 4-dim, the GDP page config MUST pin `approach` (and `geo`) in every panel query (e.g. `approach:'_T'/total`, `geo:'GE'`) OR expose them as filters — else render breaks. ACCOUNTS/REGIONAL keep the same dim SET as their seed, so their page queries stay valid (confirm each panel still pins all non-time dims it relies on). This is a frontend-specialist task, gated behind a real-browser probe BEFORE any live cutover. See [[project_live_provisioning]].
