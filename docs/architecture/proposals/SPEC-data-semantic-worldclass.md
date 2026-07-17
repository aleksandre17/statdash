> **⛔ SUPERSEDED (2026-07-11) → [`SPEC-data-semantic-worldclass-fable.md`](./SPEC-data-semantic-worldclass-fable.md) (the canonical AR-50 SPEC).**
> This is the Opus half of the two-study AR-50 design. Its diagnosis converged with the canonical study (data-manipulation at/above class; semantic depth the gap), but its two headline proposals — the `RelationshipDef` peer noun and the separate `SemanticQuery` plane — were the *rejected* alternatives under the fixed decisions (D-AR50-1 reify the SDMX DSD instead; D-AR50-2 a `metric` DataSpec discriminant instead). Its additivity / `FF-NO-SUM-OF-RATIO` rationale is BUILT and folded into the canonical ADR. Its gap-map (§2, S1–S14) is a useful cross-reference. **For the plan of record, read the canonical SPEC + `ADR-034`, not this.** Kept for history.

---

# SPEC — Data-Object + JSON-Manipulation + Semantic Layer: the world-class benchmark study & target design

> Status: **SUPERSEDED by `SPEC-data-semantic-worldclass-fable.md`** (was: STUDY + DESIGN). Author: platform-architect (Opus). Date: 2026-07-11.
> Registry: propose **AR-50** (semantic relationships + grain/additivity + versioning) — folds/extends **AR-40** (semantic spine), closes ledger **G5** (semantic completeness) + **G6** (modeler discoverability), routes **N3** (certification) here.
> Companion ADR: `docs/architecture/decisions/ADR-025-semantic-relationships-grain-versioning.md`.
> Sibling instrument (do not duplicate): `docs/architecture/BENCHMARK-REFERENCE-PLATFORMS.md` — that file benchmarks the **constructor/authoring UX** axis; THIS file benchmarks the orthogonal **data-object + JSON-manipulation + semantic-model** axis. They meet at G6.
> Standard: MAXIMAL architecture, YAGNI-balanced population. Honesty rule: `None` rows kept visible — a benchmark that only lists gaps mis-calibrates our real standing (our transform grammar, expr canon, and the config-compiled reactive graph are genuinely reference-grade or ahead).

---

## 0. EXECUTIVE SUMMARY (for the owner)

We are **not behind** on the data-object + JSON-manipulation axis — our `TransformStep` grammar is a full dplyr/Vega-Lite verb set, our `@statdash/expr` is a done-right safe-eval canon, and our **config-compiled reactive graph** (`packages/core/src/graph/`) is a capability **no reference platform ships** (Vega compiles one view's dataflow; we compile a whole page's cross-node reactive graph from declarative config, target-agnostic). Where we genuinely lag is the **depth of the semantic layer as a governed model** — the leaders (LookML, Cube, Malloy, dbt Semantic Layer, Power BI tabular) model *relationships, grain, additivity, versioning, access, and a headless query API* as first-class governed nouns; we model **metrics and dimensions** well but stop there by design ("the refused LookML line"). The refusal was correct for *sql-on-a-metric*; it over-corrected into *no relationship noun at all*.

The five highest-leverage moves, each tagged **reversible** (expand-contract / Strangler, `git revert`-able) or **⛔** (one-way, owner-authorized):

