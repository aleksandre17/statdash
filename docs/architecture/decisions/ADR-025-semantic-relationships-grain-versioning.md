> **⛔ SUPERSEDED (2026-07-11) → [`ADR-034-semantic-query-plane-and-measure-algebra.md`](./ADR-034-semantic-query-plane-and-measure-algebra.md) (the canonical AR-50 ADR).**
> This is the Opus half of the two-study AR-50 design. Its substance is folded into ADR-034; its two headline proposals were the *rejected* alternatives under the fixed decisions: the `RelationshipDef` new noun (rejected by **D-AR50-1** in favour of reifying the SDMX DSD) and the separate `SemanticQuery` plane (rejected by **D-AR50-2** in favour of a `metric` DataSpec discriminant). The additivity / `FF-NO-SUM-OF-RATIO` rationale below is BUILT (`87aea32`) and lives on in ADR-034. Kept for history — read ADR-034, not this.

---

# ADR-025 — Grow the semantic layer via governed PEER NOUNS (relationships · grain-additivity · versioning), compiled from config, on the SDMX-native substrate

- Status: **SUPERSEDED by ADR-034** (was: PROPOSED — decision artifact, no code)
- Date: 2026-07-11
- Author: platform-architect (Opus)
- Companion: `docs/architecture/proposals/SPEC-data-semantic-worldclass.md` (benchmark, gap-map, Strangler path)
- Registry: proposes **AR-50**; closes ledger **G5**, **G6**; routes **N3** here; extends **AR-40**
- Related: ADR-024 (config-compiled reactive graph — the mechanism this decision builds on), ADR-023 (one-type-system-two-residences), ADR-015 (statistical-platform north-star)

## Context

Benchmarking our data-object + JSON-manipulation + semantic layer against the strongest reference platforms (LookML, Cube, Malloy, dbt Semantic Layer, Power BI tabular; and for transforms Vega-Lite, dplyr, Power Query, Arquero) produced a clear read (full gap-map in the companion SPEC):

- **Data-object + JSON-manipulation is at/above the class.** Our `TransformStep` grammar is a full dplyr/Vega-Lite verb set; `@statdash/expr` is a done-right safe-eval canon; and the **config-compiled reactive graph** (`packages/core/src/graph/`) is a capability no reference platform ships (they compile at most one view's dataflow; we derive a whole page's cross-node reactive graph from declarative config).
- **The semantic layer's governed-noun DEPTH lags.** We model **metrics** (`MetricDef`, base + calc) and **dimensions** (`DimensionDef`) well, then stop — the deliberate "refused LookML line" (no filters/joins/sql on the metric). The leaders additionally model, as first-class governed concepts: **relationships/joins** (LookML `explore`+`join`, Cube `joins`, Power-BI model, dbt `entities`), **grain/additivity** (DAX semi-additive, Cube pre-agg grain, LookML aggregate-awareness), **versioning + access/certification** (dbt/LookML git-pin, LookML `access_grant`, Tableau/Power-BI certified), and a **headless typed query API** (Cube REST/GraphQL/SQL, dbt SL JDBC).

The refusal was correct about *sql-on-a-metric* but over-corrected into *no relationship/grain/version concept at all*. National-accounts correctness makes one of these gaps acute: `agg: sum|avg|last` is carried but never consumed, so a **non-additive ratio (deflator, share) can be silently summed** — a scientific defect.

The decision: **how do we grow the semantic layer to and beyond the leaders without importing a modeling language or a foreign engine, and without bloating the thin metric?**

## Decision

**Grow the semantic layer by adding GOVERNED PEER NOUNS and additive governance FIELDS — never a modeling language on the metric, never a foreign runtime engine — and COMPILE structural behavior (join paths, grain recompute) from that declarative data, extending the config-compilation insight the reactive graph already proves.**

Concretely:

