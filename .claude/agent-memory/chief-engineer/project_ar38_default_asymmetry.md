---
name: ar38-default-asymmetry
description: AR-38 verified invariant — DimFilterRef `default` is honored ONLY on the KPI path, never the query path; page vars resolve $ctx against filterParams (literal '') not ctx.dims
metadata:
  type: project
---

Verified during the AR-38 directional-sector-arm review (HEAD ea30c0e, 2026-07-03).

**Fact 1 — the `default` asymmetry (a design-doc trap):**
A `DimFilterRef` `{ $ctx, default, $ne }` (kpi-spec.ts:42) has `default` honored on the
**KPI path only** (`kpi.ts:57` resolveFilterVal → `return ref.default ?? ''`). The **query
path** (`store-filter.ts` buildFilterKey + matchesFilter) has **zero** handling of `default` —
it reads only `$ctx` / `$ne` / array / scalar. So a query clause written `{$ctx:sector, default:"_T"}`
would silently IGNORE the default → sector unconstrained → fetch ALL rows incl `_T` → then
`byDims` aggregation sums leaves + `_T` = **double-count**. The correct query-path form for
"pin selection, else all real leaves" is `{$ne:"_T", $ctx:"sector"}` (drops the total row
client-side). The AR-38 agent deviated from the design (which said `default:"_T"`) for exactly
this reason — the deviation is a correct root-cause fix, not drift.

**Why:** the SPEC/design doc said use `default:"_T"` uniformly; that is wrong for the query path.
**How to apply:** when reviewing any provisioning `$ctx` filter clause, check WHICH path consumes
it. KPI/val path → `default` works. Query/obs path → `default` is dead; must use `$ne` to exclude
an aggregate row. This mirrors the already-shipped geo-dim pattern (`geo:{$ctx:geo,$ne:_T}`).

**Fact 2 — page `vars` resolve `$ctx` against filterParams, not ctx.dims:**
`SiteRenderer.tsx:191` → `evalVarMap(page.vars, { filterParams: mergedFilterParams … })` and
`evalVarMap.ts:30` sets `scope.dims = ctx.filterParams`. So the regional truth-table vars
(`_xDim`/`_byDims`/`_mark` etc., testing `sector nin ["","_T"]`) see sector as the **literal ''**
(the param default), NOT the dropped-to-absent ctx.dims value. This is load-bearing: `nin` uses
strict `!==` (comparison.ts:26), so if it saw `undefined` (absent) instead of `''`, state-A
(nothing selected) would misfire into the sector-selected branch. The `''` sentinel harmony
(region & sector both default `''`) is what keeps the truth table correct.

**Fact 3 — AR-49 M0 makes this asymmetry palette-reachable (confirmed 2026-07-09, M0 review):**
The same query-vs-KPI-path split governs `MetricDef.dims` (metric default dims). On the query/chart
path `resolveQueryMeasures` merges metric default dims into the filter as defaults; on the KPI path
`readMeasure` IGNORES them (bind-parity.fitness.test.ts encodes this — KPI parity holds ONLY because
the metric's `dims` are dropped). Today it is LATENT: the 4 metrics that declare `dims`
(`gdp.finalConsumption`/`capitalFormation`/`exports`/`imports`, all `{geo:GE,approach:EXP}`) are
catalog-only (0 page references). But the Metric Palette lets an author drag such a metric onto a
KPI → the KPI silently ignores `approach:EXP` → diverges from the same metric on a chart,
contradicting the M0 DoD ("one governed number on every surface"). Follow-up: honor metric default
dims on the KPI `readMeasure` path, OR have the palette refuse/flag binding a default-dims metric to
a KPI. Pre-existing seam (AR-40), not introduced by M0.

**Data-integrity note (not a defect):** state-A chart shows Σ(leaf sectors) per geo while the KPI
shows the `_T` row directly. Equal only under SNA additivity (Σ industries == total). Same
assumption already shipped for the geo dim — verify prod chart totals match KPIs, but it is not a
code defect. See [[project_perspective_axis_review]].
