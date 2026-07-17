# SPEC — The Governed Data Plane: data-object + JSON-manipulation + semantic layer, benchmarked and surpassed

> **✅ CANONICAL AR-50 SPEC (2026-07-11).** This is THE single SPEC for AR-50 — read this one. It reconciles the two-study design: the fixed decisions (D-AR50-1 DSD-reification, D-AR50-2 `metric` discriminant) adopted this study's positions, so its structure (M1 query noun · M2 grain algebra · M3 one dialect · M4 kernel+stats verbs · M5 DSD-reify+lifecycle+G6) is canonical. The parallel Opus study `SPEC-data-semantic-worldclass.md` is **superseded → read this**; its unique framing (the S1–S14 gap-map, the `RelationshipDef` peer-noun) survives as the *rejected* alternatives in the canonical ADR. Canonical companion ADR: `docs/architecture/decisions/ADR-034-semantic-query-plane-and-measure-algebra.md`.
> **Build state (as of 2026-07-11):** M3=one-dialect+one-agg **BUILT** (`53bb83f`) · M5-G6 discoverability **BUILT** (`bb7a74c`) · M2 measure-algebra-at-grain **BUILT** (`87aea32`, `packages/core/src/data/metric-grain.ts`) · M1 `metric` discriminant **IN PROGRESS** · M4 kernel+stats-verbs and M5 DSD-reify+lifecycle **PENDING**. The Strangler waves below (§5) are the plan; the finalized sequence + reversible/⛔ tags live in the ADR §6 and the MASTER-PLAN AR-50 block.
>
> **Status:** CANONICAL DESIGN (owner-approved 2026-07-11) · **Author:** platform-architect (Fable 5, `claude-fable-5`) · **Date:** 2026-07-11
> **Commission:** owner — "study the strongest reference platforms' data structure and JSON-data manipulation, integrate and grow the semantic layer, reach then surpass international standards — a hybrid more refined than any single reference system."
> **Grounded against (code is authoritative):** `packages/core/src/config/data-spec.ts` · `data/transform/*` · `data/metric.ts`/`metric-calc.ts`/`metric-store.ts` · `data/source.ts`/`resolve.ts`/`desugar.ts` · `graph/*` (ADR-024) · `apps/panel/src/studio/model/*` (AR-49 M2/M3) · `BENCHMARK-REFERENCE-PLATFORMS.md` · `MASTER-PLAN-canonical-rearchitecture.md` (G5/G6).
> **Laws held throughout:** Law 1 (no privileged dims) · Law 2 (declarative, serializable) · Law 3 (the arrow) · Law 4 (standards whole) · Law 5 (`fromSDMX` sole adapter; SDMX-native semantic layer — learn from Cube/LookML, never swap one in) · M-8 (non-programmer authors it).
> **Companion ADR draft:** `docs/architecture/decisions/ADR-034-semantic-query-plane-and-measure-algebra.md`.

---

## 0. EXECUTIVE SUMMARY — the five highest-leverage moves (owner picks)

The study's headline: **our three strata are individually strong — physical (SDMX/ObsQuery), transform (19-verb pipe), semantic (MetricDef) — but they are not yet ONE algebra.** The reference leaders each unified exactly one seam we haven't: Cube/Looker/MetricFlow unified *metric → query*; Vega-Lite unified *transform → one minimal grammar with one expression language*; dbt unified *definition → lifecycle*. Nobody unified all three **and** kept the whole thing non-programmer-authorable JSON **and** compiled it into a dataflow graph. We can — the pieces exist in the codebase today.

