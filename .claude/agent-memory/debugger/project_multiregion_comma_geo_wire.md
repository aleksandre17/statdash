---
name: multiregion-comma-geo-wire
description: Regional multi-select broken live — comma-joined geo ("R2,R3") sent as one literal wire code → 0 rows; sectors-multi collapses to region-total bar
metadata:
  type: project
---

Live regional page (192.168.1.199:3002, bundle index-Dgkq8YlB, main 36273fe): selecting
multiple regions on the map ("Sectoral structure — regional comparison" / `sectors-multi`
panel) renders a plain region-total bar identical to the `regions-bar` region-comparison
chart, NOT the intended sectors-on-x, stacked-by-region chart.

**Root cause (bucket B — real behavioral gap, static→API migration regression):**
`packages/core/src/data/store-filter.ts` `buildObsFilterParam` serializes a comma-joined
multi-value `$ctx` dimension (map multi-select → `geo:"R2,R3"`) with `String(val)` in BOTH
the `{$ctx}` branch (line ~74) and the `{$ne,$ctx}` branch (line ~64-65) → wire filter
`{"geo":"R2,R3"}`. The observations API treats that as ONE literal code (no server-side
comma split) → **0 rows**. The API DOES accept an array (`{"geo":["R2","R3"]}` → 2 rows),
and the array branch (line ~76-79) already emits arrays — but a comma `$ctx` string is never
split into that array. So the only populated superset fetched in multi mode is the
`sector:"_T"` all-region-totals slice → `sectors-multi` has no per-sector rows → collapses
to region totals; `regions-bar` also stops narrowing to the selection (shows all 11).

**Why old worked:** 191bc0e used an in-memory `ExternalStore` (apps/geostat/src/data/regional/store.ts).
Its `resolveFilter`/`matchesFilter` (store-filter.ts ~line 126-128) SPLIT comma values
client-side, so multi-select + `$ne:_T` were evaluated in memory. ApiStore's wire path doesn't.

**Fix direction:** in buildObsFilterParam, when a resolved `$ctx` (or `$ne+$ctx`) value is a
string containing ",", split into an array (same shape the array branch already emits) so the
wire carries a multi-value OR-set. Mirrors the existing comma-split in resolveFilter — make
the wire serializer and the client matcher agree (SSOT). Relates to
[[project_apistore_wire_inexpressible_filters]].

**Not bugs (verified live, same session):** served bundle is NEW (renders schemaVersion:5
manifest, perspective-bar, span-CAGR, dual-view; Last-Modified deploy-day) — server not
serving stale. KPI year-change IS reactive (2023→2015: 80883→33935). KPIs pin geo:_T/sector:_T
by design (national totals) so they intentionally do NOT react to sector/region filter — a
likely source of the owner's "KPIs don't change" report (they changed sector/region, not year).