1. **`RelationshipDef`** — a new pure vocabulary leaf (`packages/core/src/data/relationship.ts`), the Law-1 peer of `MetricDef`/`DimensionDef`, delivered through the same manifest→boot channel. Joins are **defined once** on the relationship and **referenced** by `blend`/`join` via `$rel: <id>`. A **join-path planner compiles the blend chain** from the relationship graph (shortest-path over the governed nouns) — the way `compilePage` compiles the reactive graph. This keeps `MetricDef` thin: the join lives on the relationship peer, mirroring LookML's `explore`/Cube's `joins:` separation, not smeared onto the measure.

2. **Grain-aware additivity** — additive `additivity` (`additive | semi-additive | non-additive`) + `semiAdditive` per-axis rule ON the metric (a *behavior field*, not a language). Additive sums everywhere; semi-additive sums over generic space/sector axes and `last`-values over the grain axis (DAX semi-additive parity); non-additive is **re-derived from its `calc` at the target grain** (the reactive graph already recomputes a cell at a new coordinate) and is **forbidden by fitness gate from reaching a `sum`/`rollup`**. Consumes the two inert seams (`timeDimension.granularity`, `MetricDef.agg`).

3. **Versioning + certification** — additive `version` + `lifecycle` (`draft|certified|deprecated`) on every governed noun (expand-contract, parallel-change), optional version-pin on a metric-ref, a certification badge in both authoring and runner lenses (kin of the existing `preliminary` provenance, Law 9). Access grants are flagged into the within-tenant authz proposal, not built here.

4. **`SemanticQuery`** — a first-class typed, serializable query object (`measures/dimensions/filters/timeDimension/grain/order/limit` — the Cube/dbt-SL shape) that the **DataSource port answers headlessly**, decoupling the query from the render node. `DataSpec.query` becomes `SemanticQuery + encoding` (lossless, Postel). Exposed as a typed api endpoint (headless/API-first, Law 5-clean).

All four are **pure JSON data** (Law 2), **SDMX-native** (Law 5 — between DSD dimensions, answered through the store port, no foreign engine), **generic over axes** (Law 1), **Constructor-authorable with a `coverage.fitness` extension** (M-8/OCP), and land via **expand-contract Strangler** behind green fitness gates (Law 7).

## Rejected alternatives

### ALT-A — Adopt a foreign semantic engine (Cube or LookML) as the runtime
Embed Cube.dev (or transpile to LookML) as the semantic runtime, gaining relationships/grain/pre-agg/query-API "for free."
**Rejected.** Violates **Law 5** (`fromSDMX` is the ONLY adapter boundary; a Cube/LookML runtime is a second, SQL/warehouse-native adapter that does not speak SDMX DSDs or our provenance model). It would fork the substrate, duplicate the store, and subordinate our SDMX-native provenance/`agency_scheme`/preliminary machinery to a warehouse model that has no concept of it. We **learn from** these engines (their noun models are the reference) and **surpass** them on our own substrate — we do not host them. Also violates the dependency arrow (a foreign engine is neither a vocabulary leaf nor arrow-clean).

### ALT-B — Put joins/filters/grain directly on `MetricDef` (become LookML-on-the-metric)
Add `joins`/`filters`/`sql`-like fields to `MetricDef` so a metric fully describes its own query, matching LookML's expressive measure.
**Rejected.** This is precisely the "refused LookML line" — it bloats the thin vocabulary leaf, violates SRP (a metric would carry structural join topology that belongs to the *relationship* between dimensions), and breaks the strict-SOLID-per-element rule the project holds ([[feedback_strict_solid_per_element]]): structural concepts get their own noun, not a fattened shared type. LookML/Cube/dbt themselves keep joins OFF the measure (on the explore/joins-block/entities) — adopting the standard *whole* (Law 4) means adopting its *separation*, not just its features. Our chosen peer-noun growth is the faithful, SOLID form.