| # | Move | Where we fall short → the hybrid solution | What it unlocks | Door |
|---|------|-------------------------------------------|-----------------|------|
| **M1** | **The Semantic Query noun** — a new `DataSpec` discriminant `{ type:'metric', metrics, by, time, where }`, compiled by a registered resolver onto ObsQuery/point-series/pipe | Every leader has a semantic query API (Cube REST, Looker Explore, MetricFlow query); ours today is physical-only (`ObsQuery`) with metric-ids threaded through as measure refs. The hybrid: the semantic query **is itself declarative config** — Constructor-authorable JSON, resolved through `resolveMeasureRef`, compiled into the reactive graph | Metric-first authoring becomes *structural*, not just UI; one binding grammar for KPI/chart/table; lineage ("this chart shows metric X by region") read straight off config; ShowMe/field-wells emit it | **Reversible** (new registered discriminant; every existing spec untouched) |
| **M2** | **Measure algebra at grain** — generalize `MetricCalc` from scalar-only to any-grain evaluation (align-join component row-sets on shared dims, evaluate the expr per row); recast `growth`/cumulative as declarative **metric kinds**, `ratio-list` as sugar over calc metrics | MetricFlow/Cube/Malloy evaluate derived+ratio metrics at *any* grain; our calc metrics are KPI-point-only, so "GDP per capita **over time**" cannot be a metric — authors re-derive it per chart via pipe, and the definition drifts (the exact "one governed number" breach the platform exists to prevent) | Define once, chart anywhere; the derived metric *inherits component provenance* (no leader does this); kills the config-level ungoverned-ratio leak | **Reversible** expansion (scalar path = grain-∅, byte-identical); the *contract* (demoting `ratio-list`/`growth` spec types to sugar) is the later one-way door, gate-fired |
| **M3** | **One expression dialect, one aggregation vocabulary** — converge transform `DeriveExpr` onto `@statdash/expr` (arrow-clean: expr sits below core); collapse the THREE aggregation vocabularies (`MetricAgg` 'sum/avg/last' · `aggregate` 'sum/avg/min/max/count' · `reduce` 'sum/**mean**/…/first/last') into one `AggOp` SSOT registry | Vega, JSONata, jq, Power Query each have exactly ONE expression language. We have two ASTs + two evaluators + a string parser targeting the wrong one — while `metric-calc.ts` itself declares "never a second dialect" as an invariant. Confirmed erosion, root-cause fixable | Halves the sandboxed surface the Constructor must trust; one AST for `extractDeps`/field-lineage; the visual calc-builder (N6) targets one compile target | **Reversible** expand-contract (accept both, lower old→new; stored configs migrate via the existing migration chain) |
| **M4** | **Transform kernel + statistics-grade verbs** — declare the minimal orthogonal KERNEL (~11 relational verbs); reclassify the duplicates (`reduce`→`aggregate`, `lookup`→`join`, `concat`/`template`→`derive`) as **registered sugar with provable lowerings** (the `desugar.ts` discipline, applied to steps); add the missing verbs: `impute` (with SDMX status-flag propagation), `bin`, `unfold` (long→wide), `broadcast` (Vega `joinaggregate`), `timeUnit` (lands with D-GRAIN) | Vega-Lite's grammar is minimal + orthogonal; ours has 3 confirmed duplicate-verb pairs and misses the verbs a statistical office needs most (imputation with flags is Eurostat bread-and-butter). The hybrid: Vega-Lite's grammar discipline + Tidy/dplyr verb set + **provenance-aware imputation nobody has** (Vega imputes values; we impute values *and* propagate the `E`-estimate flag per Law 9) | Per-field lineage becomes computable; smaller trusted kernel; histograms, share-of-group, wide tables, gap-filling — all authorable | **Reversible** (pure additive lowerings; every existing op keeps working verbatim) |
| **M5** | **Reify the SDMX structural contract + metric lifecycle + the discoverable Data-model workspace** — publish per-dataflow dimension sets (the DSD, made introspectable) so each metric declares *sliceable-by*; add `status: draft→certified→deprecated` + catalog `schemaVersion` with registered migrations (G5); make "Data model" a first-class rail destination where **author = read-only Data Dictionary lens, steward = edit lens** (G6, role-is-lens) | Cube/LookML model joins by hand; SDMX *already declares* structure in the DSD — richer than BI joins (official codelists + hierarchies), we just never reified it. Metric versioning/lifecycle = dbt versioned metrics + Power BI endorsement. G6's buried modeler becomes dbt-docs-grade discovery | Palette greys out invalid dims (semantic ShowMe); metric-query validation before render; certification badges (N3); the modeler is *reachable* without polluting the author's metric-first path | **Reversible** (additive contract fields + a rail entry; localStorage self-gate replaced by session role) |

**Ranking if the owner picks fewer:** M3 first (cheapest, pure debt-kill, everything else builds on one AST), then M1 (the structural keystone), then M2 (the governance payoff), M5, M4. M1+M2 together are the "architecture nobody else has": a **governed, grain-polymorphic, provenance-carrying semantic query — as plain JSON — compiled into a dashboard-scale dataflow graph.**

---

## 1. Ground-truth assessment — what we have, judged freely

### 1.1 What is already world-class (keep, do not touch)

- **The discriminated-union DataSpec + registry resolution** (`data-spec.ts`, `registerSpec`) — true OCP; the `PointSeriesSpec` internal-lowering tier (public vocabulary ≠ resolution vocabulary) is a genuinely sophisticated move Vega-Lite also makes (normalized specs) and most BI tools lack.
- **`desugar.ts`** — convenience→primitive lowering with a row-identical fitness contract (FF-DESUGAR-EQUIV). This *discipline* is the pattern M4 generalizes to transform steps.
- **`resolveMeasureRef` as the ONE seam** (`metric.ts`) — Postel raw-code passthrough, first-metric-wins governance, `mergeMetricDims` shared by chart+KPI paths. This is the Cube `dataSource`-on-measure pattern done arrow-clean.
- **The config-compiled reactive graph** (ADR-024, `graph/`) — the load-bearing surpass axis. Law 2 makes `extractDeps` *total* (verified over the real corpus); nobody in the reference class compiles a dashboard-scale dataflow from config. Every move below is designed to feed this graph, never bypass it.
- **Transform pipe fundamentals** — tidy long-form `EngineRow`, ctx-refs resolved before apply, `blend` as the declarative front-door of `joinByField` (authorable ≠ internal, same tiering as point-series).
- **Warm = requirements extraction** (`calcMetricRequirements`, `extractRequirements`) — requirement-driven prefetch is Cube pre-aggregation's *intent* achieved without its machinery.