| # | Where we fall short | Best-in-class / hybrid solution | What it unlocks | Tag |
|---|---------------------|--------------------------------|-----------------|-----|
| **M1** | **Joins are per-node `blend`/`join` config, re-authored each time — no governed relationship.** LookML `explore`+`join`, Cube `joins`, Power BI model relationships, dbt `entities` all define a join ONCE and reuse it. | A new **`ManifestRelationship`** governed noun (the PEER of metric/dimension), between cube dimensions/DSDs. `blend`/`join` steps gain a `$rel: <id>` reference; a **join-path planner compiles the shortest path from the relationship graph** — exactly as we already compile the reactive graph from config. Keeps `MetricDef` thin (no sql on the metric; the join lives on the relationship peer). | Define-once joins, multi-store queries that auto-path, regional/sectoral profiles that compose across cubes. The **surpass**: nobody compiles *both* the reactive dependency graph *and* the join path from declarative config. | **reversible** |
| **M2** | **`agg: sum\|avg\|last` is too thin for national accounts.** A stock (debt) is semi-additive (sum over sector, LAST over time); a flow (GDP) is additive; a ratio (deflator) is non-additive (must be RE-DERIVED at each grain, never summed). Today `agg` is carried but "not consumed by an interpreter"; summing a ratio silently corrupts. DAX semi-additive measures + Cube rolling windows model this. | Extend the metric's aggregation into a **grain-aware additivity model** (`additivity: additive \| semi-additive \| non-additive`, with a per-axis rule for semi-additive). Non-additive metrics route through their `calc` at the target grain (the reactive graph makes recompute-at-grain mechanically free). | Statistics-grade correctness — the single most scientifically important gap. A ratio can never be silently summed again. SDMX-native (grain = the generic time/OLAP axis). | **reversible** |
| **M3** | **No versioning or certification lifecycle on semantic nouns.** Catalog is last-write-wins; a stored config pins nothing. dbt/LookML version via git+PR; Tableau/Power BI/Looker/Collibra ship certified/endorsed states; LookML has `access_grant`. | Additive `version` + `lifecycle` (`draft → certified → deprecated`) on `ManifestMetric`/`ManifestDimension`/`ManifestRelationship` (expand-contract). Optional version-pin on a metric-ref. Certification badge in BOTH authoring and runner (Law 9 kinship with `preliminary`). | Governed evolution — stored configs never silently break; a methodology owner certifies a number; deprecation warns before it breaks. Closes **G5** + **N3**. | **reversible** |
| **M4** | **The query is trapped inside a render node.** `DataSpec.query` couples an ObsQuery+pipe+encoding to a chart. Cube (REST/GraphQL/SQL), dbt SL (JDBC), Malloy expose a **headless typed query API** over the model. | Extract a first-class **`SemanticQuery`** object (`measures[] · dimensions[] · filters · timeDimension · grain · order · limit`) — the Cube/dbt-SL query shape — that the **DataSource port answers headlessly** (no chart). `DataSpec.query` becomes `SemanticQuery + encoding`. | API-first / headless consumption, embed, Constructor live-preview, third-party access, and the reactive graph as a genuine query engine. Closes the "typed query API" half of **G5**. | **reversible** |
| **M5** | **(a) TWO JSON expression dialects** — `DeriveExpr` (transform row-derive) and `@statdash/expr` `Expr` (metric-calc + visibility). Law 4 says adopt one standard WHOLE. **(b) G6: the whole modeler is built-but-buried** behind a default-off `steward` localStorage flag — the owner could not find it. | (a) Consolidate on **`@statdash/expr` as the single dialect** across derive + calc + visibility + pipe refs (Strangler: `DeriveExpr` → adapter → `Expr`, then contract). (b) Make the **Semantic Model workspace a first-class discoverable destination** (visible rail entry, subtly steward-marked); author default stays the governed Metric Palette (FF-AUTHOR-NO-QUERY intact). | One grammar to learn, test, and gate (kills a whole "which dialect?" class). A modeler the owner can actually reach. Closes **G6**. | (a) **reversible** · (b) **reversible** (reachability, not a rewrite) |

**Sequencing recommendation:** M5b (discoverability — cheapest, unblocks the owner using what exists) → M3 (versioning/certification — small, additive, high governance value) → M2 (additivity — highest scientific value, national-accounts-critical) → M4 (SemanticQuery extraction — the API-first spine) → M1 (relationships + join-path planner — the biggest capability jump, sequence like a coordinated packages change). M5a (dialect consolidation) runs as a background Strangler alongside. **None is a one-way door**; each lands behind a green fitness gate and reverts by `git revert`.

---

## 1. Ground truth — what we already have (verified in code, do NOT redesign the world-class parts)

### 1.1 Data-object model — `DataSpec` (`packages/core/src/config/data-spec.ts`)
A discriminated union — `query · row-list · timeseries · growth · ratio-list · pivot · transform` (+ the internal `point-series` lowering primitive). Registry-extensible via `registerSpec` (the single OCP extension path — the `custom`/`fn` escape hatch was deliberately removed, ENG-16). 100% JSON-serializable. Carries a **first-class `timeDimension`** (Cube `timeDimensions` parity: `dim · range · granularity`) — the granularity door exists but is inert at the resolve seam today.

