---
name: adr-data-reference-render-vision
description: Decision-grade VISION ADR on the DATA-REFERENCE + RENDERING axis — best-in-class renderer/data-model survey (Vega-Lite/Grafana/Observable Plot/Tableau/Power BI/ECharts-G2/Malloy/Cube/Looker/Superset/deck.gl/D3), our config→interpretSpec→EngineRow→applyEncoding→interpretChart deep-map, the DATA-REFERENCE-TYPES inventory (12 distinct ref mechanisms) + coherence verdict, lead/lag, and the ADAPT-UP recommendations (a unified binding grammar + first-class semantic layer over MetricRegistry). Builds on adr_config_and_render_vision + adr_constructor_vision_north_star.
metadata:
  type: project
---

# Vision ADR — The Data-Reference Model & Rendering Axis (the binding spine)

Status: PROPOSED (2026-06-24). Author: architect (Opus). Design/research only.
Builds ON (does NOT duplicate): [[adr-config-and-render-vision]] (config-object + SDUI renderer; validateConfig/JSON-Schema floor) and [[adr-constructor-vision-north-star]] (authoring/coverage). Those two own the CONFIG-OBJECT axis and the AUTHORING-COVERAGE axis. THIS ADR owns the third axis neither made first-class: **how every node references and consumes data — the data-reference model itself**, end to end (render AND Constructor).
Related: [[project_semantic_layer_n26]] (MetricRegistry), [[project_charts_split_8_1]], [[adr-element-config-schema-seam]].

**Thesis:** Our rendering pipeline is best-in-class and our encoding grammar is a faithful Vega-Lite subset. But our **data-REFERENCE model is fragmented**: a node can say "this data" in ~12 distinct, overlapping ways with no unifying grammar and no single semantic anchor. The leaders (Malloy/Cube/Looker/Tableau) converge on ONE idea we have only half-built: a **named semantic layer of measures/dimensions/metrics**, referenced everywhere, governed once. Our `MetricRegistry` (N26) is the seed of exactly that — but it is an orphan: nothing in the render path resolves through it. The recommendation is to make the semantic layer the **spine** through which the major DataSpec branches resolve, collapsing the fragmentation without bending the grammar down.

---

## 0. The rendering + data path (mapped from code, board stale)

The canonical flow (verified across `packages/core/src/data/**`, `packages/react/src/engine/**`, `packages/charts`):

```
config (NodeBase.data: DataSpec)
  └─ resolveNodeRows(node, ctx)                       [react/engine/resolveNodeRows.ts]
       ├─ resolveStore(ctx)  → CSS-cascade: pageStoreKey → stores[key] → first → staticStore
       │                       (CachedStore-wrapped via _storeCache WeakMap; async/streaming bypass)
       ├─ interpretSpec(spec, sectionCtx, store)       [core/data/spec.ts]
       │     └─ defaultRegistry.spec(spec.type).resolve(...)   (Strategy; 8 resolvers)
       │           → EngineRow[]  (neutral Record<string,DimVal>, renderer-agnostic)
       ├─ applyEncoding(rawRows, enc, lookup)          [core/data/encoding.ts]
       │     → DataRow[]  (typed: id/label/series/value/pct/color/isTotal/level/parentId/provenance)
       └─ applyPipeline(rows, node.transforms, pipeCtx)  (node-level Grafana-transform post-step)
              │
              ├─ DataTable  consumes DataRow[]  (columns: ColumnDef[])
              └─ interpretChart(ChartDef, DataRow[], ctx) [charts/interpret.ts]
                    → ChartOutput (neutral) → toApexOptions → <ReactApexChart/>
```