### 1.2 Confirmed erosions (observation duty — each verified in code this study)

| # | Erosion | Evidence | Severity |
|---|---------|----------|----------|
| E1 | **Two expression dialects.** `DeriveExpr` (own union + own `evalExpr` + own string parser, `transform/types.ts:33`/`derive.ts:23`) vs `@statdash/expr` `Expr` (`expr/src/types.ts:28`). `metric-calc.ts:11` declares "REUSING the one typed evaluator, never a second dialect" — the invariant is stated and breached in the same package | two evaluators, two sandboxes, two things `extractDeps` must understand | **High** — root-cause fix is M3; arrow-clean (`expr` ← `core`) |
| E2 | **Three aggregation vocabularies.** `METRIC_AGG_VALUES` `['sum','avg','last']` (`metric.ts:56`) · `aggregate.agg` `'sum'\|'avg'\|'min'\|'max'\|'count'` · `reduce.fn` `'sum'\|'mean'\|'min'\|'max'\|'count'\|'first'\|'last'` (`transform/types.ts`) — the same operation is `avg` in two places and `mean` in the third | a Constructor agg-picker cannot source one SSOT; `metric.ts:50` itself demands "an authoring agg-picker sources its options FROM here" | **Medium** — M3 |
| E3 | **Duplicate verbs.** `reduce` documents itself as "cleaner API than `aggregate`"; `lookup` vs `join` overlap (rationalized but two verbs); `concat`/`template` are `derive`-expressible (the `Expr` AST already has `template`+`concat` ops) | grammar minimality (MDE canon §12) eroding by accretion | **Medium** — M4 reclassifies as sugar, keeps authorability |
| E4 | **Scalar-only calc metrics.** `metric-calc.ts:14` — "consumed at a point, not row-set query measures." A derived metric cannot drive a timeseries/chart; authors re-derive via `pipe`+`derive` per chart | "one governed number" breaks exactly where it matters most (published charts) | **High** — M2 |
| E5 | **`ratio-list` is ungoverned measure algebra in config.** A per-node `{code, denom}` pair is a ratio *defined at the chart*, invisible to the catalog — a chart-local shadow of `MetricCalc` | governance leak vs the M0 DoD ("one governed number on every surface") | **Medium** — M2 folds it (sugar over calc metrics), contract later |
| E6 | **`growth` is semantics living in the syntax layer.** YoY is a *metric transformation* (MetricFlow: a metric type; Cube: rolling window), but ours is a spec discriminant — so "GDP growth" the governed noun cannot exist; only "a growth-spec over GDP" per node | same drift class as E5 | **Medium** — M2 (metric kind), contract later |
| E7 | **ADR numbering collision.** `ADR-023-one-type-system…` and `ADR-0023-classifier-code-path` coexist; two pad conventions (020–024 vs 0023/0025/0026/0033) | housekeeping; a future ADR lands on a taken number | **Low** — this study's ADR takes 034 (past the highest), recommend one convention |

None of these require bending architecture to code (Law 7): each has a Strangler-Fig lowering path (§5).

---

## 2. Benchmark — the strongest reference models, distilled to what is load-bearing

> Expert distillation from trained product knowledge (same honesty constraint as `BENCHMARK-REFERENCE-PLATFORMS.md` Part II — no live web audit; specifics uncertain are marked).

### 2.1 Semantic layers — how each models "metric"

