# ADR-034 — AR-50: Semantic-layer elevation — one algebra (metric discriminant · measure algebra at grain · one dialect · DSD-reified contract · lifecycle)

> **Status:** ACCEPTED (2026-07-11 — owner delegated the call under the standing "always the stronger / more-agnostic / higher-standard" principle; recorded in `MASTER-PLAN-canonical-rearchitecture.md` → AR-50 DECISIONS). **Partly BUILT** — see §6.
> **Date:** 2026-07-11 · **Authors:** platform-architect (Fable 5, `claude-fable-5`) + platform-architect (Opus) — this is the reconciled single record folding both studies.
> **Canonical companion SPEC:** `docs/architecture/proposals/SPEC-data-semantic-worldclass-fable.md` (THE AR-50 SPEC — gap-map + target design + Strangler path).
> **Supersedes:** `ADR-025-semantic-relationships-grain-versioning.md` (the parallel Opus study — its substance is folded here; its `RelationshipDef`-new-noun and separate-`SemanticQuery`-plane proposals are recorded below as REJECTED alternatives, per D-AR50-1 / D-AR50-2).
> **Registry:** AR-50 · closes ledger **G5** (semantic completeness) + **G6** (modeler discoverability) · routes **N3** (certification) here · extends **AR-40** (semantic spine) · builds on **ADR-024** (config-compiled reactive graph).

---

## 0. ADR numbering standard (housekeeping — set here, once)

The `decisions/` directory carried **two colliding pad conventions** (`ADR-023-one-type-system…` vs `ADR-0023-classifier-code-path`; `ADR-025-…` vs `ADR-0025-vintage-release`; plus `ADR-0026`, `ADR-0033`) — Fable erosion **E7**.

**Canonical convention (binding from here forward): `ADR-NNN` — three digits, zero-padded, unpadded beyond three (ADR-001 … ADR-999).** This matches the dominant series (ADR-001 … ADR-024). The four four-digit records (`ADR-0023/0025/0026/0033`) are **grandfathered** — NOT renumbered (they are historical and cross-referenced elsewhere; renumbering would break links for no gain).