### ALT-C — Keep joins as per-node `blend`/`join` config only (status quo; do nothing structural)
Accept that joins are re-authored inline per node; add no relationship noun.
**Rejected.** Fails the world-class bar and the DRY/governance test: a join re-specified on every node drifts, cannot be certified, cannot be version-pinned, and cannot be planned. Every leader defines a join ONCE. It also forecloses the surpass (a compiled join-path from a governed graph). Inline `blend` is kept as the Postel fallback, but it cannot be the only mechanism.

### ALT-D — Build the headless query API as a NEW query dialect (not reuse the existing query/expr)
Introduce a fresh query grammar for the API surface, independent of `ObsQuery`/`@statdash/expr`/`DataSpec.query`.
**Rejected.** Creates a THIRD data dialect (we already flag a second expression dialect, `DeriveExpr`, for consolidation in M5a). Violates Law 4 (one standard, whole) and the one-resolution-path invariant. `SemanticQuery` must be a *refactor-extract* of what `DataSpec.query` already expresses (lossless, `FF-QUERY-LOSSLESS`), reusing `resolveMeasureRef` + `timeDimension` + `@statdash/expr` — not a parallel grammar.

### ALT-E — Model additivity as a transform-pipeline convention (author writes the right rollup each time)
Leave `agg` inert; expect the author to compose the correct `aggregate`/`rollup`/`window` steps per metric per grain.
**Rejected.** Pushes a *governance* property (how a number legally aggregates) onto every *consumer*, where it drifts and where a non-programmer cannot get it right — the exact class of error (summing a ratio) we must structurally prevent. Additivity is a define-once property of the metric (DAX/Malloy model it on the measure); the platform must enforce it (`FF-NO-SUM-OF-RATIO`), not trust each author. This is the governance-by-construction thesis.

## Consequences

**Positive**
- Closes the semantic-layer depth gap (S4–S9) to and beyond the leaders, on our SDMX-native substrate — relationships defined once, grain-correct aggregation, versioned/certified nouns, a headless query API.
- **Structurally prevents the summed-ratio defect** — statistics-grade correctness for national accounts (stocks vs flows vs ratios).
- **New surpass:** compiling the join path from a governed relationship graph (nobody compiles both the reactive dependency graph AND the join path from config); a serializable plan that feeds AR-43 lineage for free.
- Keeps `MetricDef`/`DimensionDef` thin (SRP held); every growth is a peer noun or an additive field — OCP, Constructor-authorable, completeness-gated.
- All reversible (expand-contract, `git revert`); no one-way door.

**Negative / costs**
- Three new fitness gates to author and keep biting (`FF-QUERY-LOSSLESS`, `FF-JOINPATH-PARITY`, `FF-NO-SUM-OF-RATIO`) + `coverage.fitness` extension — real work, and the G1 concern (prove gates bite) applies.
- The join-path planner is genuine algorithmic surface (shortest-path over the relationship graph, multi-store) — sequence it last, behind parity.
- D5 (row-set⟷scalar grain-polymorphism) is deferred; until it lands, calc metrics remain scalar-only and the two computation planes coexist.
- More governed nouns = more modeler surface — which raises the stakes on M5b (G6 discoverability): the modeler must be reachable or the depth is buried.

## Fitness functions (executable invariants, not comments)
`FF-QUERY-LOSSLESS` · `FF-JOINPATH-PARITY` · `FF-ADDITIVITY-DEFAULT-IDENTICAL` · `FF-NO-SUM-OF-RATIO` · `FF-NOUN-VERSION-ADDITIVE` · `FF-ONE-EXPR-DIALECT` — alongside the existing `FF-RAW-CODE-IDENTICAL`, `FF-ONE-RESOLUTION-PATH`, `FF-CALC-EXPR-SANDBOXED`, and `coverage.fitness` extended to the new nouns.

## Revisit when
- A real consumer needs D5 (grain-polymorphic measures), S4 (dimension hierarchies), or S10 (metric pre-aggregation) — each designed-but-deferred here.
- The within-tenant authz/roles model lands (unblocks access-grants on the metric, M3's flagged half).
- A reference leader ships a materially new semantic-model concept (refresh trigger — update the companion SPEC's gap-map).