| Platform | The data structure | The one load-bearing idea for us | What we refuse |
|---|---|---|---|
| **dbt MetricFlow** | semantic models (entities · dimensions · measures) + **metric types**: `simple / ratio / derived / cumulative / conversion`; queries resolved over a join graph at requested **grain** | **Metric TYPES as a closed declarative taxonomy** + grain-polymorphic evaluation — the exact generalization `MetricCalc` needs (M2) | YAML-at-repo + SQL generation (we are SDMX-native, Law 5) |
| **Cube** | cubes (measures/dims/joins/segments) + **views** + `{measures, dimensions, timeDimensions, filters}` query API + pre-aggregations | **The semantic query object** — the API *is* four arrays of nouns (M1); `dataSource`-on-measure (already adopted, `MetricDef.dataSource`) | SQL runtime; pre-agg machinery (our warm/requirements already covers the intent) |
| **LookML (Looker)** | views (dimensions/measures) + explores (joins) + `access_grant` + `value_format` + drill fields; git-versioned model | **Define-vs-Explore split** (adopted, AR-49) · access grants (defer with RBAC) · model-as-versioned-artifact (M5 catalog versioning) | the DSL itself (non-programmer mandate) |
| **Malloy** | a composable query language: sources → measures compose from measures; nesting | **Measure composability** — calc inputs may themselves be metric-ids (already true in `resolveMeasureRef` recursion — hold it) | the language |
| **Power BI tabular + DAX** | model (tables/relationships) + measures (DAX) + calculation groups + **perspectives** + RLS | Calculation groups ≈ our perspective axes applied to measures (we already have perspectives — richer, config-level); **endorsement lifecycle** (M5/N3) | DAX (imperative-expert; the anti-model for Law 2) |
| **AtScale** | virtual OLAP cubes over warehouses; aggregate-aware routing | confirmation that OLAP-native (not SQL-native) semantic layers are the right family for us | proprietary runtime |
| **SDMX itself** (our home standard) | **DSD**: dataflow → dimensions + attributes + measures, codelists, hierarchies; MSD for reference metadata | **The structural contract already exists as a standard** — Cube/Looker hand-model joins because SQL has no DSD; we have one and never reified it (M5). This is Law 4 ("adopt whole") pointed at our own standard | — |

**Synthesis:** the leaders converge on four semantic-layer capabilities — *typed metrics, grain resolution, a noun-based query API, and a lifecycle on the definition*. We have the seam for all four and the full form of none. Law 5 shapes the adoption: grow them **on** the SDMX layer (DSD as the join graph, ObsQuery as the compile target), never import a SQL-shaped runtime.

### 2.2 Declarative transform grammars — verb-set parity