Key seams:
- **`DataStore` port** (`core/data/store.ts`): one unified interface (Grafana `DataSourceApi` / Cube `CubeApi` pattern). `StoreQuery` is itself a discriminated union open for extension: `val` (OLAP cell) · `obs` (multi-dim rows) · `schema` (Constructor palette) · `distinct` (dropdown options). Sync fast-lane (`querySync`) + async envelope (`queryAsync → QueryResult{state,data,error,meta}`) + optional `batch`/`subscribe`/`queryFrame`. `StoreCaps` declares batching/streaming/sync. `staticStore` = Null Object. `fromSDMX` is the only adapter boundary (Law 5).
- **`SectionContext`** (`core/core/context.ts`): the OLAP coordinate — `{ timeMode, dims: Record<string,DimVal>, locale? }`. **No privileged dimension** (Law 1): `ctx.dims['time']`, never `ctx.year`. `TIME_DIM='time'` is the single named SSOT for the one conventional key the time-axis resolvers pin via `atTime()`.
- **`extractRequirements(spec, ctx)`**: static analysis — returns every `{code,dims}` a spec WILL need without executing it. Powers `ApiStore.prefetch()` / `CachedStore.warm()` (no N+1). This is a genuine LEAD — Vega-Lite/Grafana have no static-requirements extraction.
- **Ingest (Bronze→Silver→Gold / Medallion):** raw SDMX/CSV → `fromSDMX` adapter → `DataBundle {facts, classifiers, display}` → `ExternalStore`/`ApiStore`. `Classifier` = Kimball dimension table (structural: code/parent, no display); `DisplayMap` = presentation overlay keyed by the same id space (per-locale = swap one DisplayMap). Structural/presentational split is clean and is a LEAD.

---

## 1. Best-in-class survey — the strongest data/render idea to steal from each