**Why the canonical AR-50 ADR is `034`, not the lower `025`:** number **25** is already occupied by the grandfathered `ADR-0025-vintage-release`, so placing the live AR-50 ADR at `ADR-025` *perpetuates* the exact padded/unpadded collision E7 flags. `ADR-034` is past the highest existing number (`ADR-0033`) and collides with nothing — it is the collision-free ("cleaner") choice, and it already carries the substance the decision block adopted (D-AR50-1/2 chose this study's positions). `ADR-025` is marked Superseded → here.

---

## 1. Context

The platform's data plane is three strata — physical (`ObsQuery`/`DataStore`/`fromSDMX`), transform (the `TransformStep` pipe), semantic (`MetricDef` + `resolveMeasureRef`) — plus the config-compiled reactive graph (ADR-024). **Two independent studies** (Fable-5 and Opus) benchmarked this whole axis against the strongest reference platforms (LookML, Cube, Malloy, dbt Semantic Layer / MetricFlow, Power-BI tabular/DAX; and for transforms Vega-Lite, dplyr/Tidy, Power Query, Arquero, DuckDB). **Both converged on the same diagnosis:**

- **Data-object + JSON-manipulation is at/above the class.** The `TransformStep` grammar is a full dplyr/Vega-Lite verb set; `@statdash/expr` is a done-right safe-eval canon; and the **config-compiled reactive graph** (`packages/core/src/graph/`) is a capability **no reference platform ships** (Vega compiles one view's dataflow; we compile a whole page's cross-node reactive graph from declarative config). Keep these; do not redesign.
- **The three strata are not yet ONE algebra, and the semantic layer's governed-noun DEPTH lags.** We model **metrics** and **dimensions** well, then stop — the deliberate "refused LookML line" (no filters/joins/sql on the metric). The refusal was correct about *sql-on-a-metric* but over-corrected into *no query object, no grain/additivity, no lifecycle at all*.

Both studies independently found the **same live defect**: *"GDP per capita over time" cannot be a governed metric today* — calc metrics are scalar-only, so authors re-derive it per chart via `pipe`/`ratio-list`, and the governed definition drifts from the chart's math (the exact "one governed number" breach the platform exists to prevent). Worse, `agg: sum|avg|last` was carried but never consumed, so a **non-additive ratio (deflator, share, per-capita) could be silently summed** — a scientific defect. Both also confirmed two erosions of stated invariants: **two expression dialects** (`DeriveExpr` vs `@statdash/expr`) and **three aggregation vocabularies** (`avg` vs `mean`).

**The decision:** how do we grow the semantic layer to and beyond the leaders — one governed, grain-polymorphic, provenance-carrying query algebra as plain JSON, compiled into the reactive graph — **without importing a modeling language, without a foreign runtime, and without bloating the thin metric?**

## 2. Decision

**Unify the three strata into one governed algebra, additively, through the existing seams (`resolveMeasureRef`, `registerSpec`, `desugar`, `extractDeps`, the migration chain) — never a modeling language on the metric, never a foreign runtime engine, never a second query plane.** The three fixed decisions (MASTER-PLAN → AR-50 DECISIONS, 2026-07-11) govern:

- **D-AR50-1 — relationships = REIFY the SDMX DSD, NOT a new `RelationshipDef` noun.** The DSD already encodes the structural contract (each dataflow's dimensions → a metric's `sliceableBy`); a parallel relationship noun would be a second source of truth. Reifying the DSD as introspectable manifest data (`ManifestDataflow`) is more agnostic, SDMX-native (Law 5), and faithful to how LookML/Cube keep joins **off** the measure. *(Adopts Fable's M5 structural-contract move; rejects Opus's `RelationshipDef` new noun.)*
- **D-AR50-2 — semantic query = a `metric` DataSpec DISCRIMINANT**, `{ type:'metric', metrics, by, time, where, top?, pipe?, encoding? }`, compiled by a **registered resolver** (interpreter unchanged — OCP, Law 8) onto `resolveMeasureRef` → `ObsQuery`/point-series/pipe. This is OCP-consistent with the discriminated union + the `coverage.fitness` build-gate, and it makes metric-first authoring (AR-49) **structure**, not just UI. It is NOT a separate parallel plane / standalone object. *(Adopts Fable's M1; rejects Opus's separate `SemanticQuery` object/M4.)*
- **D-AR50-3 — the synthesized build sequence** (all reversible except the one noted contract). See §5 / §6.

Concretely, the algebra is built from these moves (Fable M-numbers = canonical; Opus companion noted):

1. **One dialect, one aggregation vocabulary** *(Fable M3 = Opus M5a — BUILT, `53bb83f`)*. `@statdash/expr` is THE dialect; `DeriveExpr` retired; `parseFormula` (the Vega-Lite-`calculate` string surface) compiles to the canonical `Expr` AST. One `AGG_OPS` SSOT with an alias map (`mean→avg`); the metric/aggregate/reduce unions derive from it. Halves the sandbox/AST surface `extractDeps` must reason about. `FF-ONE-EXPR-DIALECT`, `FF-AGG-ONE-VOCAB`.

2. **Discoverable modeler + role-is-lens** *(Fable M5-G6 = Opus M5b — BUILT, `bb7a74c`)*. "Data model" is a first-class, always-visible rail destination; **role splits the CONTENT, not visibility** — author lens = a read-only **Data Dictionary** (dbt-docs grade, no raw query surface, `FF-AUTHOR-NO-QUERY` intact); steward lens = the full modeler. Navigation never flips the lens. `FF-DATA-REACHABLE` (built-≠-buried, made a fitness function).

3. **Measure algebra at grain + additivity** *(Fable M2 = Opus M2 — BUILT, `87aea32`, `packages/core/src/data/metric-grain.ts`)*. `evalCalcAtGrain` generalizes a calc metric from scalar (grain-∅, a KPI point-read) to **any grain**: align-join its input measures on their shared grain keys (Law 1 — `time` is not special), evaluate the ONE `calc.expr` per row via `@statdash/expr`. Scalar delegates to the scalar SSOT (`resolveMetricValue`) — **byte-identical** (`FF-CALC-GRAIN-SCALAR-IDENTICAL`). The previously-inert `agg` seam is consumed via the OLAP/DAX **additivity model** (`additive | semi-additive | non-additive` on `MetricDef` + `SemiAdditiveRule`, DAX `LASTNONBLANK`): a **non-additive measure is re-derived from its `calc` at the target grain, NEVER summed** — `guardNoSumOfRatio` is the executable `FF-NO-SUM-OF-RATIO` gate; `effectiveAdditivity` is the SSOT classifier (explicit field wins, else the conservative structural default: calc ⇒ non-additive, base ⇒ additive; never a runtime value-sniff). This is the **single most scientifically important move** — a ratio can never be silently summed again (statistics-grade correctness for national accounts: stocks vs flows vs ratios).

4. **The `metric` query noun** *(Fable M1 — IN PROGRESS, M-SQ, another agent)*. The `metric` DataSpec discriminant + its registered resolver, compiling onto the M2 grain evaluator + `resolveMeasureRef`. `growth`/`cumulative` recast as declarative **metric kinds**; `ratio-list`/`growth` spec discriminants demoted to sugar over calc metrics (the ⛔ contract — see §5). Provenance composes through the algebra (a derived metric's provenance composes its components' — a surpass no reference platform has). `FF-METRIC-QUERY-EQUIV`, `FF-GROWTH-KIND-EQUIV`.

5. **Transform kernel + statistics verbs** *(Fable M4 — PENDING)*. Declare the minimal orthogonal KERNEL (~11 relational verbs); reclassify duplicates (`reduce`→`aggregate`, `lookup`→`join`, `concat`/`template`→`derive`) as **registered sugar with provable row-identical lowerings** (the `desugar.ts` discipline generalized to steps). Add the statistics-office verbs: **`impute` (propagating the SDMX estimate/imputed status flag onto the row — Law 9, the surpass nobody has)**, `broadcast` (Vega `joinaggregate`), `unfold` (long→wide), `bin`, `timeUnit`. `FF-STEP-LOWERING-EQUIV`, `FF-IMPUTE-FLAGS`.

6. **Structural contract (DSD-reified) + metric lifecycle** *(Fable M5 / Opus M3 — PENDING)*. `ManifestDataflow` reifies the DSD's load-bearing subset (dimensions per dataflow) → `MetricDef.sliceableBy`, powering authoring-time validation + palette projection (the D-AR50-1 landing). Add `status` (`draft|certified|deprecated`, N3 — the Law-9 kin of `preliminary`) + `catalogVersion` with registered migrations to the metric catalog (G5). Publishing a page binding a non-certified metric **soft-warns** (Guided-Canvas doctrine — never a hard gate). `FF-SLICEABLE-VALIDATES`, `FF-CATALOG-MIGRATES`.

All moves are **pure JSON data** (Law 2), **SDMX-native** (Law 5 — answered through the store port, no foreign engine), **generic over axes** (Law 1), **Constructor-authorable with `coverage.fitness` coverage** (M-8/OCP — new capability = new registered discriminant/field, interpreter unchanged), and land via **expand-contract Strangler** behind green fitness gates (Law 7). Every node remains a cell in the config-compiled reactive graph; `metric:` catalog edges make lineage (G2) a read over graph + catalog.

## 3. Rejected alternatives (union of both studies)

### ALT-A — Adopt a foreign semantic engine (Cube / dbt MetricFlow / LookML) as the runtime
Embed Cube.dev (or transpile to LookML) as the semantic runtime, gaining relationships/grain/pre-agg/query-API "for free."
**Rejected.** Violates **Law 5** (`fromSDMX` is the ONLY adapter; a Cube/LookML/warehouse runtime is a second, SQL-native adapter that does not speak SDMX DSDs or our provenance/`agency_scheme`/preliminary machinery). It would fork the substrate, introduce a second query planner beside the reactive graph and a second catalog beside `site_config` (breaks `FF-CATALOG-ONE-SSOT`), and its define surface is an expert DSL (breaks the non-programmer mandate, M-8). We **learn from** these engines (their noun models are the reference) and **surpass** them on our SDMX-native substrate — we do not host them.

### ALT-B — Put joins/filters/sql, or a new `RelationshipDef` noun, on the metric (become LookML-on-the-metric)
Add `joins`/`filters`/`sql`-like fields to `MetricDef` (Opus ALT-B), **or** add a first-class `RelationshipDef` noun parallel to metric/dimension (Opus's ADR-025 primary proposal).
**Rejected — this is D-AR50-1.** SQL-on-the-metric bloats the thin vocabulary leaf and violates SRP ([[feedback_strict_solid_per_element]]). A separate `RelationshipDef` noun is cleaner than sql-on-metric but is **a second source of truth beside the SDMX DSD**, which *already* encodes the structural contract (dimensions per dataflow). Reifying the DSD (`ManifestDataflow` → `sliceableBy`) is the more-agnostic, SDMX-native form and is faithful to how LookML/Cube keep joins off the measure — adopting the standard *whole* (Law 4) means adopting its *separation via the substrate we already have*, not minting a parallel noun.

### ALT-C — A separate `SemanticQuery` object / parallel query plane (outside DataSpec)
Extract a first-class `SemanticQuery` object the DataSource port answers headlessly, distinct from the render node (Opus M4).
**Rejected — this is D-AR50-2.** A parallel plane creates a second extension mechanism beside `registerSpec` (the competing-extension smell — the exact reason the `custom`/`fn` escape hatch was removed, ENG-16) and forfeits everything the DataSpec spine already provides (roundtrip fitness, the migration chain, discriminant-manifest exhaustiveness, `extractDeps`, the panel type-picker). The `metric` **discriminant** (D-AR50-2) gets the same headless/API-first benefit — one addition lights up every surface — without a second plane. *(A later headless API endpoint that answers the same `metric` discriminant is an exposure, not a separate plane — YAGNI-deferred, not this wave.)*

### ALT-D — Keep joins as per-node `blend`/`join` config only (status quo; do nothing structural)
Accept joins re-authored inline per node; add no structural contract (Opus ALT-C).
**Rejected.** Fails the world-class bar and the DRY/governance test — an inline join drifts, cannot be certified or version-pinned, cannot be validated against the DSD. Inline `blend` stays valid as the Postel fallback, but it cannot be the only mechanism; the DSD-reified `sliceableBy` (D-AR50-1) is the governed form.

### ALT-E — A NEW query/expression dialect, or a JSONata/jq path language
Introduce a fresh query grammar for the semantic surface, or an arbitrary JSON-tree path language for manipulation (Opus ALT-D + Fable ALT-D).
**Rejected.** A third dialect violates Law 4 (one standard, whole) and the one-resolution-path invariant; the `metric` discriminant must be a *refactor-extract* of what `DataSpec.query` already expresses, reusing `resolveMeasureRef` + `timeDimension` + `@statdash/expr` (`FF-METRIC-QUERY-EQUIV`). An arbitrary path language (JSONata/jq) is a query language by the back door (breaks `FF-AUTHOR-NO-QUERY`) and un-analyzable for `extractDeps` totality (breaks the ADR-024 premise). The sanctioned `Expr.get` deep-path suffices.

### ALT-F — Grow the semantic layer as UI only (keep binding physical); or model additivity as a pipeline convention
Fix metric-first in the palette while config keeps binding at `ObsQuery` (Fable ALT-B); and leave `agg` inert, expecting the author to compose the correct rollup per metric per grain (Opus ALT-E).
**Rejected.** UI-only is the status quo that produced the drift — the governed noun exists in the palette but not in the config, so every chart re-encodes the semantics; a UI fix is a symptom patch (Law 6). Pushing additivity onto every consumer pushes a *governance* property (how a number legally aggregates) where it drifts and a non-programmer cannot get it right — the exact summed-ratio class we must structurally prevent. Additivity is a define-once property of the metric, enforced by the platform (`FF-NO-SUM-OF-RATIO`) — governance by construction.

## 4. Consequences

**Positive**
- Closes the semantic-layer depth gap to and beyond the leaders on our SDMX-native substrate: one binding grammar for KPI/chart/table; define-once-consume-at-any-grain governed metrics; provenance through the algebra; authoring-time semantic validation; versioned/certified nouns; a discoverable modeler.
- **Structurally prevents the summed-ratio defect** (already live via `FF-NO-SUM-OF-RATIO`) — statistics-grade correctness.
- Extends the reactive-graph surpass: `metric:` source edges make catalog edits invalidate exactly the consuming nodes; lineage (G2) becomes a read over graph + catalog.
- Keeps `MetricDef`/`DimensionDef` thin (SRP held); every growth is a discriminant, an additive field, or DSD-reified manifest data — OCP, Constructor-authorable, completeness-gated.
- **Trade-off named (ISO 25010):** functional suitability + maintainability gained at a temporary cost to simplicity-of-surface during expand-contract; performance neutral-to-positive (semantic queries compile to the same store reads; the graph dedupes).

**Negative / costs**
- A larger `DataSpec` union (one discriminant) and a transitional period where legacy forms (`ratio-list`, `growth`, `DeriveExpr` remnants) coexist with canonical ones — bounded by migrations + equivalence gates (the proven expand-contract discipline).
- New fitness gates to author and keep biting (the G1 "prove gates bite" concern applies — fold into the mutation-testing quality track).
- The grain evaluator adds one genuinely new engine capability (align-join at grain) that must be tested against DuckDB-reference join/window semantics.
- More governed surface raises the stakes on discoverability (G6) — addressed by M5b + `FF-DATA-REACHABLE`.

## 5. Fitness functions

**Live (built):** `FF-ONE-EXPR-DIALECT` · `FF-AGG-ONE-VOCAB` · `FF-DATA-REACHABLE` · `FF-CALC-GRAIN-SCALAR-IDENTICAL` · `FF-NO-SUM-OF-RATIO`.
**Pending (land with their step):** `FF-METRIC-QUERY-EQUIV` · `FF-GROWTH-KIND-EQUIV` · `FF-STEP-LOWERING-EQUIV` · `FF-IMPUTE-FLAGS` · `FF-SLICEABLE-VALIDATES` · `FF-CATALOG-MIGRATES` (each an `it.todo` scaffold until live).
**Held (must stay green throughout):** `FF-RAW-CODE-IDENTICAL` · `FF-ONE-RESOLUTION-PATH` · `FF-DESUGAR-EQUIV` · `FF-EXTRACTDEPS-TOTAL` · `FF-AUTHOR-NO-QUERY` · `FF-CATALOG-ONE-SSOT` · roundtrip-dataspec.

## 6. Build state + the remaining sequence (D-AR50-3, synthesized)

| # | Move (Fable id) | Lands | Reversibility | State |
|---|-----------------|-------|---------------|-------|
| 1 | **M5** — one expression dialect + one aggregation vocabulary (`DeriveExpr`→`@statdash/expr`; `parseFormula`; `AGG_OPS` SSOT, `avg`≡`mean`) | `expr`/`core` | reversible (adapter, per-step) | **BUILT** `53bb83f` |
| 2 | **M5b** — modeler discoverable + Data Dictionary (author) / modeler (steward), role-is-lens; `FF-DATA-REACHABLE` | `apps/panel` | reversible (rail entry) | **BUILT** `bb7a74c` |
| 3 | **M2** — measure algebra at grain (`evalCalcAtGrain`) + additivity model + `FF-NO-SUM-OF-RATIO` | `core` (`data/metric-grain.ts`) | reversible expansion (scalar = grain-∅ byte-identical) | **BUILT** `87aea32` |
| 4 | **M-SQ** — the `metric` DataSpec discriminant + registered resolver (compiles onto M2 + `resolveMeasureRef`) | `core` | reversible (unregister resolver; flag off) | **IN PROGRESS** (another agent — do not edit core here) |
| 5 | **M4/kernel** — transform kernel + registered sugar lowerings + statistics verbs (`impute` w/ SDMX status-flag propagation, `broadcast`, `unfold`, `bin`, `timeUnit`) | `core` | reversible (additive ops + lowerings) | PENDING |
| 6 | **M5/lifecycle** — DSD reified as `ManifestDataflow` → `sliceableBy` (**the D-AR50-1 landing**) + `status` (draft/certified/deprecated) + `catalogVersion` migrations | `contracts`/`core`/`apps` | reversible (additive contract fields) | PENDING |
| ⛔ | **contracts** — demote `ratio-list`/`growth` spec discriminants to sugar over calc metrics; remove `DeriveExpr` alias; flip Constructor default emission to the `metric` spec | — | **one-way door** — fired only when the corresponding equivalence FF is green on EVERY stored config (the R2/V3 gate-proves-new==old protocol) | HELD (gate-fired) |

**The known ⛔ is the `growth`/`ratio-list` demotion** (move 4's contract phase) — the only one-way door; every other move is expand-contract and `git revert`-able. Deferred-but-designed behind a real-consumer YAGNI gate: D5 (row-set⟷scalar grain-polymorphism — the north-star unification composing 3/4/6), S4 (dimension hierarchies), S10 (metric pre-aggregation), and a headless API-endpoint exposure of the `metric` discriminant.

## 7. Revisit when
- A real consumer needs D5 (grain-polymorphic measures) or S10 (pre-aggregation) — each designed-but-deferred. ~~S4 (dimension hierarchies)~~ **un-deferred — see §8.**
- The within-tenant authz/roles model lands (unblocks access-grants on the metric — the flagged half of lifecycle).
- A reference leader ships a materially new semantic-model concept (refresh trigger — update the canonical SPEC's gap-map).

---

## 8. AMENDMENT — S4 governed dimension hierarchies / drill paths (un-deferred) — the AR-40/50 ⟷ AR-42 bridge

> **Status:** ACCEPTED delta (2026-07-12, engine-specialist). **First slice BUILT.** This is an ADR-034 DELTA — NOT a competing SPEC. §6 deferred S4 behind a real-consumer YAGNI gate; **AR-42's drill-down is that consumer**, and the platform-architect hierarchy-gap audit confirmed hierarchies are the *bridge primitive between the semantic layer (AR-40/50) and the drill-down interaction (AR-42)* — you cannot declare "select → drill" without a governed parent/child dim relation. Official statistics are intrinsically hierarchical (geo ▸ region ▸ municipality; NACE/COFOG sector trees; time ▸ quarter ▸ month), so this is reference-grade, not YAGNI. Un-defers exactly S4; D5/S10 stay deferred.

### 8.1 Decision (D-AR50-4)
**A dimension may declare a governed DRILL PATH on `DimensionDef.hierarchy` — an ordered set of LEVELS (coarsest → finest), each naming a generic grain axis + a bilingual breadcrumb label. Member parent/child relations are NEVER hand-authored — they REIFY from the SDMX codelist `parent` edges at runtime (Law 5). A declared drill (`DrillTarget`) lowers onto the M2 measure-at-grain SSOT (`evalMeasureAtGrain`), so re-aggregation is additivity-respecting by construction.** This is faithful to D-AR50-1 (reify the DSD, don't mint a parallel noun) and D-AR50-2 (compose existing seams, no new query plane). Benchmarks adopted whole (Law 4): LookML `drill_fields`, Cube `hierarchies`, Malloy nesting, MetricFlow entities.

### 8.2 The primitive (thin, generic, declarative)
```ts
interface HierarchyLevel     { dim: string; label?: LocaleString }      // a tier over a generic grain axis (Law 1)
interface DimensionHierarchy { levels: HierarchyLevel[] }               // coarsest → finest
// DimensionDef.hierarchy?: DimensionHierarchy                          // absent ⇒ a flat dimension
interface DrillTarget        { dimension: string; level: number }      // the AR-42 selection emits this (Law 2)
```
**Two forms, ONE declaration (no privileged branch — the engine derives the drill KIND from whether the axis repeats):**
- **self-nested codelist** (geo/sector trees) — every level names the SAME axis; tiers are DEPTHS in the classifier parent tree (reified). A drill reads rollup coordinates that the store already sums over their descendant leaves (`DimResolver` leaf-set expand).
- **star / level-per-dim** (year ▸ quarter ▸ month as distinct dims) — each level names a DISTINCT axis; a drill SWAPS the grain axis, composing natively with `metric-grain`'s generic axes (`grain = by ⊕ time.dim`) — `by: [drillAxis(def, level)]`.

### 8.3 The seam (why NO `metric-grain` change was needed)
`data/drill.ts` composes the landed M2 SSOT; it introduces **no new query path**. The only thing raw fact-driven grain enumeration cannot do is enumerate *rollup* coordinates (facts carry leaves, not regions). So the drill supplies the coordinate SET — `reifyLevelMembers` = `membersAtDepth(classifier, depthWithinAxis)` (reified from parent edges) — and reads each member as a **grain-∅ governed cell** at `ctx.dims ⊕ { axis: member }` via `evalMeasureAtGrain`. A base measure's cell sums descendant leaves (OLAP rollup); a **ratio / calc metric RE-DERIVES at each coordinate — never summed** (`FF-NO-SUM-OF-RATIO` holds through the drill). A drill at the LEAF level is byte-equivalent to `evalMeasureAtGrain(ref, ctx, store, [axis])` — the reversible-expansion parity gate.

New engine surface (all additive): `DimensionDef.hierarchy` field; `DimensionHierarchy`/`HierarchyLevel`/`DrillTarget` types; `childrenOf`/`depthOf`/`membersAtDepth` (codelist reification); `drillAxis`/`reifyLevelMembers`/`evalMetricDrill` (`data/drill.ts`). `FF-HIERARCHY-DRILL` (`data/drill.fitness.test.ts`) gates reify + additive rollup + ratio re-derivation + leaf-parity + a SECOND dim-pair (Law 1). `FF-NO-PRIVILEGED-DIM` extended to scan `drill.ts`.

### 8.4 The AR-42 seam
An AR-42 selection/interaction emits a `DrillTarget` (pure data); the react/plugins layer resolves it — either injecting `drillAxis(def, level)` into a `MetricSpec.by` (star form) or calling `evalMetricDrill` for a self-nested rollup read. **`MetricSpec` is UNCHANGED** — the drill composes the existing `by` grain + the new seam, keeping the M-SQ public contract stable and the whole slice `git revert`-able.

### 8.5 Flagged (bounded follow-on, NOT this slice)
- **Multi-member `where` narrowing** for a self-nested drill that also *pins* a parent (show only R1's municipalities): `MetricSpec.where` is single-val `Partial<Record<dim, DimVal>>`; a child-SET narrowing wants array support (the store filter already accepts `DimVal[]`). Additive when needed; deferred until AR-42 wires the pinned-drill interaction.
- **A `drill` field on `MetricSpec`** (drill state carried IN the query) was considered and rejected for this slice — it churns the just-landed M-SQ public contract for no capability the composed-`by` seam lacks. Revisit only if AR-42 needs the drill state serialized into the stored spec.
- **Time granularity** (year▸quarter▸month) already has a partial home in `TimeDimensionSpec.granularity` (the LOD door); a time hierarchy should reconcile with it rather than double-declare — folded when a time-drill consumer lands.