### 1.2 JSON-manipulation — the `TransformStep` pipeline (`packages/core/src/data/transform/`)
A **full declarative verb grammar** — `melt · rename · cast · filter · sort · concat · template · addField · select · derive · aggregate · rollup · lookup · join · group · reduce · window · joinByField · blend`. Each verb is JSON-serializable, cites its lineage (Vega-Lite fold/calculate/lookup, pandas/dplyr, OLAP rollup, Grafana/Tableau blend), has a Constructor-authorable schema (`op-schemas.ts`) and a registry (`step-registry.ts`). Declarative refs (`$ctx` state, `$cl` classifier, `$d` display) resolve at apply time. `blend` is the Constructor-safe front-door that the react binding layer desugars to the engine-internal `joinByField` (single-store core preserved).

### 1.3 Expression canon — `@statdash/expr` + `DeriveExpr`
`@statdash/expr` is the sandboxed, whitelisted, `registerExprOp`-extensible AST — no `eval`, JSON-serializable (Benchmark Part I row 3 = None). It is the compile target of the visual calc builder (`metricCalc.ts` templates → `Expr` tree, byte-identical to hand-authored). **Finding:** a SECOND JSON expression dialect, `DeriveExpr`, lives in `transform/types.ts` for row-`derive` — a latent "two dialects" smell (see M5a).

### 1.4 Semantic layer — the governed nouns
- **`MetricDef`** (`data/metric.ts`) — base (`code`) + calculated (`calc: MetricCalc` = named `inputs` + an `@statdash/expr` `expr`). Governance: `label · unit · format · agg · parent · methodology · description · dataSource · dims`. Resolved through the ONE `resolveMeasureRef` seam (Postel: a raw code passes through byte-identical). **Deliberately thin — no filters/joins/sql (the "refused LookML line").**
- **`DimensionDef`** (`data/dimension.ts`) — the PEER of metric (Law 1). Curates a cube dimension: `code · label · conceptRole(open string) · defaultMember · members(whitelist) · description`. Members resolve FROM the DSD at runtime (Law 5) — never copied into config. **No hierarchy/levels noun.**
- **Wire contracts** (`contracts/manifest.ts`) — `ManifestMetric` / `ManifestDimension` / `ManifestMetricCalc` / `ManifestMetricInput`, delivered site_config → `/api/bootstrap` → `registerMetrics`/`registerDimensions` at boot. `fromSDMX` is the sole adapter (Law 5).
- **Authoring** (`apps/panel/src/studio/model/`) — `semanticCatalog.store` (editable working copy), `MetricCatalogManager`, `MetricEditor`, `CalcBuilder`/`ExprTreeEditor`, `metricCalc.ts` (visual derived-metric template registry: ratio/percentage/difference/sum/scale), `metricValidation.ts`, `metricImpact.ts` (reverse-dependency index), `calcCreatesCycle` (cycle guard).

### 1.5 The config-compiled reactive graph (`packages/core/src/graph/`) — the surpass asset
`compilePage(page, derive)` walks the declarative tree, runs `extractDeps` per data-bearing node (edge set: dims/params/vars/perspective/classifiers/stores/locale), maps each to a namespaced SOURCE key, and registers one **pull-lazy, push-invalidate, value-equality-cutoff** reactive cell per node in a **zero-dep, framework-free `ReactiveGraph`**. `diffState` emits only the source keys whose value actually changed (writing the same value re-evaluates zero). Shadow-only at V2 (render path still authoritative; deleting `src/graph/` reverts). **This is the platform's structural edge — a whole page's dataflow derived, not hand-wired, from config.**

---

## 2. THE GAP-MAP (capability × reference-platform × have / gap / surpass)

Legend: **Have** = at/above the standard · **Partial** = seam exists, under-built · **Gap** = no seam · **Surpass** = we lead the class.
Refs: LookML (Looker) · Cube · Malloy · dbt-SL/MetricFlow · DAX/Power-BI tabular · Vega-Lite · dplyr/Tidy · Power Query M · Arquero · JSONata/jq · DuckDB.