| Renderer | Its data-reference / binding model | The 1–3 ideas genuinely worth stealing |
|---|---|---|
| **Vega-Lite** | `data → transform[] → mark + encoding{channel:{field,type,aggregate,bin,timeUnit}}`. The channel references a FIELD by name + a measurement TYPE (quantitative/ordinal/nominal/temporal) + an inline `aggregate`/`bin`. | (1) **`type` on the channel** (Q/O/N/T measurement level) — we map field→channel but never carry the measurement type on the encoding; the renderer re-sniffs. (2) **inline `aggregate`/`bin`/`timeUnit`** on the channel — a binding can summarize without a separate transform. (3) **`layer`/`facet`/`repeat`** view operators (we defer these — correctly YAGNI for dashboards, door open). |
| **Grafana** | `DataFrame` (columnar, typed `fields[]` w/ `config`) ← `DataSourceApi.query(targets[])` → `transformations[]` pipeline → `fieldConfig{defaults,overrides}` → panel; `$variable` template refs; `DataLinks`. | (1) **`fieldConfig defaults/overrides` cascade** — we HAVE this (`FieldConfig`+`FieldOverride`, `colorMode`/`thresholds`). Parity, keep. (2) **transformations as a stacked, reorderable pipeline** — we have `TransformStep[]` at two levels (`query.pipe` + `node.transforms`); good, but the TWO levels are a coherence smell (see §3). (3) **`$variable` refs resolved at one layer** — our `$ctx` is the analogue but it's resolved in 3 different evaluators. |
| **Observable Plot** | `Plot.plot({marks:[Plot.barY(data,{x,y,fill,...})]})` — channels are accessor functions OR field names; `transform` (groupX/binX/stackY) as channel-level options. | (1) **transforms attached to the MARK/channel**, not a separate global stage — reinforces Vega-Lite's inline-aggregate idea. (2) **channel value = field-name OR accessor** — validates our "field name in encoding" choice; we correctly forbid the accessor-function form (not serializable). |
| **Tableau VizQL** | Pills on shelves (Rows/Columns/Color/Size/Detail/Filter); a pill = a field reference with an implicit aggregation + role (dimension blue / measure green); **LOD expressions** (`{FIXED [dim]: SUM([m])}`) — compute at a declared granularity independent of viz. | (1) **dimension-vs-measure ROLE as a first-class field property** (blue/green) — drives "Show Me" + valid drop targets; we derive role in `fieldSchema.ts` but it never reaches the encoding/binding as a typed property. (2) **LOD expressions** — declare the granularity of a measure independent of the viz dims (the gap our `agg` on MetricDef only barely touches). High-value, defer-with-door. |
| **Power BI** | **Field wells** (Axis/Legend/Values/Tooltips); **DAX measures** — named, reusable calculations defined once in the model, referenced by any visual; implicit vs explicit measures. | (1) **Named measures defined ONCE in the model, referenced by every visual** — THE central idea, shared with Malloy/Cube/Looker (our MetricRegistry seed). (2) **field wells as the binding UX** — already the [[adr-constructor-vision-north-star]] V5 plan. |
| **ECharts / AntV G2 / G2Plot** | G2 = grammar of graphics (`data→scale→geom→encode`); `encode({x,y,color})`; G2Plot = chart-preset wrappers over G2. | (1) **scale as a declared object** (domain/range/type) between data and mark — we leave scaling to ApexCharts; a declared scale would make axis behavior config-driven not renderer-driven. (2) validates our chart-preset registry (G2Plot's preset-over-grammar is our `ChartType` registry over `EncodingSpec`). |
| **Malloy** | A modeling language: `source` with named `dimension`/`measure`/`query` defs; queries COMPOSE and NEST; measures are reusable, joins are declared in the source. | (1) **measures + dimensions named in a source and reused** — the semantic-layer thesis. (2) **nested/composable queries** — a query result can be the source of another (we have this partially via `transform.source` but not as named composition). |
| **Cube.dev** | A semantic layer: `cubes` with `measures`/`dimensions`/`segments`; `CubeApi.load({measures,dimensions,filters,timeDimensions})` → resultSet → `chartPivot()`/`tablePivot()`. The query references SEMANTIC names, not physical columns. | (1) **the query references measure/dimension NAMES from the semantic layer**, never physical fields — the cleanest expression of the thesis. (2) **`timeDimensions` w/ granularity** as a first-class query part (vs our time buried in `filter[TIME_DIM]`). (3) **resultSet → chartPivot/tablePivot** = exactly our `EngineRow[] → applyEncoding → DataRow[]`. Parity, validates our long-format invariant. |
| **Looker / LookML** | `dimension`/`measure`/`explore` defined in LookML; governed, versioned, reused; `measure` has a `type` (sum/count/avg) + `sql`. | (1) **governed, versioned semantic definitions** — measures as a contract (ties to [[project_panel_external_product]] SemVer). (2) **measure `type` (aggregation) is part of the definition**, not the query — our `MetricDef.agg` has this shape; push it. |
| **Superset / Metabase** | Superset: dataset-level metrics/columns defined once, reused across charts. Metabase: the **notebook** visual query builder (pick data→filter→summarize→visualize, no SQL). | (1) **metric reuse at the dataset level** (semantic-layer thesis, lighter than Cube). (2) **the notebook query ladder** as the gentlest authoring model for our `query` DataSpec ([[adr-constructor-vision-north-star]] already steals this). |
| **deck.gl** | Layer **accessors**: `getPosition`/`getFillColor`/`getRadius` = functions data→visual attribute; data-driven everything. | (1) **every visual attribute is a declared channel** (position/color/size/radius) — reinforces a richer channel set than label/value/color/series for map/geo panels. (We have `map` as a placeholder chart — its binding is under-modeled.) |
| **D3** | The **data join** (`selection.data(arr).enter/update/exit`) + scales (`scaleLinear`/`scaleOrdinal`). The lowest-level binding: datum → DOM, key function for identity. | (1) **key function = stable identity** — our `applyEncoding` auto-id (`label::series`) is a key function; making the key explicit/declared would stabilize animation & diffing. (2) scales-as-objects (shared with G2). |

**Survey synthesis.** Three convergent ideas dominate the field:
1. **The semantic layer** (Power BI / Malloy / Cube / Looker / Superset): named measures + dimensions defined once in a model, referenced by every visual, governed. *We have the seed (MetricRegistry) but it is not in the render path.* THIS is the single biggest adaptation.
2. **The channel carries more than a field name** (Vega-Lite `type`/`aggregate`/`bin`, Tableau pill role, ECharts/D3 scale): measurement TYPE, ROLE, inline aggregation, and identity key belong ON the binding. *We carry only field names.*
3. **One resolution layer for refs** (Grafana `$variable`, Vega signals): all parameterized references resolve through ONE mechanism. *We have `$ctx`/`$d`/`$cl`/`$row`/`$ref` resolved by FOUR different evaluators.*

---

## 2. Our rendering + data-reference deep-map (what consumes data, how)

Every node carries data through `NodeBase` (`react/engine/types/node.ts`): `data?: DataSpec` · `transforms?: TransformStep[]` · `fieldConfig?: FieldConfig` · `vars?: VarMap` · `dataLinks?: DataLinkDef[]` · `on?: NodeEventHandler[]` · `storeKey?` · `view.scope?: ScopeOverride`. `resolveNodeRows` resolves `data` → `DataRow[]`; absent `data` → inherits `ctx.rows` (parent cascade, a CSS-like data inheritance — a quiet LEAD). Then chart/table consume the rows; `interpretChart` dispatches by `ChartDef.type` (registry, zero-switch).

Element→data→render per type: **chart** (DataSpec→rows→interpretChart→ChartOutput→Apex), **table** (DataSpec→rows→ColumnDef[] mapping, pivot when `encoding.series`), **kpi-strip** (KpiSpec→interpretKpis→cells), **map** (DataSpec→rows, geo binding under-modeled — placeholder), **filter-bar** (renders ParamDefs from `filterSchema`, NOT its own data), **text/layout** (no data; pure composition). The long-format invariant holds throughout: data is never pivoted; `encoding.series` tells the renderer how.

---

## 3. THE DATA-REFERENCE-TYPES INVENTORY (the key deliverable)

Every distinct mechanism by which a node/element references or consumes data. For each: what it does · where · best-model verdict · improvable.

| # | Ref mechanism | What it references | Where (file) | Best model? | Improvable |
|---|---|---|---|---|---|
| **1** | **`DataSpec` union** (9 discriminants: query/row-list/timeseries/growth/ratio-list/by-mode/pivot/transform/custom) | the whole "what data" for a node | `core/config/data-spec.ts`, resolvers `registry/resolvers.ts` | The discriminated-union+Strategy+registry shape is RIGHT (OCP). But the SET is **fragmented**: timeseries/growth/ratio-list are CONVENIENCE shorthands that `query`+`pipe` could subsume; pivot is "sugar for transform+melt" (its own comment). Overlap is real. | **Collapse the convenience branches into derived sugar over `query`** (keep them as authoring affordances, resolve them THROUGH query). Reduce 9 resolvers to ~3 primitives (query · transform · by-mode) + sugar. |
| **2** | **`ObsQuery`** (`measure`, `filter`, `orderBy`) | measure code(s) + dim filters against the store | `core/sdmx.ts` | Good (SDMX Dataflow / OLAP slice). But `measure` is a raw CODE string, not a semantic name → no governance, no reuse, no unit/methodology attached at the ref. `time` is buried in `filter` (Cube makes it first-class `timeDimensions`). | **Let `measure` accept a metric-id** (resolve through MetricRegistry). Promote time to an explicit `timeDimension` shape (granularity-aware). |
| **3** | **`$ctx` ref** (`{$ctx:'dim'}`) + `$ne`/`$ctx`+`$ne` (NeCtxRef) | a runtime dim value from `ctx.dims` | `core/sdmx.ts`, resolved in `resolvers.ts` `resolveFilterForReqs` | Right idea (Vega signals / SDMX parameterised query). | Coherent. Keep. Its sibling resolvers (`$d`/`$cl`/`$row`/`$ref`) are NOT unified with it — see #11. |
| **4** | **`EncodingSpec` channels** (label/value/color/series/pct/negate/tooltip/id/isSeparator/isTotal/level/parentId/seriesFormat/seriesOrder) | obs FIELD → visual channel | `core/data/encoding.ts` | Faithful Vega-Lite subset; long-format invariant held — a genuine LEAD. | **Channels carry only a field NAME** — no measurement `type` (Q/O/N/T), no inline `aggregate`/`bin`, no explicit identity `key`. Add these (Vega-Lite parity). `pct` is overloaded (3 variants) — fine. |
| **5** | **`storeKey` / `DataStore` binding** | WHICH store/cube a node reads | `NodeBase.storeKey`, `resolveStore`, `DatasourceInstanceConfig` | CSS-cascade resolution (nearest wins) is elegant; DataStore port is right (Law 5). | **First-cube-bound-wins** only; multi-store per page is `NOT` ([[adr-constructor-vision-north-star]] gap). `dataSourceBindings` (context-key→source) is modeled but thin. |
| **6** | **`TransformStep[]` pipeline** (20+ ops) at TWO levels: `query.pipe` (pre-encoding) AND `node.transforms` (post-encoding) | declarative row ops | `core/data/transform/**`, applied in resolvers + `resolveNodeRows` | Pipe-and-Filter, registry-driven, op-schemas for authoring — strong. | **TWO pipeline insertion points** is a coherence smell: `query.pipe` runs on EngineRow (pre-encode), `node.transforms` runs on DataRow (post-encode). Same vocabulary, two stages, two mental models. Document the boundary as a contract or unify the staging. |
| **7** | **`fromDim`/`toDim`** (on query/timeseries/growth) | a dim whose ctx value clamps the time range | `data-spec.ts`, `clampYears`/QueryResolver | Works. | A SPECIAL-CASE range filter expressed as two loose string fields — a weak, redundant form of a `filter` range. Fold into a proper range filter on `time` (Postel: one way to express a range). |
| **8** | **`FieldConfig` + `FieldOverride`** (unit/decimals/min/max/colorMode/thresholds, per-series overrides) | per-field DISPLAY config (not data selection) | `core/field/config.ts` | Grafana `fieldConfig` parity — clean, cascades to children. Keep. | Coherent. The threshold colorMode is a tiny binding-by-value (datum→color); fine. |
| **9** | **`vars: VarMap`** (`FilterDerive` ops: find/breadcrumbs/lookup/if-else/tree-field/contains/join-labels + `ExprVal`) | node/page derived values bound to filter state + classifiers | `core/config/filter-derive.ts` | Sandboxed grammar (no functions) — a LEAD over Retool's `{{ }}`. Grafana template-variable / Power-BI-DAX analogue. | The `source` of a derive is `DimRef | inline-array` → overlaps with #11. Coherent within itself; its ref-resolution shares no machinery with `$ctx` (#3). |
| **10** | **`dataLinks: DataLinkDef[]`** with `DataLinkParam` (`$row`/`$ctx`/literal) | a clicked-row field or filter param → drill-down/cross-filter | `core/links/types.ts` | Grafana DataLinks parity. `$row` (clicked datum) is a distinct, valid ref class. | `$ctx` here means "filter param" while `$ctx` in ObsQuery means "ctx.dims" — **same token, two scopes**. Astonishment risk (Least-Astonishment law). Disambiguate. |
| **11** | **`DimRef` = `$cl` (ClassifierRef, structural) / `$d` (DisplayRef, UI)** with `view` (byCode/items/leaves/rollups) | a codelist/display view of a dimension | `core/sdmx.ts`, `resolveDimRef` | The structural/display split is excellent (Kimball + per-locale swap). | **Yet another `$`-ref family** resolved by its own resolver. With `$ctx` (#3), `$ref` (#9 if-else), `$row`/`$ctx` (#10) → **FIVE `$`-prefixed ref vocabularies, four evaluators.** No unified "ref" concept. |
| **12** | **`MetricRegistry` / `MetricDef`** (code/label/unit/agg/parent/methodology/datasource/dims) [N26] | a NAMED metric → measure code(s) + defaults | `core/data/metric.ts` | The RIGHT idea (semantic layer, Cube/Looker/Power-BI). Provenance decorator is elegant. | **ORPHAN: nothing in interpretSpec/ObsQuery resolves through it.** It feeds `describeApp()` (palette) and the provenance MetadataPort only. It is a catalog with no binding power. THIS is the central improvable. |

Plus secondary carriers: `StoreQuery` union (#1b, the store-facing query) and `ColumnDef.key` (table column → DataRow field, a tiny ref). And `ScopeOverride` (`view.scope` — per-panel dim/compare override), a 13th: a node-local ctx mutation, valid (N37 compare).

### Coherence verdict: **STRONG GRAMMAR, FRAGMENTED REFERENCE SURFACE.**

The *grammar of graphics* half (DataSpec→EngineRow→EncodingSpec→DataRow, long-format) is coherent and best-in-class. The *reference* half is fragmented along three fault lines:

- **F-A — Too many ways to say "this measure's data."** `query`+`row-list`+`timeseries`+`growth`+`ratio-list` are five DataSpec branches that all ultimately mean "pull these codes, shape them." pivot ≈ transform+melt. The union grew by convenience, not by orthogonality. (Code smells: *divergent change*, *speculative generality* on the rarely-used branches.)
- **F-B — Five `$`-ref vocabularies, no unifying "ref" concept.** `$ctx` (dims), `$ne`, `$d`/`$cl` (dim views), `$row` (clicked datum), `$ctx` (filter param, a NAME COLLISION with the first), `$ref` (param value in if-else). Each has its own resolver. A reader cannot predict, from a `$`-token, which scope it binds or who resolves it (Least-Astonishment violation; no SSOT for "reference resolution").
- **F-C — The semantic layer is disconnected.** MetricRegistry exists but `ObsQuery.measure` references raw codes, so unit/methodology/agg/default-dims declared on a MetricDef do NOT flow into a query. The one mechanism that would COLLAPSE F-A (reference a named metric, stop hand-rolling code lists) is built but unwired.

This is not a Big Ball of Mud — each mechanism is individually clean and tested. It is **un-unified growth**: the platform accreted a reference type per need without a periodic "are these one concept?" refactor. Exactly the drift [[adr-config-and-render-vision]] §5 names as the entropy ledger, now visible on the DATA axis.

---

## 4. Lead / Lag — honest, on the data + render axis

**We LEAD:**
- **Long-format invariant + renderer-agnostic EngineRow** — cleaner than Grafana's DataFrame coupling; one row shape feeds table AND chart (Cube `chartPivot`/`tablePivot` parity, expressed once).
- **`extractRequirements` static analysis** — prefetch/warm with zero N+1. No surveyed tool has static requirement extraction from the spec.
- **Structural/presentational dimension split** (`Classifier` vs `DisplayMap`, per-locale swap) — cleaner than Tableau's blended aliasing; SDMX/Kimball-correct.
- **No-functions-in-config, sandboxed `FilterDerive` grammar** — a LEAD over Retool/Appsmith `{{ js }}` (serializable, Constructor-ready).
- **DataStore port + StoreQuery open union + sync/async/batch/stream caps** — Grafana `DataSourceApi` parity with a cleaner capability declaration.
- **Parent-cascade data inheritance** (`node.data` absent → inherit `ctx.rows`) — a quiet elegance most builders lack.

**We are at PARITY:**
- Encoding grammar (Vega-Lite subset), fieldConfig cascade (Grafana), transform pipeline (Grafana/Vega-Lite), DataLinks (Grafana), page-vars (Grafana template vars / Power-BI DAX shape).

**We LAG:**
- **Semantic layer not in the binding path** (Cube/Looker/Malloy/Power-BI/Superset all resolve queries through named measures; we don't). *The biggest lag.*
- **Channels carry no measurement `type`/`aggregate`/`bin`/`key`** (Vega-Lite, Observable Plot, ECharts carry these on the channel). We re-derive role/type downstream.
- **Time is not a first-class query dimension** (Cube `timeDimensions` w/ granularity; ours is buried in `filter[TIME_DIM]` + ad-hoc `fromDim`/`toDim` + `YearsSpec`).
- **No LOD / declared-granularity measures** (Tableau LOD, Malloy aggregate-locality). `MetricDef.agg` is the seed only.
- **Reference resolution is not unified** (Grafana `$variable` / Vega signals = one layer; ours = five vocabularies / four evaluators).
- **Geo/map binding under-modeled** (deck.gl-style accessor channels; our `map` is a placeholder ChartOutput).

---

## 5. ADAPT-UP recommendations (reshape ours toward the canonical concepts; never bend the concept down)

### R1 — Make the SEMANTIC LAYER the binding spine (the headline). [must-do, foundational]
Wire `MetricRegistry` into the resolution path so a binding can reference a **named metric** instead of a raw code:
- Extend `ObsQuery.measure` (and the convenience-spec `code` fields) to accept a **metric-id** alongside a raw code. A new `resolveMeasureRef(ref, store)` in core resolves a metric-id → `{ codes, agg, dims, unit, methodology }` from `getMetric()`, merging `MetricDef.dims` into the query filter (defaults, query-time wins) and threading `unit`/`methodology` into FieldConfig/provenance automatically. Raw codes still work (Postel: liberal in what we accept) — this is expand-contract, not a break.
- Result: unit, methodology, default-dims, and aggregation are declared ONCE on the metric and flow to EVERY panel that references it. This is the Cube/Looker/Power-BI move, in our grammar. It directly attacks F-C and shrinks F-A (you reference `metric:gdp`, you stop hand-authoring row-lists of codes).
- Door for later: hierarchical metrics (`MetricDef.parent` already exists) → drill-down navigation; LOD/granularity (`agg` → a fuller `{ agg, grain }`). YAGNI-gate both until a consumer asks.

### R2 — Enrich the encoding channel toward Vega-Lite. [should-do]
Add OPTIONAL, additive fields to `EncodingSpec` channels: measurement `type` (Q/O/N/T) carried explicitly (default-derived from `fieldSchema` role/type so existing configs are unaffected), and an explicit identity `key` (stabilizes chart diffing/animation; defaults to today's `label::series`). Consider inline `aggregate`/`bin` ONLY if a real binding needs summarization without a pipe step (else YAGNI — `query.pipe` covers it; door open). This is pure expand (no field removed), so every stored config keeps rendering.

### R3 — Collapse the convenience DataSpec branches into sugar over `query`. [should-do, Strangler-Fig]
Keep timeseries/growth/ratio-list/pivot as **authoring affordances** (the Constructor still shows friendly editors), but resolve them by **desugaring to `query`+`pipe`+`encoding`** internally rather than as bespoke resolvers. Target primitive set: **`query` · `transform` · `by-mode`** (the 3 orthogonal primitives) + a desugaring layer. This attacks F-A at the root: one resolution path, fewer code-paths to test, while the Constructor UX (the friendly per-type editors) is unchanged. Migrate one branch at a time behind a fitness function that asserts identical rows pre/post desugar. (`growth`/`ratio-list` carry real computation — they desugar to a `derive`/`window` pipe op, which already exists.)

### R4 — Unify the `$`-ref vocabularies under one declared concept. [should-do]
Introduce a single documented **Ref taxonomy** with non-colliding tokens and ONE resolution dispatcher (a `resolveRef(ref, scope, services)` that routes by scope): `ctx.dims` (rename the ObsQuery `$ctx` clearly), `param` (filter param — fixes the `$ctx` name collision in DataLinks #10), `row` (clicked datum), `dim` (`$d`/`$cl` views), `var` (`$ref` to a page var). Don't rip out the existing evaluators (Strangler-Fig); route them through one named seam so the platform has an SSOT for "what is a reference and who resolves it." Fixes F-B and the Least-Astonishment collision. This is the data-axis analogue of [[adr-config-and-render-vision]]'s "one home per datum."

### R5 — Promote time to a first-class query dimension. [could-do, behind R1]
Fold `YearsSpec` + `fromDim`/`toDim` into a `timeDimension { dim, range, granularity? }` shape on the query (Cube `timeDimensions` parity), deprecating the three loose mechanisms (expand-contract). Reduces #2/#7 to one coherent time model. Gate on R1 landing (the metric layer is the natural home for grain).

### R6 — Encode the data-reference invariants as fitness functions. [must-do, cheap]
- **FF-REF-RESOLVES:** every `$`-ref token in a stored config resolves through the unified dispatcher (no orphan ref scope).
- **FF-METRIC-FLOWS:** a panel referencing `metric:X` renders with X's unit + methodology without per-panel authoring (proves R1 wiring).
- **FF-DESUGAR-EQUIV:** each convenience spec produces row-identical output to its desugared `query` form (proves R3 safety).
- **FF-ENCODING-ADDITIVE:** the enriched EncodingSpec keeps every existing config valid (proves R2 is expand-only).
- **FF-ONE-RESOLUTION-PATH** (post-R3): the resolver registry has exactly the primitive set + registered customs (catches re-fragmentation).

---

## 6. Tie to the Constructor (every ref type must be authorable — the coverage gate)

This ADR sharpens the [[adr-constructor-vision-north-star]] coverage audit on the DATA axis. The authoring model per ref type:
- **Metric reference (R1)** → a **semantic-metric picker** (Power-BI/Looker field list): the author picks `metric:gdp` from MetricRegistry (`describeApp().metrics` already exposes them) instead of typing a code. This is the SINGLE most important non-programmer binding affordance and it now has render-path meaning. Surface metrics as a first-class palette/well source (the V5 field-wells get a "Metrics" tab).
- **Enriched encoding (R2)** → field-wells fed by `fieldSchema`/`suggestEncodings` (already derives Q/O/N/T-ish roles); the `type` becomes a visible chip property (Tableau blue/green).
- **Desugared specs (R3)** → unchanged friendly editors; desugaring is invisible to the author (a LEAD: coverage cost drops because fewer primitives need bespoke editors).
- **Unified refs (R4)** → the Retool-style **binding-chip** affordance ([[adr-constructor-vision-north-star]] Part A Retool steal): a field is a literal OR a `Ref` chip, and the chip's scope (ctx/param/row/dim/var) is chosen from one menu — one UX for all five, mirroring the one dispatcher.
- The coverage fitness (`adr-constructor-vision-north-star` #1) extends: every Ref scope and every primitive DataSpec has an authoring surface; the metric picker is `pick-don't-type` (#3) by construction.

---

## Decision

Treat the **semantic layer (MetricRegistry) as the intended binding spine** and wire it into resolution (R1); enrich the encoding channel toward Vega-Lite additively (R2); collapse the convenience DataSpec branches to sugar over `query` via Strangler-Fig (R3); unify the `$`-ref vocabularies under one declared taxonomy + dispatcher (R4); promote time to a first-class query dimension behind R1 (R5); and pin all of it with data-reference fitness functions (R6). Hold YAGNI on LOD, hierarchical-metric drill-down, inline aggregate/bin, and geo-accessor channels — doors named, not built.

## Rejected alternatives

1. **Leave the reference surface as-is ("each mechanism is clean").** Rejected: individually clean, collectively fragmented (F-A/F-B/F-C). Un-unified growth is the entropy the laws (SSOT, Least-Astonishment) exist to refuse; the cost compounds per new dataset/panel.
2. **Adopt a full modeling language (Malloy/LookML) wholesale.** Rejected: violates KISS/YAGNI for a dashboard platform and would import joins/SQL semantics we don't need. `MetricDef` is deliberately "thin — not a modeling language" (its own invariant); R1 keeps it thin and just gives it binding power.
3. **Make raw codes illegal; force every binding through a metric.** Rejected: breaks expand-contract (every stored config) and Postel's Law. Metrics are an additive, preferred path; raw codes remain liberal-accept.
4. **Replace the DataSpec union with a single mega-query (Cube-style only).** Rejected: the convenience branches are real authoring ergonomics (a statistician thinks "growth of GDP," not "query+window+derive"). Keep them as sugar (R3), don't delete them.
5. **One `$`-ref token reused everywhere by raw merge.** Rejected: that is the current name-collision (`$ctx` = dims vs param). The fix is a NAMED taxonomy with distinct scopes + one dispatcher, not fewer tokens.

## Consequences

- **Positive:** the data-reference surface collapses from ~12 fragmented mechanisms toward a coherent spine — a **named semantic layer** (governance, reuse, unit/methodology-once), **richer channels** (Vega-Lite parity), **fewer primitives** (3 + sugar), and **one ref taxonomy**. Units/methodology declared once flow everywhere (compliance Law 9 gets easier). The Constructor's binding UX simplifies (metric picker + binding chips) precisely because the model unified. New capability still = new registration (OCP preserved).
- **Negative / trade-offs:** R1+R3+R4 touch the hot resolution path — must be Strangler-Fig behind fitness functions (FF-DESUGAR-EQUIV, FF-METRIC-FLOWS) so no render regresses. R3 is the riskiest (row-identity must be proven per branch). Short-term, both raw-code and metric-ref paths coexist (Postel) — a temporary duplication that the fitness functions keep honest until raw-code authoring is deprecated.
- **ISO 25010:** maximizes **Maintainability** (modularity/SSOT — one binding spine), **Reusability** (named metrics), and **Functional suitability** (governance, units-once); trades short-term **Effort** and a transitional dual-path. **Compatibility** preserved by expand-contract (every recommendation is additive-first).

## Prioritized roadmap (must-do vs gold-plating)

**MUST-DO (the integrity + reuse spine):**
1. **R1 — semantic layer into the binding path** (`resolveMeasureRef`, metric-id in ObsQuery/spec codes, unit/methodology auto-flow). FF-METRIC-FLOWS. *Highest ROI — wires the orphan, attacks F-C, simplifies authoring.*
2. **R6 — the data-reference fitness functions** (land alongside each R as its safety net).
3. **R4 — unify the `$`-ref taxonomy + one dispatcher** (fixes the `$ctx` collision + Least-Astonishment; cheap, high coherence gain). FF-REF-RESOLVES.

**SHOULD-DO (de-fragment the grammar):**
4. **R3 — desugar convenience specs to `query`+pipe** (Strangler-Fig, one branch at a time). FF-DESUGAR-EQUIV.
5. **R2 — enrich encoding channels (`type`/`key`, additive)**. FF-ENCODING-ADDITIVE.

**COULD-DO (behind R1):**
6. **R5 — first-class `timeDimension`** (fold YearsSpec/fromDim/toDim).

**GOLD-PLATING (doors named, do NOT build now):**
- LOD / declared-granularity measures (Tableau/Malloy) — door: `MetricDef.agg → {agg,grain}`.
- Hierarchical-metric drill-down (`MetricDef.parent` exists) — door open.
- Inline channel `aggregate`/`bin` (Vega-Lite) — door: additive EncodingSpec fields; `query.pipe` covers today.
- Geo/map accessor channels (deck.gl) — door: the `map` ChartOutput is a placeholder; model when geo panels are funded.
- Multi-store per page / richer `dataSourceBindings` — door already in SiteDef; build at the 2nd-cube-per-page consumer.
- Vega-style `layer`/`facet`/`repeat` view operators — deferred in [[adr-config-and-render-vision]]; unchanged here.

**Sequence:** R1+R6 first (spine + nets), then R4 (cheap coherence), then R3 (de-fragment, gated by FF-DESUGAR-EQUIV), then R2, then R5. Gold-plating stays out with re-entry doors named.