| Grammar | Kernel verbs | vs our 19 ops |
|---|---|---|
| **Vega-Lite transform** | aggregate · bin · calculate · density · extent · filter · flatten · fold · **impute** · **joinaggregate** · lookup · **pivot** (long→wide) · quantile · regression/loess · sample · stack · **timeUnit** · window | we have: aggregate, calculate(=derive), filter, fold(=melt), lookup, window ✓ · missing: **impute, joinaggregate/broadcast, pivot-wide/unfold, bin, timeUnit**, (sample/regression/quantile — YAGNI until a consumer) |
| **dplyr/Tidy** | filter · select · mutate · arrange · summarise · group_by · joins · pivot_longer/**pivot_wider** | pivot_wider again the confirmed hole; otherwise parity |
| **Power Query M** | ~700 functions but the load-bearing *structure* is **query-references-query** (a dataset DAG) | feeds §4.6 named datasets (post-V3) |
| **Arquero / DuckDB** | relational algebra + window semantics; DuckDB = the semantics oracle | adopt DuckDB semantics as the *reference semantics* for kernel verbs (join null-handling, window frames) — a spec-level, zero-dep adoption |
| **JSONata / jq** | arbitrary JSON tree manipulation | **refuse as author surface** — arbitrary path expressions are a query language (FF-AUTHOR-NO-QUERY); our `Expr.get` deep-path covers the sanctioned subset |

**Synthesis:** our verb set is ~85% of Vega-Lite with three statistics-critical holes (impute, broadcast, unfold) and a discipline hole (no kernel/sugar distinction). M4.

### 2.3 Dashboard data-object models

| Platform | Object between source and viz | Lesson |
|---|---|---|
| **Tableau** | Data Source (federated, blends) → worksheet fields | the *named, shared, reusable* dataset tier — we bind per-node; §4.6 |
| **Power BI** | Dataset (tabular model) shared across reports | same — the model is the shared object, reports are lenses |
| **Superset** | Dataset (table/SQL) → chart; semantic layer thin | confirms dataset-as-noun; their weakness (thin semantics) is our M1/M2 strength |
| **Grafana** | per-panel query → **data frames** (typed columns) + field config + transformations | per-panel binding *works* at dashboard scale (validates our per-node specs); their `transformations[]` ≈ our pipe (parity) |
| **Sigma** | live spreadsheet over warehouse; every cell traceable | lineage-as-UX north star — our graph makes it computable (G2) |
| **Metabase** | questions → models (curated saved questions) | "a saved governed query" = exactly the M1 semantic-query noun, persisted |

**Synthesis:** the class splits per-node-binding (Grafana — we are here) vs shared-dataset (Tableau/PBI). The graph (ADR-024) lets us have both without choosing: named datasets become shared cells (§4.6) while per-node stays the default. No leader has that, because none compiles.

---

## 3. GAP-MAP — capability × reference-best × have/gap/surpass

> Severity: **SURPASS** (we exceed the class) · **AT** (parity) · **PARTIAL** (seam exists, form incomplete) · **GAP** (missing) · **EROSION** (we built it twice/divergently).

| # | Capability | Best-in-class reference | We today (cited) | Verdict | Move |
|---|-----------|------------------------|-------------------|---------|------|
| 1 | Semantic query API (nouns → query) | Cube query object · Looker Explore · MetricFlow query | none — binding is physical `ObsQuery` (`sdmx.ts:76`) with metric-ids as measure refs; no config object says "metric × dims × time" | **GAP** | **M1** |
| 2 | Metric types / measure algebra | MetricFlow `simple/ratio/derived/cumulative` at any grain · Malloy composition | base + **scalar-only** calc (`metric-calc.ts`); composition ✓ (recursive `resolveMeasureRef`) | **PARTIAL** (E4) | **M2** |
| 3 | Growth/window/cumulative as governed definitions | MetricFlow cumulative · Cube rolling window | `growth` is a spec discriminant (E6); `window` pipe op exists | **PARTIAL** | **M2** |
| 4 | Time grain semantics | Cube `timeDimensions.granularity` · LookML dimension_group | `TimeDimensionSpec` canonical shape landed (ADR R5); `granularity` carried but **inert** (D-GRAIN); grain/rollup ports exist (`store.ts` GrainLevel/RollupOp) | **PARTIAL** | M2 + D-GRAIN |
| 5 | Dimension/entity contract (what slices what) | MetricFlow entities/join-graph · Cube joins · **SDMX DSD (the standard itself)** | DSD implicit in stores/classifiers; nothing declares a metric's valid dims | **GAP** | **M5** |
| 6 | Expression language (one, sandboxed, serializable) | Vega expressions (one) · JSONLogic (one) | **two** ASTs + two evaluators (E1) | **EROSION** | **M3** |
| 7 | Aggregation vocabulary | one per platform | **three** divergent unions (E2) | **EROSION** | **M3** |
| 8 | Transform verb breadth | Vega-Lite 18 transforms · dplyr | 19 ops; missing impute/broadcast/unfold/bin/timeUnit; 3 duplicate pairs (E3) | **PARTIAL** | **M4** |
| 9 | Grammar minimality (kernel + sugar discipline) | Vega-Lite normalization · our own `desugar.ts` for specs | specs: ✓ (desugar + FF-DESUGAR-EQUIV) · steps: ✗ (no kernel manifest, no lowering contract) | **PARTIAL** | **M4** |
| 10 | Statistical integrity in transforms (flags through math) | nobody — Vega imputes values only; Eurostat flags are display-side everywhere | status flags exist in rows (`statusFlags`), not propagated through derive/aggregate/impute | **GAP → SURPASS axis** | **M4** |
| 11 | Named/shared datasets (dataset DAG) | Vega named `data` · Power Query query-refs · Tableau data sources | per-node specs; graph cells are per-node (engine notes cell→cell is "a one-line addition", YAGNI'd) | **PARTIAL** | §4.6 (post-V3) |
| 12 | Config→dataflow compilation | **nobody at dashboard scale** (Vega is chart-local) | ADR-024 V0–V2 landed; exact invalidation proven (~12× over-fire eliminated) | **SURPASS** | hold; M1/M2 feed it |
| 13 | Metric lifecycle (certify/version/deprecate) | dbt versioned metrics · Power BI endorsement · Tableau Certified | none on the catalog (pages have a 5-version migration chain; catalog has no `schemaVersion`) | **GAP** | **M5** (+N3) |
| 14 | Catalog discovery / data dictionary | dbt-docs · Looker dictionary · Sigma lineage | metric palette (author) ✓ · modeler+catalog manager **buried** behind localStorage steward flag (G6) | **PARTIAL** | **M5** |
| 15 | Access grants on semantic objects | LookML `access_grant` · Superset RLS | none (benchmark row 10 already tracks platform RBAC) | GAP | register with RBAC — not this track |
| 16 | Caching / pre-aggregation policy | Cube pre-aggs · Looker PDTs | `CachedStore` + requirement-driven warm; V4 subsumes into graph | **AT** (different, adequate form) | defer (YAGNI) |
| 17 | Tidy row-set canon | all | long-form `EngineRow`, encoding says HOW (GoG golden rule) | **AT** | hold |
| 18 | Lineage ("why is this number") | Sigma · dbt-docs · Collibra | G2 registered; graph + catalog make it mechanically free | GAP (registered) | consumes M1/M2/M5 |

**Reading:** rows 1–2 are the structural gaps; 6–7 the erosions to kill first; 10 + 12 the two axes where we don't chase the class — we define it.

---

## 4. Target architecture — one algebra, three strata, one graph

```
                    ┌──────────────────────────────────────────────────────────┐
    STRATUM 3       │  SEMANTIC QUERY  (M1 — the author's noun)                │
    query plane     │  { type:'metric', metrics, by, time, where, pipe?,      │
                    │    encoding? }  — a DataSpec discriminant, registered    │
                    └───────────────┬──────────────────────────────────────────┘
                                    │ compiled by MetricQueryResolver (registry)
                    ┌───────────────▼──────────────────────────────────────────┐
    STRATUM 2       │  SEMANTIC MODEL (M2/M5 — governed nouns)                 │
    catalog         │  MetricDef: base | calc-at-grain | kind:'growth'/…       │
                    │  + sliceableBy (DSD-derived) + status lifecycle          │
                    │  + ONE Expr AST + ONE AggOp SSOT (M3)                    │
                    └───────────────┬──────────────────────────────────────────┘
                                    │ resolveMeasureRef (the ONE seam — unchanged)
                    ┌───────────────▼──────────────────────────────────────────┐
    STRATUM 1       │  PHYSICAL (unchanged)                                    │
                    │  ObsQuery → DataStore → fromSDMX (sole adapter, Law 5)   │
                    │  + DSD reified as introspectable manifest data (M5)      │
                    └──────────────────────────────────────────────────────────┘
    CROSS-CUTTING:  transform KERNEL + registered sugar (M4) — one relational
                    algebra usable at stratum 3 (pipe) and stratum 2 (calc)
    RUNTIME:        every node = a cell in the config-compiled reactive graph
                    (ADR-024); metric-ids are SOURCE EDGES → catalog edits
                    invalidate exactly the consuming nodes; lineage = read the
                    graph + catalog (G2 falls out)
```

### 4.1 M1 — the Semantic Query noun (`type:'metric'`)

The shape (all fields JSON, Law 2; all dims generic, Law 1):

```jsonc
{
  "type":    "metric",
  "metrics": ["gdp.real_growth", "gdp.deflator"],          // metric-ids (raw codes tolerated — Postel)
  "by":      ["geo"],                                       // free dims = the output grain; [] ⇒ scalar (KPI)
  "time":    { "dim": "time", "range": "all", "granularity": "year" },  // the existing TimeDimensionSpec, verbatim
  "where":   { "sector": { "$ctx": "sector" } },            // FilterValue map (ObsQuery.filter vocabulary, reused)
  "top":     { "by": "value", "n": 10 },                    // optional; lowers to sort+limit
  "pipe":    [],                                            // optional escape-tail (post-semantic shaping)
  "encoding": { "x": "time", "y": "value", "color": "metric" }
}
```

**Resolution (a registered resolver — interpreter unchanged, OCP):**
1. each metric-id → `resolveMeasureRef` (codes + governance dims/unit/format/agg) — the existing ONE seam;
2. `by` ∪ time-dim = the requested grain; validate against `sliceableBy` (M5) — authoring-time error, not render-time surprise;
3. base metrics compile to an `ObsQuery` (+ grain rollup via the existing `GrainLevel/RollupOp` ports); calc metrics route to the M2 grain evaluator; `kind:'growth'` appends the existing `window`/`derive` pipe tail (exactly how growth desugars today);
4. multi-metric = align-join on the shared grain (the M2 machinery);
5. `pipe` tail, then encoding — unchanged downstream.

**Why a DataSpec discriminant and not a new node concept:** the registry *is* our extension law ("new capability = new registered resolver"); the graph, roundtrip fitness, migration chain, discriminant-manifest gate, and panel type-picker all consume DataSpec — one addition lights up every surface. `DATASPEC_DISCRIMINANTS` gains `'metric'` (compile-time exhaustiveness holds), `SPEC_CATALOG` gains its descriptor, `extractDeps` gains `metric:` source edges.

**Authoring:** this is what ShowMe/field-wells *should* emit when the dragged chip is a governed metric (today they emit populated `query` specs — physical). The author path becomes: pick nouns → `metric` spec; the steward path keeps `query`/`transform` (the physical lens). Convenience specs (`timeseries` etc.) remain valid forever via migration; the Constructor default flips only behind a flag.

### 4.2 M2 — measure algebra at grain

Generalize evaluation, not the type: `MetricCalc` (inputs + expr) is already the right *definition* shape. Add:

- **`evalCalcAtGrain(metric, grain, ctx, store): EngineRow[]`** — fetch each input as rows at the requested grain (an ObsQuery per input, `at` pins merged), **align-join** on the shared grain keys (the existing `joinByField` kernel), evaluate `calc.expr` per row (`$derived[name]` binds to the row's input columns). Scalar today = grain-∅ (join on nothing, one row) — **byte-identical by construction**, gated by `FF-CALC-GRAIN-SCALAR-IDENTICAL`.
- **Metric kinds** (the MetricFlow taxonomy, declaratively): `kind?: 'ratio' | 'derived' | 'growth' | 'cumulative'` — `ratio`/`derived` are labels over calc (no new machinery); `growth`/`cumulative` are windowed kinds compiling to the existing `window` op over the base metric's series. "GDP growth" becomes a *registered governed noun*, chartable and KPI-able from one definition.
- **Provenance composition (the surpass):** a derived metric's `ProvenanceRecord` composes its components' records (methodology chain, worst-of preliminary status, latest last-updated). `withMetricProvenance` already fills from the metric; extend to walk `calc.inputs`. No reference platform carries provenance *through* the algebra.
- **Sugar demotions (contract phase, later, owner-gated):** `ratio-list` desugars to anonymous calc metrics; `growth` spec-type desugars to `kind:'growth'` metric-queries. Both via `desugar.ts` with row-identical fitness — the proven discipline.

### 4.3 M3 — one dialect, one vocabulary

- **Expression:** `derive.expr` accepts `Expr` (`@statdash/expr`); a total `lowerDeriveExpr(DeriveExpr): Expr` adapter covers stored configs (every `DeriveExpr` op has an `Expr` equivalent — verified: field→`$row` (or a row-scope binding), literal, arith, comparison, and/or/not, if); the string-formula parser re-targets `Expr`. Contract: `DeriveExpr` becomes an internal deprecated alias; a page-config migration (the existing chain, v6) rewrites stored trees. `expr` sits *below* core in the arrow — the convergence is import-legal today.
- **Aggregation:** one `AGG_OPS` runtime registry in core (`sum, avg, min, max, count, first, last`, extensible via registration) with alias map (`mean→avg`); `METRIC_AGG_VALUES`, `aggregate.agg`, `reduce.fn` all derive from it (`satisfies` against the registry — the discriminant-manifest pattern, reused).

### 4.4 M4 — the transform kernel + statistics verbs

- **Kernel manifest** (the discriminant-manifest pattern applied to steps): `KERNEL_OPS = ['filter','derive','select','rename','cast','sort','aggregate','window','join','fold','unfold']` + `SUGAR_OPS` where each sugar **must register a lowering** (step[]→kernel-step[]) proven row-identical (`FF-STEP-LOWERING-EQUIV`, the desugar contract generalized). Existing duplicates become sugar: `reduce`→`aggregate`, `lookup`→`join`, `concat`/`template`→`derive`, `rollup`→`aggregate`+append, `melt` renamed-alias of `fold` (keep `melt` accepted forever). `group` (hierarchy materializer) and `blend` (cross-store front-door) stay first-class — genuinely irreducible.
- **New verbs:** `unfold` (long→wide — the confirmed hole), `broadcast` (group aggregate onto rows without collapsing — enables "share of group total" without the derive/lookup contortion), `bin`, `impute` (method: value/mean/previous/linear; **emits the SDMX estimate/imputed status flag onto the row** — Law 9, the surpass), `timeUnit` (grain truncation — lands WITH D-GRAIN, not before; flag it as the door's consumer).
- **Payoff beyond hygiene:** a ~11-verb kernel with one Expr AST makes **per-field lineage** computable (which input fields feed which output field — feeds G2), keeps `extractDeps` exact as the grammar grows, and shrinks what the Constructor's sandbox must reason about.

### 4.5 M5 — the reified SDMX contract + lifecycle + discoverability (G5+G6)

- **`ManifestDataflow`** (contracts): `{ id, dimensions: [{ id, codelist?, isTime? }], grain }` — the DSD's load-bearing subset, delivered like `datasources[]`/metrics in the manifest. `MetricDef.dataflow?: string` → `sliceableBy` derived, never hand-listed. Validation of `metric` specs + palette greying + semantic ShowMe all read it.
- **Lifecycle:** `MetricDef.status?: 'draft'|'certified'|'deprecated'` (N3 — additive, expand-contract) + `catalogVersion` on the persisted site_config catalog with registered migrations (the page-config pattern, reused — G5's "metric versioning" in its minimal true form). Soft-warn on publishing a page binding a non-certified metric; never hard-gate (Guided-Canvas doctrine).
- **G6 folded — role-is-lens on the Data-model workspace:** one rail destination "Data model", visible to every session. **Author lens = the Data Dictionary** (read-only): metric cards with provenance, sliceability, certification badge, "used by N panels" (`computeMetricImpact`), lineage view (graph-read). **Steward lens = edit**: the existing `MetricCatalogManager`/`CalcBuilder`/`PipelineBuilder`/modeler, exactly where they are. The localStorage self-toggled gate is replaced by the session role. This is dbt-docs (discovery) + Looker Develop (edit) as *one* destination under two lenses — `FF-ROLE-IS-LENS` extended, `FF-AUTHOR-NO-QUERY` intact (the author lens contains no query surface). New gate: **FF-DATA-REACHABLE** — every registered data-capability surface is reachable from the default rail (the built-≠-buried lesson, made a fitness function).

### 4.6 Named datasets — the dataset DAG (sequenced AFTER V3, YAGNI-gated)

Page-level `datasets: Record<name, DataSpec>` + `{ $data: name }` as a spec source ref; each named dataset compiles to a shared graph cell; consuming nodes gain cell→cell edges (the engine was built for this — "a one-line addition"). This is Vega named-data + Power Query query-refs + Tableau's shared data source, achieved *by the graph* rather than a new runtime. **Do not build before V3 lands and a real duplication case exists** (CachedStore already dedupes store reads; the win is shared *derived* pipelines). Register as a door, not a wave.

---

## 5. Strangler-Fig path — every step reversible, contracts last

| Step | What lands | Reversibility | Gate |
|---|---|---|---|
| S0 | ADR-034 accepted + fitness scaffolds (`it.todo` — the honest-pending discipline) | delete docs | — |
| S1 (M3a) | `derive` accepts `Expr`; `lowerDeriveExpr` adapter; string parser → `Expr` | flag + adapter delete | FF-ONE-EXPR-DIALECT (no new `DeriveExpr` authored) · row-identical eval corpus |
| S2 (M3b) | `AGG_OPS` SSOT + aliases; three unions derive from it | type-level, alias-reversible | FF-AGG-ONE-VOCAB |
| S3 (M1) | `metric` discriminant + registered resolver + SPEC_CATALOG entry + extractDeps `metric:` edges; panel emits behind flag | unregister resolver; flag off | FF-METRIC-QUERY-EQUIV (a `metric` spec ≡ hand-written query/point-series form, row-identical) |
| S4 (M2) | `evalCalcAtGrain` + metric kinds (`growth`/`cumulative`) + provenance composition | additive path; scalar untouched | FF-CALC-GRAIN-SCALAR-IDENTICAL · FF-GROWTH-KIND-EQUIV (≡ legacy growth resolver) |
| S5 (M4) | kernel/sugar manifest + lowerings; new verbs (`unfold`, `broadcast`, `bin`, `impute`) | ops additive; lowerings flag-guarded | FF-STEP-LOWERING-EQUIV per sugar · FF-IMPUTE-FLAGS (imputed rows carry the status flag) |
| S6 (M5) | `ManifestDataflow` + `sliceableBy` validation + `status` + `catalogVersion` migrations | additive contract fields | FF-SLICEABLE-VALIDATES (invalid `by` = authoring-time error) · FF-CATALOG-MIGRATES |
| S7 (M5/G6) | Data-model rail destination + Dictionary (author) / edit (steward) lenses; role from session | rail entry removable | FF-DATA-REACHABLE · FF-AUTHOR-NO-QUERY (held) |
| S8 | named datasets (`$data`) + cell→cell edges | post-V3 only; flag | FF-DATASET-SHARED-CELL |
| **C1–C3 ⛔** | contracts: ratio-list→calc sugar · growth→kind · `DeriveExpr` removal · Constructor default = `metric` spec | **one-way doors — owner sign-off, each fired only on its green equivalence gate** (the R2/V3 protocol, reused) | the corresponding FF green on EVERY stored config |

Sequencing logic: S1/S2 first (cheapest, unblock everything), S3 before S4 (the noun exists before the algebra fills it), S5 independent (parallelizable), S6/S7 as one governance wave, S8 held. Nothing here blocks or is blocked by the running V-track (R/V one-way doors are orthogonal; `metric` specs enter the graph through the same `extractDeps` walk).

---

## 6. Fitness functions (the invariants, named once)

New: **FF-ONE-EXPR-DIALECT** · **FF-AGG-ONE-VOCAB** · **FF-METRIC-QUERY-EQUIV** · **FF-CALC-GRAIN-SCALAR-IDENTICAL** · **FF-GROWTH-KIND-EQUIV** · **FF-STEP-LOWERING-EQUIV** · **FF-IMPUTE-FLAGS** · **FF-SLICEABLE-VALIDATES** · **FF-CATALOG-MIGRATES** · **FF-DATA-REACHABLE**.
Held (must stay green throughout): FF-RAW-CODE-IDENTICAL · FF-ONE-RESOLUTION-PATH · FF-DESUGAR-EQUIV · FF-EXTRACTDEPS-TOTAL · FF-AUTHOR-NO-QUERY · FF-CATALOG-ONE-SSOT · roundtrip-dataspec.

---

## 7. What this study deliberately does NOT propose

- **No external semantic-layer runtime** (Cube/dbt-server) — Law 5; our layer is SDMX-native and the study confirms the SDMX DSD is the *stronger* structural contract.
- **No JSONata/jq-style path language in config** — arbitrary tree queries are a query language by the back door (FF-AUTHOR-NO-QUERY); `Expr.get` is the sanctioned subset.
- **No dataset-first authoring model** (Tableau/PBI) as the default — per-node binding + the graph outperforms it for our scale; named datasets enter only as a YAGNI-gated door (§4.6).
- **No new state store, no second resolution path, no second catalog** — every move routes through `resolveMeasureRef`, `registerSpec`, `desugar`, `extractDeps`, the migration chain: the five seams that are already the platform's spine.