| # | Capability | Reference leaders ship | We today (cited) | Verdict |
|---|-----------|------------------------|------------------|---------|
| D1 | **Declarative transform verbs** | Vega-Lite transform · dplyr/Tidy verbs · Power Query M · Arquero | Full `TransformStep` grammar (18 verbs), schema+registry, declarative refs (`transform/types.ts`, `op-schemas.ts`) | **Have** (reference-grade; whole-standard per Law 4) |
| D2 | **Safe expression language** | Vega calc · JSONata · DAX · Cube member expr | `@statdash/expr` AST, whitelisted, `registerExprOp`, no eval (Benchmark row 3) | **Have** |
| D3 | **One expression dialect** | dbt = Jinja+SQL only · Malloy = one lang | **TWO dialects** — `DeriveExpr` + `@statdash/expr` | **Gap (M5a)** |
| D4 | **Reactive dataflow from config** | Vega dataflow (one view) · Cube (none at config) · signals libs (imperative) | Whole-page graph compiled from config, target-agnostic (`graph/`) | **Surpass** |
| D5 | **Row-set ⟷ scalar measure unity** | LookML/Malloy/DAX — a measure works at ANY grain (scalar or grouped) | `MetricCalc` is **SCALAR-only** ("consumed at a point coordinate"); row-set aggregation is the separate `transform` plane | **Gap (deep — §4.6)** |
| S1 | **Metric definition** | LookML measure · Cube measure · Malloy · dbt · DAX | `MetricDef` (base+calc), `resolveMeasureRef` SSOT, delivered via manifest | **Have** |
| S2 | **Derived-metric algebra** | Malloy · dbt derived · Cube `ratio` · DAX | `MetricCalc` = inputs + `@statdash/expr`; visual builder (`metricCalc.ts`) | **Have** (+ visual authoring = Surpass) |
| S3 | **Dimension modeling** | LookML dimension · Cube · Power-BI columns | `DimensionDef` (governed curation over DSD, Law-5 native) | **Have** |
| S4 | **Dimension hierarchies / levels / drill** | SSAS/Power-BI hierarchies · LookML `drill_fields` · OLAP levels | No hierarchy noun; `parent` on metric + `group` transform materializes ad-hoc | **Gap (§4.5)** |
| S5 | **Relationships / joins as governed nouns** | LookML `explore`+`join` · Cube `joins` (+ join graph) · Power-BI model · dbt `entities`/`semantic_models` | **Per-node `blend`/`join` config only** — re-authored each time; no governed relationship, no join graph | **Gap (M1 — biggest)** |
| S6 | **Grain / additivity / aggregation-awareness** | DAX semi-additive · Cube pre-agg grain selection · LookML `aggregate_awareness` · Malloy nesting | `agg: sum\|avg\|last` carried but **not consumed**; `granularity` door inert | **Gap (M2 — highest science value)** |
| S7 | **Metric/model versioning** | dbt/LookML (git+PR) · Cube (supports) | Config has `schemaVersion`+migration chain; **semantic nouns have NO version** | **Gap (M3 / G5)** |
| S8 | **Access grants / certification lifecycle** | LookML `access_grant` · Looker/Tableau certified · Power-BI endorsement · dbt access · Collibra | Only publish-state on the page; **no per-metric access or certification** | **Gap (M3 / N3 / Benchmark row 10)** |
| S9 | **Headless typed query API** | Cube REST/GraphQL/SQL · dbt SL JDBC · Malloy · LookML query | Query trapped in `DataSpec.query` (render-coupled); no standalone semantic query | **Gap (M4 / G5)** |
| S10 | **Caching / pre-aggregation** | Cube pre-aggregations · Power-BI aggregations · LookML PDT/agg-awareness | `CachedStore` + warm (store-level); **no metric-level pre-agg / grain rollup** | **Partial (§4.7)** |
| S11 | **Provenance / lineage** | Collibra · dbt-docs · Sigma lineage · Power-BI | SCD-2 `reference-metadata`, `agency_scheme` (AR-20), `methodology`/`preliminary` badges, lineage vision AR-43; graph makes lineage mechanically free (G2) | **Have→Surpass** (SDMX-native, at the number) |
| S12 | **Constructor-authorability + completeness gate** | None enforce authoring-completeness (they trust the schema author) | `coverage.fitness.test` — every DataSpec/TransformStep/ParamDef authorable is a BUILD GATE; visual calc builder | **Surpass** |
| S13 | **SDMX-nativeness** | None are SDMX-native (all SQL/warehouse-native) | `fromSDMX` sole adapter; DSD-resolved members; SDMX provenance | **Surpass** (our substrate, our moat) |
| S14 | **Discoverability of the modeler** | Tableau Data pane always present · Looker Develop discoverable · Retool/Metabase visible resources | Modeler built but **buried behind default-off `steward` localStorage** (G6) | **Gap (M5b / G6)** |

