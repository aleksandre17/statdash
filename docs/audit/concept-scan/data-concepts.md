# Data / Semantic / Query / Modeling — Concept Mining Scan

> Platform-architect mining pass. Doctrine: **MAXIMAL adoption** (Law 4 to its limit) — for every genuinely-new strengthening concept, a FULL every-layer adoption plan with a real consumer + a fitness function (no cathedral without a congregation — the X-2 lesson). Analysis only; **no code changed**.
> Method: grounded first against shipped code (cited at file:line), so every card below is a concept we **demonstrably LACK**, not one we already shipped. Critical duty honored: strong concepts get a full plan; incumbent-specific cruft is refused in the SKIP list with a one-line reason.
> Date 2026-06-28. Branch `feat/tenant-agnostic-platform`.

---

## 0. Grounding — what we ALREADY have (so nothing below is re-mining a shipped capability)

| Shipped seam | Where | The mined concepts it already covers (NOT re-proposed) |
|---|---|---|
| Generic Law-1 `dim_key` cube + hypertable | `ops/postgres/migrations/V4`, V9 | OLAP fact table, degenerate-dim-free design |
| `DataSpec` union (8) + `interpretSpec` registry | `core/src/config/data-spec.ts:133`, `data/spec.ts:53` | Grafana `DataQuery` dispatch, Vega-Lite mark/encoding, "query as discriminated union" |
| Transform-step registry (19 ops, schema co-located) | `data/transform/step-registry.ts:32`, `transform/index.ts:38` | Vega-Lite/Grafana/Arquero transform grammar (most verbs), Malloy pipe |
| `$`-ref taxonomy (5 scopes, one dispatcher) | `core/src/ref/ref.ts:40` | dbt `ref()`/`var()`, Looker `${}`, Grafana `$var` — **typed**, we beat them |
| Semantic layer `MetricDef`/registry — **0 registered** | `data/metric.ts:16` (`resolveMeasureRef:129`) | Cube `measures`, Looker `measure:`, dbt metric (thin form only — see DC-01) |
| Metric→store routing (`dataSource`) | `data/metric-store.ts:79` | Cube `dataSource` (mechanism only, 0 callers) |
| Declarative blend / cross-store **one-sided** lookup | `transform/index.ts:48`, react `resolveNodeRows.ts:105` | Vega-Lite `lookup`, Grafana Mixed+join, Tableau primary/secondary — **left-only** (see DC-04) |
| Perspective axis (generic view algebra) + scope-key registry | `core/src/perspective/*`, `config/perspective-scope-registry.ts:32` | SSAS perspectives, generalized Grafana time-range |
| SDMX IM: ConceptScheme/Codelist/CategoryScheme/DSD/ContentConstraint/RefMetadata | `migrations V27/V4/V29/V26/V31` | SDMX maintainable-artefact model (deepest embedded I've seen) |
| ContentConstraint / CubeRegion **predicate-row** legal-combination model + DB⇄TS twin | `migrations/V26`, `silver region.ts` | SDMX ContentConstraint, sparse/ragged-cube modeling |
| Bitemporal vintage: release-keyed validity intervals + pre-image log + as-of SQL | `migrations/V25`, `V8` | central-bank revision database, dbt snapshot (we beat it) |
| `extractRequirements` static warm/read-key SSOT | `data/spec.ts:112`, `core/time-dimension.ts:216` | Cube `refreshKey`/query planning (exact-slice warm; NOT rollup — see DC-03) |
| First-class `timeDimension` (granularity decorative) | `data-spec.ts:114`, `core/time-dimension.ts` | Cube `timeDimensions` shape (NOT grain rollup — see DC-03) |

**Two standing facts that shape every card below:** (1) the semantic layer is the platform's biggest *empty cathedral* (X-2) — the strongest move a new concept can make is to give `MetricDef` a **reason to be registered**; (2) the engine has no declarative **grain / point-read / pushdown** vocabulary — the shared root under ENG-02/07/08. Concepts that feed those two facts rank highest.

---

## Concept cards

### [DATA-CONCEPT-01] Calculated / derived metrics — measure-algebra in the semantic layer (from Malloy, dbt MetricFlow, LookML, Cube)
- **What it is**: A metric whose value is an *expression over other metrics/measures/dimensions* — `ratio(a,b)`, `derived(x*1.1)`, `cumulative(window)`, `period_over_period(offset)` — declared **once** in the semantic model and reused everywhere, with the same governance (unit, methodology) as a base metric. dbt MetricFlow makes the metric *type* (`simple`/`ratio`/`derived`/`cumulative`/`conversion`) a first-class field; Malloy lets a `measure:` reference other measures; LookML `type: number` measures compose `${a}/${b}`.
- **Does it strengthen US?**: **STRENGTHENS — most.** Our `MetricDef` (`metric.ts:16`) is *thin by deliberate design* ("not a modeling language. No filters, no joins, no SQL") and **zero are registered**. Today our `growth` and `ratio-list` DataSpec discriminants (`data-spec.ts:173,178`) are the *only* place YoY and ratio math live — bespoke per-node, un-named, un-governed, unreachable from the semantic layer (ENG-02 flags this duplicated semantics). A calculated metric is the single concept that gives the empty cathedral a congregation: it makes registering metrics *do something a raw code cannot*, and it promotes `growth`/`ratio` from one-off specs to named, governed, Constructor-browsable metrics.
- **Fit**: Rides `MetricDef` + the existing `expr/` typed engine (`derive` already evaluates `ExprRef`). It is an **additive metric `kind`** — a `MetricDef` gains an optional `expr`/`from`-metrics field; `resolveMeasureRef` (`metric.ts:129`) already returns codes + governance, so a calc metric resolves to its *input* codes plus a post-store `derive`/`window` pipe fragment it contributes. No net-new substrate; it composes two shipped seams (semantic layer + transform pipe).
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: add `MetricKind = 'base'|'ratio'|'derived'|'cumulative'|'offset'` + the calc fields to the `MetricDef` contract (thin: `inputs: string[]`, `expr: Expr`, `window?`).
  - **core**: extend `resolveMeasureRef` to, for a calc metric, return base codes **and** a `derivePipe: TransformStep[]` (reusing `derive`/`window`/`reduce` ops — no new op needed for ratio/derived; `cumulative` reuses `window`). `extractRequirements` already walks codes → warm-planning is free. Unify `growth`/`ratio-list` resolvers to *desugar to a calc metric* (closes ENG-02 duplicated-math).
  - **charts/react**: none new — calc metrics emit normal `DataRow[]`; provenance badge flows via `withMetricProvenance` (`metric.ts:172`).
  - **plugins**: register the geostat calc catalog (GDP deflator = ratio(nominal,real); B1G CAGR = offset; YTD = cumulative).
  - **api/db**: optional — a calc metric *can* compile to a continuous aggregate (DC-03 synergy); none required for v1.
  - **panel (Constructor)**: `describeApp()` already exposes `listMetricDefs()`; the measure picker gains a "create calculated metric" affordance (expression editor reuses the visibility/derive `Expr` builder — already shipped).
  - **provisioning**: `geostat.provisioning.json` gains a `metrics{}` block (today: 97 raw codes, 0 metrics — N26).
- **The real consumer & fitness**: migrate the GDP-deflator page from a `ratio-list` spec to a `{measure: 'gdp-deflator'}` calc-metric ref. **FF-CALC-METRIC-EQUALS-SPEC** (a calc ratio metric produces byte-identical rows to the legacy `ratio-list`) + the X-2 meta-fitness **FF-METRIC-HAS-CONSUMER** (every registered metric is referenced by ≥1 config OR on an explicit shrinking deferred-list).
- **Effort M · two-way door (additive kind) · Class M · priority P1 (TOP-3 #1).**
- **Raises-the-bar**: a **JSON-authored, Constructor-editable calculated-metric layer** — Cube/Looker/Malloy/dbt all require code (`.js`/`.lkml`/`.malloy`/`.yml`). We match their semantic power *no-code*, and we unify our own ad-hoc growth/ratio specs into one governed vocabulary. Beats all four on authorability; matches on expressiveness for the metric types national accounts actually uses.

---

### [DATA-CONCEPT-02] Declarative data tests / contracts + SDMX-VTL validation & **hierarchical** rulesets (from dbt tests, Great Expectations, SDMX VTL)
- **What it is**: Author-declared data-quality assertions co-located with the dataset/metric — `not_null`, `accepted_values`, `unique`, `relationships`, `freshness`, `range` (dbt/GE) — **plus** VTL's two killer ruleset kinds: a **validation ruleset** (`check`: a boolean predicate over the cube that must hold) and a **hierarchical ruleset** (`B1G = B1GP + D1 + ...` — a code is the signed sum of its children, both *validated* and *derivable*). VTL is the SDMX-native transformation+validation algebra; its operands are whole datasets with structure-aware operators.
- **Does it strengthen US?**: **STRENGTHENS.** We have ContentConstraint (which *combinations are legal*, `V26`) and silver `validation_issue` annotations — but **no author-declared, value-level assertions** and **no accounting-identity check**. National accounts *is* a web of identities (GDP three approaches must reconcile; B1G = Σ components; balancing items sum to zero). Today nothing declares or enforces that. The hierarchical ruleset is the single most national-accounts-shaped concept in the entire mining set, and our classifier already carries the parent/child hierarchy (`V4` LTREE, `parent_code`) it needs.
- **Honest scope (the principled refusal inside the adoption)**: adopt **VTL's ruleset *concepts*** (check + hierarchical define) as declarative JSON artifacts that compile onto our transform/constraint registries — **do NOT adopt the VTL *parser/grammar***. A VTL-syntax frontend is standards-completeness theater until a federation partner ships VTL files; the operator *semantics* are the value, and they map cleanly to `derive`/`reduce`/`rollup` + the ContentConstraint predicate model.
- **Fit**: Rides ContentConstraint predicate-rows (`V26`) + the DB⇄TS twin pattern (promote platform-wide, the board recommends it) + classifier hierarchy (`V4`) + silver pipeline (`V11`). A new artifact `DataTest`/`Ruleset` is a registry sibling of the transform-op and content-constraint registries — OCP by construction.
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `DataTest` union (`notNull`/`acceptedValues`/`range`/`freshness`/`identity`) + `HierarchicalRuleset {target, sign-map of children}`. JSON, no code.
  - **core**: a `ruleset` validation registry (mirrors `step-registry`); a hierarchical ruleset also yields a **derive direction** (compute the parent = a `reduce`+`derive` pipe) → reuses DC-01 calc-metric machinery.
  - **charts/react**: a failing assertion surfaces as a Law-9 **data-integrity badge** (reuse the existing preliminary/last-updated badge slot) — explain-don't-hide.
  - **plugins**: register the geostat identity set (3-approach reconciliation; B1G hierarchy).
  - **api**: the ingest worker runs rulesets in **silver** (twin of core) and writes `validation_issue` rows (the table exists, `V11`); a `/datasets/:id/quality` projection exposes pass/fail.
  - **db**: optional `stats.ruleset` + `ruleset_result` (SCD-2, like reference metadata `V31`); hierarchical rollup can promote to a `cube_actual_region`-style derived view.
  - **panel**: a "Data tests" authoring pane (generic Inspector over the `DataTest` PropSchema — zero bespoke form, the CON-02 pattern).
  - **provisioning**: `geostat.provisioning.json` gains `rulesets[]`.
- **The real consumer & fitness**: a published GDP release fails to publish if the three-approach identity breaks > tolerance (server-authoritative, rides the API-03 publish FSM). **FF-IDENTITY-ENFORCED-AT-PUBLISH** + **FF-RULESET-DB-TS-TWIN** (the core checker and the silver checker agree, the V26 twin discipline).
- **Effort M (concepts) / L (DB persistence) · two-way door · Class M · priority P1 (TOP-3 #2).**
- **Raises-the-bar**: turns the platform from "stores SDMX structure" into "enforces SDMX/national-accounts *semantics*." dbt tests live in YAML for engineers; VTL lives in few NSI tools and clumsily. A **no-code, Constructor-authored, publish-gating identity ruleset** is something neither dbt nor .Stat offers in a visual builder. Matches VTL on the concepts that matter; beats general BI (which models zero data contracts) outright.

---

### [DATA-CONCEPT-03] Pre-aggregations / rollup-routing — the semantic layer as the query planner (from Cube pre-aggregations, LookML PDTs, TimescaleDB continuous aggregates)
- **What it is**: Declare materialized rollups (by grain × dimension subset) in the model; a **query planner transparently routes** an incoming query to the smallest covering rollup instead of the raw fact table, with declarative `refreshKey` invalidation. This is Cube's crown — "the semantic layer is the query SSOT *and* the performance contract."
- **Does it strengthen US?**: **STRENGTHENS.** We have *exact-slice warm planning* (`extractRequirements`, `spec.ts:112`) — best-in-class for "fetch precisely these cells" — but **no rollup tier**: every query hits the raw hypertable, `granularity` on `timeDimension` is decorative (`time-dimension.ts:124`, "carried metadata, no rollup"), and DB-17 explicitly flags "no continuous aggregates." `cube_actual_region` (`V26`) is already a derived view crying out to be a continuous aggregate. As the cube grows (and under multi-tenant load), this is the scale ceiling.
- **Fit**: Rides three shipped seams: (a) `extractRequirements` becomes a *planner* that, given a query's grain/dims, picks a rollup; (b) `timeDimension.granularity` finally *drives* a rollup (closes the ENG-08 "decorative grain" gap); (c) TimescaleDB continuous aggregates are the DB substrate DB-17 already wants. The store port (`store.ts`) gains a capability: "what rollups can you serve?"
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `Rollup {grain, dims, measures, refreshKey}` declared on a dataset/DSD; `StoreCaps.rollups`.
  - **core**: extend `extractRequirements`/the read-key SSOT to emit a *rollup-aware* read key — pick the coarsest covering rollup; fall through to raw on miss (byte-identical). `granularity` < data-grain triggers a `groupBySpan` (op already exists) when no DB rollup is present (client-side fallback).
  - **charts/react**: none — same `DataRow[]`; faster.
  - **plugins**: declare GDP annual×geo and quarterly×measure rollups.
  - **api**: serve from the continuous aggregate; `refreshKey` ties to the release/version counter (already the ETag SSOT, API-05).
  - **db**: TimescaleDB **continuous aggregates** per (dataset, grain) refreshed in `publish_release` (`V25`); fixes the DB-17 segmentby/chunk mis-tuning in the same pass.
  - **panel**: a rollup is *declared*, not authored per-node — the Constructor shows "served-from-rollup" provenance, never asks the author to pick a table (the routing is the engine's job — that's the whole point).
  - **provisioning**: rollups in the dataset manifest.
- **The real consumer & fitness**: the heaviest geostat page (regional time-series matrix) served from an annual×geo continuous aggregate. **FF-ROLLUP-ROUTES** (a query whose grain/dims are covered reads the rollup, asserted via the read-key) + **FF-ROLLUP-EQUALS-RAW** (rollup result === raw-fact result for the same query — the correctness twin).
- **Effort L · two-way door (additive, raw is always the fallback) · Class M · priority P1/P2 (TOP-3 #3).**
- **Raises-the-bar**: lifts us from "exact-slice cache" to "**cost-based semantic query planner**" — Cube/LookML's defining capability. With our as-of vintage (DB-21) layered on top, an *as-published rollup* is a thing no general BI tool offers. Matches Cube; beats Grafana/Metabase/Superset (none plan rollups).

---

### [DATA-CONCEPT-04] Join-relationships / model graph — joins-as-relationships (from Malloy sources, Cube joins, LookML explores)
- **What it is**: Declare join relationships **once** on the model (Malloy `join_one`/`join_many`, Cube `joins` with cardinality, LookML explore join graph), reused by every query, with **symmetric-aggregate** correctness so a measure aggregated across a fan-out join isn't double-counted (the LookML chasm/fan trap solution).
- **Does it strengthen US?**: **STRENGTHENS (medium-heavy).** Our `blend` is a *one-sided left lookup* resolved per-node in react (`resolveNodeRows.ts:105`); the blend ADR is explicit that this is "NOT a symmetric SQL planner," and B2 cross-grain join is deferred. There is no reusable, model-level relationship graph — every cross-store enrichment re-declares its join inline. For two real stores (national accounts + labour) this becomes duplication, and grain mismatches mis-join silently (ENG-07's "hardest unsolved problem").
- **Fit**: Promotes `blend` from a per-node op to a model artifact: a `Relationship {from, to, by, cardinality, grain}` graph that `blend`/calc-metrics resolve *against*. Rides the metric→store routing (`dataSource`, `metric-store.ts`) so a relationship can be metric-scoped. Cardinality + grain feed the symmetric-aggregate guard.
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `Relationship` graph on the manifest; `cardinality: one|many`, `grain`.
  - **core**: a relationship registry; `blend`/join resolution consults it; a **fan-out guard** (refuse/symmetric-aggregate when a `reduce` runs across a `many` relationship — closes the silent mis-join).
  - **react**: `resolveBlends` reads the graph instead of an inline join spec.
  - **plugins/db/api**: declare the GDP↔region and GDP↔deflator relationships; (DB-05 shared-DSD pairs with this — two datasets sharing a key structure share a relationship).
  - **panel**: the blend authoring pane picks a *named relationship*, not raw keys (capability discovery).
  - **provisioning**: `relationships[]`.
- **The real consumer & fitness**: a 2-store page (the multistore ADR's M0 "prove routing" page) joins via a declared relationship. **FF-RELATIONSHIP-REUSED** (≥2 nodes resolve the same named relationship) + **FF-NO-FANOUT-DOUBLECOUNT** (a measure across a `many` join equals the symmetric-aggregate result).
- **Effort L · one-way-ish (model artifact) · Class M · priority P2 (after DC-01; pairs with DB-05 shared DSD & X-1 multistore).**
- **Raises-the-bar**: a declared, grain-aware, symmetric-aggregate-correct relationship graph in JSON. Malloy/LookML have it in code; Grafana's blend is UI-bespoke and fan-out-unsafe. Matches Malloy/LookML semantics no-code.

---

### [DATA-CONCEPT-05] Selection / param interaction grammar — cross-filter, brush, drill as *data* (from Vega-Lite params + selections)
- **What it is**: Interactions as declarative config: a `param` is a bound variable; a `selection` (point / interval) captures user input on a mark and **feeds it back into other views' filters** — click a bar → filter linked charts; brush a time interval → narrow the page; click a region → drill its sub-accounts. Interaction becomes a first-class, serializable part of the spec, not imperative event-handler code.
- **Does it strengthen US?**: **STRENGTHENS.** We have the perspective axis (a registered *view* selector) and filter params (URL-bound), and `ctx.perspectiveState: Record<param,string>` is already a Harel state container — but **no chart→filter feedback grammar**: a user cannot brush a chart to filter the page, and drill-down (`classifier.parent/leaf` is "shape-ready," ENG-11) has no declarative interaction to trigger it. For a *visual-builder* platform (Builder.io class, §12), interaction-as-data is a defining capability; ours stops at toggles.
- **Fit**: Rides `ctx.perspectiveState` + filter params + the `$`-ref taxonomy (a selection writes a `$param`/`$ctx` value that existing filters/visibility already consume — *zero new evaluator*). A `selection` is a *new perspective-scope-key* / param-source, registered (OCP, `perspective-scope-registry.ts`), not a closed interface field.
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `SelectionDef {kind: point|interval, on: encoding-channel, writes: param}` — JSON, declarative; **no callback** (Law 2).
  - **core**: a selection resolves to a filter/ctx write through the existing `resolveRef` path; visibility/filters react with no change (they already read `$ctx`/`$param`).
  - **charts**: the neutral `ChartOutput` (RX-12) gains a structured "selectable region" descriptor (no React).
  - **react**: the chart adapter (ApexRenderer) wires the pointer/brush event → `ctx.set(param, value)` (the only imperative glue, isolated in the adapter where Law-3 allows it).
  - **plugins**: a region map click drills via the classifier `leaf`/`parent` views.
  - **api**: none (selection state is URL-bound — permalink free, Law 9).
  - **panel**: a "linking" authoring affordance (pick source mark → target param) — the builder *browses* selectable channels.
  - **provisioning**: selections live in page config.
- **The real consumer & fitness**: the regional page — brush the time series → all KPIs/tables narrow; click a region → drill to its sub-accounts; the selection is in the permalink. **FF-SELECTION-IS-PERMALINK** (a selection round-trips through the URL) + **FF-SELECTION-NO-CALLBACK** (no function in a `SelectionDef` — the Law-2 guard).
- **Effort M · two-way door · Class M · priority P2.**
- **Raises-the-bar**: cross-filtering/brushing/drill **as serializable config** — Vega-Lite has it in a viz spec; Grafana/Tableau bolt it on imperatively per-panel; Builder.io has no data-linking grammar at all. A permalink-addressable, no-code interaction grammar over a generic cube is genuinely ours.

---

### [DATA-CONCEPT-06] Facet / view-composition algebra — small multiples, layer, concat, repeat (from Vega-Lite facet/layer/concat/repeat)
- **What it is**: Compose views by **data**: `facet` (one spec × a partitioning dimension → a grid of small multiples), `layer` (overlay specs sharing a scale), `concat`/`repeat` (juxtapose by field). One spec yields N views without N configs.
- **Does it strengthen US?**: **STRENGTHENS.** Our layout does container-queries + slots, but composition is *structural* (author N nodes), not *data-driven* (one node × a dim → N panels). The perspective ADR explicitly **deferred `facet` as a scope-key door** ("facet-on-axis NOT scope") — the shape is reserved but unbuilt. National accounts lives on small multiples: GDP per region, account per sector, indicator per year — today each is hand-authored.
- **Fit**: Rides the deferred `facet` perspective-scope-key (`perspective-scope-registry.ts` — register it) + the classifier `leaves`/`items` views (`codelist.ts`, the partition source) + the existing node renderer (a facet is "render this child node once per facet value"). `repeat` over measures pairs with DC-01 calc metrics.
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `FacetSpec {by: dim-ref, of: nodeId}` (+ optional `columns`).
  - **core**: a facet resolver expands one node × `itemsOf(dim)` → N scoped child contexts (each child gets `ctx.dims[by]=value`); `extractRequirements` walks the expansion → warm-planning free.
  - **charts/react**: the renderer already walks children; faceting is "N children with scoped ctx" — the lazy-children proxy (RX-04) handles it.
  - **plugins**: GDP-by-region small-multiple grid from one chart node.
  - **api**: none (pure config expansion).
  - **panel**: a "facet by…" affordance on any data node (the dim picker is the classifier palette).
  - **provisioning**: facet in page config.
- **The real consumer & fitness**: replace the hand-authored per-region chart cluster with one faceted node. **FF-FACET-EXPANDS** (a facet over an N-member codelist renders N children with correctly scoped ctx) + **FF-FACET-WARM-COMPLETE** (the warm planner fetches all N slices — no cold facets, the GAP-4 discipline).
- **Effort M · two-way door (registers the deferred door) · Class M · priority P2 (composes with DC-05 and the Perspective Lattice INNOV-1).**
- **Raises-the-bar**: data-driven small multiples as one config node over a generic cube + SDMX codelist. Vega-Lite facets a viz; we facet *any* node (chart, table, KPI) by *any* dimension. Matches Vega-Lite; exceeds Grafana (repeat-by-variable is panel-only and clunky).

---

### [DATA-CONCEPT-07] Query pushdown / hybrid-execution IR — split the pipe into store-pushed vs client-run (from PRQL/SQLGlot, Cube/Malloy/dbt compile-to-SQL)
- **What it is**: One query IR, two execution targets. The planner negotiates with the store: **push down** the predicates/aggregations the backend can run natively (SQL `WHERE`/`GROUP BY`/window) and execute only the residual client-side. PRQL/SQLGlot are the IR/transpiler exemplars; Cube/Malloy/dbt compile *everything* to SQL.
- **Does it strengthen US?**: **STRENGTHENS (architectural).** Today the transform pipe runs **entirely client-side** after `store.observe()` — `applyPipeline` over JS row arrays. This is the shared root under three stalled items: ENG-02 (3 specs can't desugar — they need a store-port "valAt" point-read), ENG-07 B2 (cross-grain blend), and the blend ADR's "too-big-to-client-join" D3-PLANNER trigger. A pushdown-capable IR is the principled solution to all three — the store declares what it can execute; the pipe splits at that boundary.
- **Fit**: Rides the `DataStore` port (`store.ts:36`, `StoreCaps` already exists) + the desugar seam (`desugar.ts` — lowering to primitives is exactly what a pushdown planner needs) + `extractRequirements`. The store port gains a capability: `canPush(stepFragment)` / `queryFrame`. This is the architect-gated Class-M frontier the boards already named (ENG-02/07/08 "escalate architect").
- **FULL-adoption plan, EVERY layer**:
  - **contracts**: `StoreCaps.pushable: op[]`; a `PushPlan {pushed, residual}`.
  - **core**: the planner partitions a `pipe[]` into a pushable prefix (sort/filter/reduce/window the store runs) + a client residual; `valAt`/point-read becomes a pushed primitive → `growth`/`timeseries`/`ratio-list` finally desugar (closes ENG-02).
  - **react**: `resolveBlends` pushes the join when both sides share a store (server-side join), else client (closes ENG-07 B2 path).
  - **plugins**: none — transparent.
  - **api**: the stats store translates a pushed fragment to SQL over the hypertable / continuous aggregate (composes with DC-03 rollups — push to the rollup).
  - **db**: the SQL the API emits hits the right rollup/raw table.
  - **panel**: none (the author writes one pipe; the engine decides where it runs).
  - **provisioning**: none.
- **The real consumer & fitness**: a million-row regional query whose filter+aggregate push to SQL, returning rolled-up rows. **FF-PUSHDOWN-EQUALS-CLIENT** (pushed result === all-client result — the correctness twin) + **FF-PUSH-RESPECTS-CAPS** (no op pushed that `StoreCaps.pushable` doesn't list).
- **Effort L · one-way-ish (store-port contract) · Class M · priority P2 — escalate architect (this is the ENG-02/07/08 root).**
- **Raises-the-bar**: brings the compile-to-SQL power of Cube/Malloy/dbt to a **no-code declarative pipe**, *and* keeps the client-side fallback those tools lack (they're SQL-only). The hybrid is the differentiator: full pushdown when the store can, graceful client-degradation when it can't.

---

### [DATA-CONCEPT-08] Nested / turtle query results — aggregating subqueries (from Malloy nested queries)
- **What it is**: A query result where each row carries a **nested sub-result** — a region row that *contains* its own time series; a sector that contains its sub-accounts. Malloy's signature: a dimension grouping with an aggregating subquery nested inside each group, producing tree-shaped (not flat) results in one query.
- **Does it strengthen US?**: **MARGINAL→STRENGTHENS (honest).** Genuinely powerful for dashboards (a master-detail table, a sparkline-per-row, a drill tree) and national-accounts-shaped (the SNA *is* a nested account tree). **But** our entire render path consumes flat `DataRow[]` (`NodeDataFrame`), and a nested result is a real **substrate change**, not a seam ride. The honest verdict: high value, but the cost is a new shape that touches every consumer — it earns a card, not a near-term build.
- **Fit**: Needs net-new substrate — a `NestedRow {key, rows|nested}` and a renderer that walks it (the lazy-children proxy RX-04 is the closest existing analogue). The `facet` algebra (DC-06) is the *flat-composition* alternative that gets ~70% of the value (small-multiples) without the substrate change — so DC-06 should land first and prove demand before DC-08.
- **FULL-adoption plan, EVERY layer** (sketch — gated on demand): contracts add a nested frame; core adds a `nest` transform op (group → subquery per group); charts/react add a nested walker (sparkline-in-row, expandable tree); panel adds a "nest by" affordance; db/api unaffected (nesting is post-query shaping).
- **The real consumer & fitness**: a master-detail accounts table (sector → its components inline). **FF-NEST-FLATTENS** (a nested result flattens to the same rows a `facet` would produce — proves equivalence and a migration path).
- **Effort L · one-way (substrate) · Class M · priority P3 — DEFER behind DC-06 demand.**
- **Raises-the-bar**: tree-shaped results in one declarative query — Malloy's signature, which no visual builder offers. **But** YAGNI-gated: build DC-06 facets first; only adopt nesting when a real master-detail consumer proves the flat algebra insufficient.

---

### [DATA-CONCEPT-09] Segments + Views/Explores — named reusable filters & curated semantic façades (from Cube segments+views, LookML explores)
- **What it is**: **Segment** = a named, reusable filter predicate (`{segment: 'eu-members'}` instead of re-typing the filter). **View/Explore** = a curated façade exposing a *subset* of metrics/dimensions with relationships pre-wired — the governed "public API" and palette of the semantic layer.
- **Does it strengthen US?**: **MARGINAL→STRENGTHENS (governance/ergonomics).** We have filter params + capability-gated palette (CON-03), but no *named reusable predicate* and no *curated façade* — the Constructor palette today shows the *raw* capability surface, not a tenant-curated subset. As metric/dimension counts grow (and per-tenant), a curated view is how you keep the builder palette governable and on-brand. Lower urgency than DC-01/02/03, but cheap and it composes with multi-tenancy (a view ≈ a tenant's published vocabulary).
- **Fit**: Rides filter params (segment = a named filter set, already representable) + `listMetricDefs()`/`describeApp()` palette + the capability gate (CON-03). A view is a *filter on capability discovery*, not new runtime.
- **FULL-adoption plan, EVERY layer**: contracts add `Segment {filter}` + `View {metrics[], dims[], segments[]}`; core resolves a `{segment}` ref through the existing filter path; panel's palette/coverage gate reads the active View to scope what's offered; provisioning declares segments+views; db/api unaffected (config-level). The capability gate (CON-01 coverage fitness) extends to "authorable ⊆ View-exposed."
- **The real consumer & fitness**: the geostat Constructor palette scoped to a "National Accounts" view; an "EU members" segment reused across pages. **FF-SEGMENT-REUSED** + **FF-VIEW-SCOPES-PALETTE** (the builder offers only the active View's capabilities).
- **Effort S–M · two-way door · Class G/M · priority P2/P3 (pairs with X-1 multi-tenancy & DC-04 relationships).**
- **Raises-the-bar**: a curated, governable, per-tenant semantic façade for a *no-code* builder. Cube views/LookML explores are code; ours is config + capability-discovery. Matches them; adds the multi-tenant palette-scoping no incumbent builder has.

---

### [DATA-CONCEPT-10] Statistical/grain transform ops — impute, timeUnit-bin, stack (from Vega-Lite transform grammar)
- **What it is**: Three transform verbs we lack: **impute** (fill missing observations — null/interpolate/carry-forward, *structure-aware*: emit a row for every expected (series×period) cell); **timeUnit** (bin a date to a coarser grain — the grain-binning primitive); **stack** (cumulative stacking for part-to-whole).
- **Does it strengthen US?**: **MARGINAL→STRENGTHENS (cheap, targeted).** Mostly "more ops," but **impute is genuinely important for statistical series** — sparse cubes (ContentConstraint models "empty-by-design vs missing", `V26`) need explicit gap-filling so a chart shows a break, not a silent skip (a data-integrity concern, Law 9). `timeUnit` is the client-side companion to DC-03/ENG-08 grain. `stack` is a chart-adjacent convenience.
- **Fit**: Pure transform-registry additions (`step-registry.ts` — one `registerTransformStep` each + a PropSchema). Zero substrate change; the OCP path the registry was built for. `impute` reads the ContentConstraint to know *which* cells are expected (structure-aware, not naive).
- **FULL-adoption plan, EVERY layer**: core registers 3 ops + schemas; impute consults `dim_key_in_allowed_region` (the V26 SSOT) for expected cells; panel exposes them via the generic Inspector (free — schema co-located); plugins use impute on the regional series; db/api unaffected.
- **The real consumer & fitness**: the regional series imputes missing years as explicit gaps. **FF-IMPUTE-RESPECTS-REGION** (impute emits cells only where ContentConstraint says data is *expected*, not where it's *empty-by-design*) + the transform-op-executability fitness (ENG-03) covers them automatically.
- **Effort S · two-way door · Class M · priority P2/P3.**
- **Raises-the-bar**: structure-aware imputation (driven by the legal-region model) is stronger than Vega-Lite's naive impute. Cheap, and closes a real Law-9 integrity gap (silent missing-data).

---

### [DATA-CONCEPT-11] Exposures + column-level lineage (from dbt) — *largely covered, noted to avoid double-counting*
- **What it is**: An **exposure** = a declared downstream consumer (a dashboard/report/export) as a node in the lineage graph, enabling impact analysis ("changing metric X breaks pages A,B"). **Column-level lineage** = field-level provenance through transforms.
- **Does it strengthen US?**: **MARGINAL — mostly already in flight.** Our config-as-SSOT means **a page already *is* an exposure** — declaring it as a graph node is a small formalization. And the boards already propose the two pieces this would add: **pixel-to-observation lineage** (INNOV-2, P1) and **static spec-typing / output-FieldSchema inference** (ENG-NEW) — the latter *is* column-level lineage through the transform pipe. So this concept's value is real but **mostly captured by existing proposals**; the only net-new sliver is the *reverse index* (metric → consuming configs) for impact analysis.
- **Fit**: Rides config-as-SSOT + provenance (`core/provenance.ts`, V32) + the proposed spec-typing. The reverse index is a build-time scan of all configs for metric/dataset refs.
- **FULL-adoption plan**: a build-time `exposures` index (which config references which metric/dataset) + surface it in the panel ("3 pages use this metric"); column lineage = adopt ENG-NEW spec-typing. **The real consumer**: the migration runner (CON-18) uses the exposure index to know what a breaking metric change impacts. **FF-EXPOSURE-INDEX-COMPLETE** (every metric/dataset ref is indexed).
- **Effort S (exposures) / see ENG-NEW (lineage) · two-way · Class G · priority P2 — fold into INNOV-2 + ENG-NEW rather than build standalone.**
- **Raises-the-bar**: marginal over what INNOV-2/ENG-NEW already deliver; included for completeness and to flag the cheap reverse-index sliver.

---

## Ranked summary table (strengthen-most × cheapest-for-us first)

| Rank | Concept | Strengthen | Effort | Door | Class | Rides (shipped seam) | Priority |
|---|---|---|---|---|---|---|---|
| **1** | DC-01 Calculated/derived metrics | **High** | M | 2-way | M | `MetricDef` + `expr` + growth/ratio specs | **P1** |
| **2** | DC-02 Data tests + VTL hierarchical/validation rulesets | **High** | M/L | 2-way | M | ContentConstraint + classifier hierarchy + silver | **P1** |
| **3** | DC-03 Pre-aggregations / rollup-routing | **High** | L | 2-way | M | `extractRequirements` + `granularity` + continuous aggs (DB-17) | **P1/P2** |
| 4 | DC-05 Selection/interaction grammar | High | M | 2-way | M | perspectiveState + filter params + `$`-refs | P2 |
| 5 | DC-06 Facet / view-composition algebra | High | M | 2-way | M | deferred `facet` scope-key + classifier views | P2 |
| 6 | DC-07 Query pushdown / hybrid IR | High (arch) | L | 1-way-ish | M | `DataStore` port + desugar seam | P2 (escalate) |
| 7 | DC-04 Join-relationships / model graph | Medium-High | L | 1-way-ish | M | blend + metric→store routing | P2 |
| 8 | DC-10 Statistical ops (impute/timeUnit/stack) | Medium | S | 2-way | M | transform registry + ContentConstraint | P2/P3 |
| 9 | DC-09 Segments + Views/Explores | Medium | S–M | 2-way | G/M | filter params + capability gate (CON-03) | P2/P3 |
| 10 | DC-08 Nested/turtle results | Medium (substrate) | L | 1-way | M | net-new frame (DC-06 first) | P3 (defer) |
| 11 | DC-11 Exposures + column lineage | Marginal | S | 2-way | G | config-as-SSOT + INNOV-2 + ENG-NEW | P2 (fold in) |

## TOP-3 — adopt-fully-next

1. **DC-01 Calculated/derived metrics.** The highest leverage *and* the cheapest, because it solves the platform's biggest standing problem (X-2: the semantic layer is an empty cathedral, 0 registered metrics) by giving `MetricDef` a *reason to exist* — a calc metric does what a raw code cannot. It unifies our own ad-hoc `growth`/`ratio-list` specs into one governed, no-code vocabulary, and it is the prerequisite that makes DC-02/03/04 worth populating. Build it *with* a real consumer (migrate the GDP-deflator page) under FF-METRIC-HAS-CONSUMER.

2. **DC-02 Data tests + VTL hierarchical/validation rulesets.** The most national-accounts-shaped concept in the set: the accounting identities (3-approach GDP reconciliation, B1G = Σ components) that the platform stores the structure for but enforces *nowhere*. Adopt the VTL ruleset *concepts* (check + hierarchical define) onto ContentConstraint + the classifier hierarchy — **not** the VTL parser. Publish-gates on identity failure (rides the API-03 FSM); the Law-9 trust capstone.

3. **DC-03 Pre-aggregations / rollup-routing.** The Cube crown — promotes our exact-slice cache into a cost-based semantic query planner, finally makes `timeDimension.granularity` non-decorative, and converts the DB-17 "no continuous aggregates" gap into the scale spine. Always-falls-back-to-raw (two-way, correctness-twinned), and it composes with both DC-01 (calc metrics can be pre-aggregated) and DB-21 (as-published rollups).

> All three ride seams shipped this quarter, all three target the *adoption* frontier rather than new machinery, and all three carry their own fitness function — so none becomes a fourth empty cathedral.

## SKIP list — principled refusals (incumbent-specific cruft, with the reason)

- **VTL grammar/parser (the language frontend)** — adopt the ruleset *semantics* (DC-02), refuse the syntax frontend: standards-completeness theater until a federation partner ships `.vtl` files; the operators already map to our registries.
- **Liquid / Jinja string-templating refs (LookML/dbt)** — we beat it with the typed 5-scope `$`-ref taxonomy (`ref.ts:40`); adopting string interpolation would *regress* Law-2 declarativeness.
- **Observable reactive runtime** — React already provides reactivity for our SSR-first model; a second reactive-dataflow runtime is redundant substrate, not new capability.
- **DuckDB-wasm / Arquero as the default compute engine** — DEFER, do not adopt: a faster *implementation* behind the existing pipeline port, not a new grammar. Name the port; swap it only when a real client-side data-volume trigger fires (the DC-07 / blend-D3 trigger). Adopting now is premature optimization.
- **SDMX-REST full /structure + /data serialization** — not net-new mining: already a known, trigger-gated board item (DB-01 / API-04), reserved behind a real federation/harvest consumer. Correctly deferred, not refused.
- **LookML access_grants / field-level semantic access control** — DEFER, gated on the X-1 multi-tenancy ADR (the one-way door being decided separately); it is governance that *rides* the tenancy model, not an independent concept to adopt now.
- **`custom.fn` code-escape-hatch parity (Vega `signal`/`expression`)** — refuse: a named-function pointer in config is a second extension mechanism competing with `registerSpec`/`registerTransformStep` (ISP/OCP smell) and invites imperative thinking (Law 2). The board already plans to *remove* `custom` (ENG-16) — adopting more escape-hatch surface is the wrong direction.
- **Cube Playground / Looker IDE / Superset chart-zoo** — product UX surfaces, not concepts. Out of scope.

---

### Cited attachment points
`core/src/data/metric.ts:16,129,172` (semantic layer) · `core/src/config/data-spec.ts:133,173,178` (DataSpec union, growth/ratio specs) · `core/src/data/transform/{step-registry.ts:32,index.ts:38}` (19-op registry) · `core/src/data/spec.ts:112` + `core/src/core/time-dimension.ts:124,216` (warm planner, decorative grain) · `core/src/ref/ref.ts:40` ($-ref taxonomy) · `core/src/config/perspective-scope-registry.ts:32` (deferred facet/scope doors) · react `resolveNodeRows.ts:105` (one-sided blend) · `ops/postgres/migrations/{V4,V25,V26,V31}` (cube, vintage, ContentConstraint, ref-metadata) · DB-17 (continuous-aggregate gap) · INNOV-2 + ENG-NEW (lineage/spec-typing already proposed).
