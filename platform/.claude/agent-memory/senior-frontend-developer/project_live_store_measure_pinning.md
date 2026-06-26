---
name: live-store-measure-pinning
description: On the live ApiStore path, observations route does pure dim_key containment with no measure filter or aggregation — every DataSpec/KPI must pin all scoping dims (incl. measure) in its own filter
metadata:
  type: project
---

The live data path (`packages/plugins/datasources/stats-registrations.ts` → `CachedStore` over `ApiStore`) does NOT filter or aggregate by measure the way `ExternalStore` (seed/in-memory) does.

- `apps/api/src/routes/stats/observations.ts` runs `dim_key @> $filter::jsonb` GIN containment with NO aggregation. A query that does not pin every non-time dimension fans out into one row per unmatched-dim combination.
- `ApiStore.toObsParams` (`packages/core/src/data/store-api.ts`) builds the route `filter` from TWO sources only: (1) `nonTimeDims ∩ ctx.dims`, (2) the obs `query.filter` keys. It NEVER sends `q.measure`/`q.code` to the route and does NOT post-filter rows by measure. So `query.measure` (array or scalar) is effectively ignored on the live path — scoping is done ENTIRELY by the `filter`.
- KPI `val` reads (`storeVal` → `{type:'val',code}`) are measure-filtered ONLY by `ExternalStore` (`store-impl.ts:269` `o['measure']===code`). On the live path a `val` read returns the cached slice's `rows[0]` regardless of measure. So a point/yoy/cagr KPI reads the WRONG row unless `measure` is pinned into `ctx.dims` via the KPI's `value.filter`/`trend.filter` (kpi.ts `withFilter`), and `measure` is in the dataSource `nonTimeDims`.

**Why:** ADR-STORE-001 moved stats from whole-cube ExternalStore to per-query ApiStore. The measure-aware aggregation that ExternalStore did was lost; the route + ApiStore rely on the config to pin the slice.

**How to apply:** When authoring a panel/KPI DataSpec against a live `stats` dataSource:
- Single-value reads (KPIs, single-series charts): pin EVERY non-time dim incl. `measure` in `query.filter` / `value.filter` / `trend.filter`.
- Multi-series panels (a breakdown): pin every non-time dim EXCEPT the one you want to vary; the route fan-out over that one dim IS the series set. Use a pipe `lookup {$d:'<dim>'}` for labels and `encoding.pct {sumOf:'value'}` for share (avoids a `pct.of` val lookup, which is also unfiltered on live).
- The dataSource `config.nonTimeDims` must list EVERY non-time DSD dim, else a ctx.dims pin for an unlisted dim never reaches the route filter. See [[project_panel_dataspec_editor]].
- `pct: {of: 'CODE'}` does a separate `storeVal('CODE')` — same unfiltered-rows[0] hazard on live. Prefer `sumOf: 'value'` when the returned rows already sum to the denominator.
- `obs_attribute` columns (e.g. canonical `contribution_role`) are NOT spread onto the row by `fromStatsObsRow` — only dim_key + value + obsStatus reach the row. A `derive`/`filter` expr can only reference dims/value/obsStatus, never an attribute. Negate/flag by measure code instead.