**Read of the map.** Data-object + JSON-manipulation (D1–D4) is **at or above** the class — with D4 a clear lead. The concentration of red is the **semantic model's governed-noun depth** (S4–S9) — precisely the half we deferred as "the refused LookML line." The refusal was right about *sql-on-a-metric*; it left us with **no relationship, no grain-additivity, no versioning/access, no headless query** — which the leaders treat as the core of a semantic layer. The target design closes S4–S9 **on our SDMX-native substrate**, keeping `MetricDef` thin by putting each new capability on the RIGHT noun (a relationship peer, an additivity field, a version field) rather than bloating the metric.

---

## 3. The refused-LookML-line, re-drawn (the governing principle)

The existing refusal ("no filters/joins/sql on `MetricDef`") is sound SRP — but it conflated *"don't put a query language ON the metric"* with *"don't model relationships/grain/versioning AT ALL."* The world-class leaders separate these:

- **LookML** puts joins on the **`explore`/`view`**, not smeared across measures; a `measure` stays a pure aggregation.
- **Cube** puts joins in a top-level **`joins:` block** with a join graph; a `measure` stays thin.
- **dbt SL** models **`entities`** + **`semantic_models`** as peers of metrics.
- **Power BI** models relationships in the **model diagram**, measures in DAX.

**Re-drawn line for us:** the metric stays thin; every governed *structural* concept becomes its **own peer noun** (Law 1 — equal citizens), delivered through the same manifest channel, registered through the same boot seam, resolved through the same kind of SSOT seam. This is the SOLID way to grow the layer without a modeling language leaking onto the metric:

```
Governed nouns (peers, Law 1, all thin, all manifest-delivered, all *-native to SDMX):
  MetricDef        — a number (base code | calc algebra)          [have]
  DimensionDef     — a governed cube dimension                     [have]
  RelationshipDef  — a governed join between dimensions/DSDs        [M1 — NEW]
  (additivity)     — a grain-behavior FIELD on the metric          [M2 — additive field]
  (version/lifecycle) — governance FIELDS on every noun            [M3 — additive fields]
  SemanticQuery    — a headless typed query over the model         [M4 — NEW, the query API]
```

Everything a leader does with a modeling *language*, we do with **typed governed data + the registry + the compiler** — declarative, serializable, Constructor-authorable (M-8), and gated for completeness (S12). That is the hybrid that is more refined than any single reference platform.

---

## 4. TARGET ARCHITECTURE (the recommended world-class hybrid)

### 4.1 M1 — `RelationshipDef`: governed joins + a compiled join-path planner  *(reversible)*
Add a third governed noun, the peer of metric/dimension:

```ts
// packages/core/src/data/relationship.ts  (NEW pure vocabulary leaf; Law 1 peer)
export interface RelationshipDef {
  id:        string
  // The two governed dimensions (or DSD keys) this relationship joins. Generic (Law 1).
  left:      { dim: string; field?: string }   // field defaults to the dim's key
  right:     { dim: string; field?: string; storeKey?: string }  // right may live in another store
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  // Governance (M3): version + lifecycle carried on every noun.
  version?:  number
  lifecycle?: 'draft' | 'certified' | 'deprecated'
  label?:    LocaleString
}
```

- **`blend`/`join` steps gain a `$rel: <id>` reference** — the join key/right-source/cardinality are read from the governed relationship instead of re-specified inline. Inline `blend` stays valid (Postel; expand-contract). A relationship is **defined once, referenced everywhere**.
- **The join-path planner** (extends the graph insight, D4): given a query touching measures/dimensions across stores, `compileJoinPath` runs shortest-path over the `RelationshipDef` graph to derive the `blend` chain — *compiled from config*, exactly as `compilePage` compiles the reactive graph. **This is the surpass** — Cube plans join paths at query time in its engine; we plan them **from declarative config, statically, and the plan is itself serializable/inspectable** (feeds the AR-43 lineage readout for free).
- **Law-5 native:** relationships are between **cube dimensions/DSDs**, resolved through `fromSDMX`; no foreign join engine.
- **Constructor:** a relationship editor (peer of the metric editor) + `op-schemas` entry so `$rel` is authorable; `coverage.fitness` extends to assert every relationship is authorable.
- **Reversible:** additive noun + additive `$rel` field; deleting the noun reverts to inline `blend`.

### 4.2 M2 — grain-aware additivity (stocks / flows / ratios)  *(reversible)*
The single most scientifically important move. Extend the metric's aggregation from a flat `agg` into a **grain-aware additivity model**:

```ts
// on MetricDef / ManifestMetric (additive, expand-contract):
additivity?: 'additive' | 'semi-additive' | 'non-additive'
// semi-additive needs a per-axis rule: which axis is summed vs last-valued.
semiAdditive?: { additiveOver: string[]; nonAdditiveOp: 'last' | 'first' | 'avg' }  // Law 1 generic axes
```

- **additive** (flows — GDP, output): `sum` over every axis (today's default).
- **semi-additive** (stocks — debt, population, capital): `sum` over space/sector, **`last` over time** (DAX `LASTNONBLANK` pattern). `semiAdditive.additiveOver` names the summable axes (generic, Law 1); the time/non-additive axis takes `nonAdditiveOp`.
- **non-additive** (ratios — deflator, share, per-capita): **may never be aggregated by summing** — it is **re-derived from its `calc` at the target grain**. The reactive graph (D4) already recomputes a cell at a new coordinate; this routes a non-additive metric's grain change through its `calc` instead of a rollup. A fitness gate (`FF-NO-SUM-OF-RATIO`) forbids a non-additive metric reaching a `sum`/`rollup` reducer.
- **Consumes the inert seams:** `timeDimension.granularity` (the grain axis) + `MetricDef.agg` (today "carried but not consumed") both become live here.
- **SDMX-native:** grain is the generic time/OLAP axis (Law 1); nothing hardcodes "year."
- **Reversible:** absent ⇒ today's flat `sum`/`agg` behavior byte-identical (`FF-ADDITIVITY-DEFAULT-IDENTICAL`).

### 4.3 M3 — versioning + certification lifecycle on every noun  *(reversible)*
Additive governance fields (expand-contract, parallel-change) on `ManifestMetric` / `ManifestDimension` / `RelationshipDef`:

```ts
version?:   number                                   // monotonic; catalog keeps history
lifecycle?: 'draft' | 'certified' | 'deprecated'     // governance state (Law-9 kin of `preliminary`)
```

- **Version pin (optional) on a metric-ref:** `{ measure: 'gdp', atVersion: 3 }` — a stored config can pin a version so it never silently drifts (dbt/LookML git-pin parity, made declarative). Absent ⇒ latest (byte-identical).
- **Certification badge** on `<MetricCard>` in BOTH lenses (authoring + runner), filterable in the palette (Tableau Certified / Power-BI endorsement parity). Publishing a page that binds a non-certified metric **soft-warns** (not a hard gate — Guided-Canvas doctrine).
- **Access grants** (LookML `access_grant`) fold into the within-tenant authz proposal (Benchmark row 10) — **flagged, not built here** (it needs the roles model; keep this move to versioning+certification).
- Closes **G5** (versioning) + **N3** (certification). Distinct from AR-47 (which governs *config* change; this governs the *noun*).
- **Reversible:** additive fields; absent ⇒ status quo.

### 4.4 M4 — `SemanticQuery`: the headless typed query API  *(reversible)*
Lift the query out of the render node into a first-class object the DataSource port answers:

```ts
// packages/core/src/data/semantic-query.ts (NEW) — the Cube/dbt-SL query shape, SDMX-native
export interface SemanticQuery {
  measures:      string[]                    // metric-ids or raw codes (resolveMeasureRef)
  dimensions?:   string[]                    // governed dimension-ids (group-by axes)
  filters?:      Record<string, FilterValue> // coordinate constraints (Law 1 generic)
  timeDimension?: TimeDimensionSpec          // grain-aware time (already first-class)
  grain?:        Record<string, string>      // per-axis grain / LOD
  order?:        Array<{ field: string; dir: 'asc' | 'desc' }>
  limit?:        number
}
```

- `DataSpec.query` becomes **`{ type:'query', semantic: SemanticQuery, pipe?, encoding }`** — the ObsQuery+timeDimension+rowLimit it already carries, re-expressed as a reusable, render-decoupled object (Postel: today's shape maps 1:1; `FF-QUERY-LOSSLESS`).
- **The DataSource port answers a `SemanticQuery` with rows — no chart** (headless / API-first, Law 5-clean). Exposed via `apps/api` as a typed endpoint (Cube REST/GraphQL parity) so embed, Constructor preview, and third parties consume the model directly.
- **The reactive graph becomes a real query engine:** a `SemanticQuery` cell is a first-class graph node; `extractDeps` already reads exactly its dep surface.
- **Reversible:** the wrapper is additive; the existing `query` branch stays until the contract step. `git revert`-able.

### 4.5 S4 — dimension hierarchies (fold into M1's noun family, defer population)
A `DimensionDef.hierarchy?: { levels: string[] }` (OLAP levels / LookML `drill_fields`) — the governed drill path the `group` transform already materializes ad-hoc. **YAGNI-gated:** design the field with M1, populate when a real drill consumer exists (the reactive graph makes drill mechanically cheap once the levels are declared). Flagged, not built now.

### 4.6 D5 — row-set ⟷ scalar measure unity (the deep surpass-target, sequence last)
Today `MetricCalc` is **scalar-only**; row-set aggregation is the separate `transform` plane. Leaders' measures work at ANY grain. The target: a metric's `calc`/`agg`/`additivity` becomes the **single definition** that the query planner applies whether the consumer wants a scalar (KPI) or a grouped row-set (chart) — the metric computes correctly at whatever grain the `SemanticQuery` asks for. This unifies the two computation planes behind one governed definition (the Malloy/LookML "measure is grain-polymorphic" property). **Deep — sequence after M1+M2+M4 land** (it composes them: relationships give the join path, additivity gives the grain rule, SemanticQuery gives the grain request). Flagged as the north-star unification, not this cycle's build.

### 4.7 S10 — metric-level pre-aggregation (fold into caching, YAGNI-gated)
`CachedStore`+warm cover store-level caching. Cube-style pre-aggregations (materialize a metric at a coarse grain, serve fine queries from it) become mechanically expressible once M2 (grain) + M4 (SemanticQuery) exist — the warm layer pre-computes a `SemanticQuery` at a declared grain. **Defer** until a real latency need appears (the reactive graph's value-equality cutoff already eliminates most recompute).

### 4.8 M5 — one dialect + a reachable modeler
- **M5a (dialect consolidation, background Strangler):** `DeriveExpr` (transform row-derive) folds into `@statdash/expr`. Strangler: a `DeriveExpr → Expr` adapter first (both are JSON trees over the same ops), migrate `derive` to accept `Expr`, then contract `DeriveExpr`. One grammar to learn/test/gate; kills the "which dialect?" class. `FF-ONE-EXPR-DIALECT`. Reversible per step.
- **M5b (G6 discoverability):** the Semantic Model workspace (`DataModelingPanel`/`PipelineBuilder`/`TransformEditor`/`FieldWells`/`ShowMe`) becomes a **first-class discoverable rail destination** (visible, subtly steward-marked), replacing the default-off `steward` localStorage gate as the *only* door. Author default surface stays the governed Metric Palette (metric-first vision + FF-AUTHOR-NO-QUERY intact). **Reachability, not a rewrite** — the owner-decision-pending recommendation, now concrete. Closes **G6**.

---

## 5. Reversible Strangler build path (Law 7)

Every step lands behind a green fitness gate and reverts by `git revert`. No one-way door without owner sign-off (none required for M1–M5 as designed — all expand-contract).

| Wave | Move | Gate (must be green before contract) | Reversible? |
|------|------|--------------------------------------|-------------|
| **0** | **M5b** discoverability — rail entry for the modeler | manual reachability audit (built→surfaced→discoverable) | yes (UI-only) |
| **1** | **M3** version+lifecycle fields + certification badge | `FF-NOUN-VERSION-ADDITIVE` (absent ⇒ identical); badge renders both lenses | yes (additive) |
| **2** | **M2** additivity model (additive/semi/non) + live grain | `FF-ADDITIVITY-DEFAULT-IDENTICAL` + `FF-NO-SUM-OF-RATIO` | yes (additive) |
| **3** | **M4-expand** `SemanticQuery` object + `DataSpec.query` wrapper | `FF-QUERY-LOSSLESS` (every stored query maps 1:1) | yes |
| **4** | **M4-contract** headless DataSource port answers `SemanticQuery`; api endpoint | port parity vs render path (golden rows) | yes (revert the endpoint) |
| **5** | **M1-expand** `RelationshipDef` noun + `$rel` on blend/join + relationship editor | `coverage.fitness` (relationship authorable); inline `blend` still valid | yes (additive) |
| **6** | **M1-contract** join-path planner compiles the blend chain from the relationship graph | `FF-JOINPATH-PARITY` (planned chain == hand-authored blend, golden rows) | yes (revert planner; keep inline) |
| **bg** | **M5a** `DeriveExpr → @statdash/expr` consolidation | `FF-ONE-EXPR-DIALECT` (derive parity through the adapter) | yes (per-step) |
| **later** | **D5** row-set⟷scalar unity · **S4** hierarchies · **S10** pre-agg | YAGNI-gated on a real consumer | — |

**Invariant fitness functions introduced** (each an executable gate, not a comment): `FF-QUERY-LOSSLESS`, `FF-JOINPATH-PARITY`, `FF-ADDITIVITY-DEFAULT-IDENTICAL`, `FF-NO-SUM-OF-RATIO`, `FF-NOUN-VERSION-ADDITIVE`, `FF-ONE-EXPR-DIALECT` — plus the existing `FF-RAW-CODE-IDENTICAL`, `FF-ONE-RESOLUTION-PATH`, `FF-CALC-EXPR-SANDBOXED`, `coverage.fitness` extended to the new nouns.

---

## 6. Constraint compliance (the hard floor — checked)

- **Law 2 (declarative):** every new noun/field is pure JSON data (a `RelationshipDef`, an `additivity` enum, a `SemanticQuery` object, a `version` number) — no functions-in-config, no imperative escape. The join-path and grain-recompute are **compiled from that data**, not authored as logic. ✅
- **Law 4 (standards whole):** we adopt Cube `joins`+`timeDimensions`, LookML `explore`-separation + `access_grant`, DAX semi-additive, dbt `entities`+versioning, Malloy grain-polymorphism — each in its best form, on our substrate. M5a makes the expression standard whole (one dialect). ✅
- **Law 5 (single adapter):** relationships are between SDMX dimensions/DSDs; members resolve from the DSD; `SemanticQuery` answers through the store port; **no foreign engine (Cube/LookML) as runtime.** We learn from them, surpass on `fromSDMX`. ✅
- **Law 1 (no privileged dims):** every axis (join keys, additivity axes, grain, SemanticQuery dimensions) is a generic `Record<K,V>` / string key — never `year`/`region`. ✅
- **Dependency arrow:** new nouns are pure vocabulary leaves in `packages/core/src/data/` (peers of metric.ts, forbidden from importing `registry/`); the join-path planner lives in core (target-agnostic, like `compilePage`); the api endpoint lives in `apps/api` over `contracts` only. ✅
- **Constructor-readiness / M-8:** each new capability = a new declarative discriminant/field, authorable, with a `coverage.fitness` extension — interface unchanged (OCP). Non-programmer authors a relationship/additivity/version by picking, never typing a language. ✅

---

## 7. What we deliberately do NOT do (the held line)

- **No sql/filters/joins ON the metric** — joins go on the `RelationshipDef` peer; `MetricDef` stays a thin vocabulary leaf.
- **No foreign semantic engine as runtime** — no Cube/LookML server; we grow OUR SDMX-native layer (Law 5).
- **No second query dialect** — `SemanticQuery` reuses `@statdash/expr` + the existing ObsQuery/timeDimension; M5a removes the one dialect we accidentally have.
- **No hard authoring gates** — certification soft-warns; the Guided-Canvas non-blocking doctrine holds.
- **No gold-plating** — S4 (hierarchies), S10 (pre-agg), D5 (grain-polymorphism) are designed-but-deferred behind a real-consumer YAGNI gate.

---

## 8. Decision requested of the owner

Approve the **sequence** (M5b → M3 → M2 → M4 → M1, M5a background) and the **AR-50 registration** (semantic relationships + grain/additivity + versioning), OR re-rank. The core structural decision (peer-noun growth vs bloating the metric; compile-the-join-path; SDMX-native refusal of a foreign engine) is captured in **ADR-025**. Nothing here is a one-way door; the first buildable step (M5b) is pure reachability.
