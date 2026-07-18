# ADR-046 — The Pipeline Is the Spine

> **Status:** ACCEPTED (owner-blessed 2026-07-17, verbatim: «ნდობას გიცხადებ, გააკეთე» — on the lead's affirmation that this is the best-known concept, canon, methodology, architecture and grammar for the case).
> **Card:** `work/items/0082` · **SPEC:** `docs/architecture/proposals/SPEC-query-pipeline-data-home.md` (the full design, incl. the lead's §9 elevation pass — binding).
> **Relates:** ADR-034 (semantic query plane) · ADR-041/042 (object model, untouched) · ADR-045 (relative coordinates) · Laws 1–4, 10–11.

## Decision

ONE canonical data-manipulation grammar: a `pipeline` DataSpec discriminant — an ordered `pipe: TransformStep[]` whose **head is a `source` step** (the only store-aware step: a governed-noun read in the author plane, ObsQuery in the steward plane) and whose **tail is the existing pure transform verbs** from the runtime op registry. Every other data-shaping discriminant (`query`, `transform`, `timeseries`, `growth`, `ratio-list`, `pivot`, `metric`) becomes **sugar** that `desugar()` lowers into `pipeline` — read-time only; stored configs are never rewritten (expand-contract).

Authored through the **three-pane surface**: step rail (7 intent-verbs — Get/Filter/Aggregate/Derive/Reshape/Combine/Sort — each a *projection* of a `category` field declared on existing registry ops, never a new grammar) · live per-step data grid (browse-first, capped honest preview, Cell honest states, a projection of the graph engine — never a preview cache) · generated-query pane (read-only declarative truth in the author plane; lowered ObsQuery behind the steward lens; doubles as the per-element EXPLAIN/lineage seam).

Raw data receives its canonical home: the **four-floor ladder** (raw sources → governed model → specs/pipelines → elements), the dependency arrow made visible as IA; DQ expectation-sets declare at Floor 1 on the `CanonicalDsd`, lowered through the existing validation floor, failures riding Cell honest states.

**The ecology rule (E2):** reusable-across-pages calculations are governed metrics (Floor 2); element-local shaping is a pipeline step (Floor 3); a Derive step carries a *promote-to-governed-metric* affordance (author proposes, steward blesses) so local work feeds the semantic layer instead of competing with it.

## Rejected alternatives

- **ALT-A — `pipe?` on every discriminant, keep the type picker.** Entrenches the tag-zoo and the three-homes smell (`query.pipe` / `transform.steps` / `ratio-list.pipe`); the author-facing confusion (the 8-way `Select` + chips + cards + JSON simultaneity, diagnosed in `DataSpecEditor.tsx`) survives. Refused: one concept, one home.
- **ALT-B — a real query language in config (M-code / SQL-lite / JSONata).** Breaks Law 2 (config becomes a language), breaks `FF-AUTHOR-NO-QUERY`, imports a foreign runtime, not non-programmer-authorable, opaque to dependency extraction. Refused whole.
- **ALT-C — adopt Power Query / Vega-Lite as the runtime.** Raw-column vocabulary vs our governed nouns; dual state stores vs URL-param SSOT; the same grounds ADR-024 refused VL-as-runtime. We adopt the *grammar and the surface pattern*, never the runtime.

## Canonical anchors (Law 4 — adopted whole)

Power Query applied-steps + per-step grid (the perception model) · Grafana builder↔code duality (the transparency model) · Vega-Lite/Tidy-Data + Arquero/dplyr verb grammar (the vocabulary) · Looker/dbt promotion path (the ecology) · SDMX ObsQuery (the wire truth, unchanged).

## Consequences & guards

- **One-way door:** only the Constructor's default-emission flip to `pipeline` (W-P5), gated on `FF-PIPELINE-EQUIV` byte-identity across ALL stored configs + `FF-JOURNEY-PIPE` walked live. Everything before it is revert-clean.
- **Trade-off (ISO 25010):** usability + maintainability bought at a one-time guarded compatibility cost.
- **Gates:** `FF-PIPELINE-EQUIV` · `FF-JOURNEY-PIPE` · `FF-VERB-COVERAGE` · `FF-DQ-DECLARED` · `FF-PROMOTE-ROUNDTRIP` (E2) + held: `FF-AUTHOR-NO-QUERY`, `FF-CANVAS-NEVER-LIES`, `FF-ONE-DERIVATION-PATH`.
- **W-P1 dependency truth (E5):** the graph substrate exists (`packages/core/src/graph/`); per-step nodes are new projection work on that engine; SPEC-rendering-architecture remains PROPOSED and is not silently assumed.

## Addendum 2 — browse semantics of the governed `source` head (lead, 2026-07-18, closing the W-P5b crack)

A governed head `{op:'source', metrics:[…]}` with **no grain** lowers to the metric's **OBSERVATION BROWSE**: the full obs read across the metric's natural dimensions (codes via `resolveMeasureRef` → the storeObs path the steward head uses), rendered with governed labels. An **explicit grain** (`by`/`time`/`where`) lowers to the shaped read (the existing M2 grain algebra). A CALC metric under browse evaluates **per member of its time axis** (`resolveMetricValue` at each coordinate) — so `gdp.growthYoy` browses as a year-by-year growth column, honest no-data at the first-period edge (ADR-045). Canonical anchor: Power Query — a source IS the table; shaping comes after. This is what SPEC §9 E1 ("the empty pipeline is the browse grid") requires to be true at the engine, not just the surface. Rejected: a hidden default grain injected at emission (a lie in the config — the stored spec would carry a grain the author never chose); a panel-side browse shim (second derivation path, refusal #6 class).

## Addendum — W-P4 filter-resolution decision (engine-specialist, 2026-07-18)

**The question (W-P0 pre-note #3, deferred into the `source` design):** should `filter.<dim>` values learn UNIFORM governed-ref resolution at the one lowering path, or stay LITERAL-with-a-gate (`config-cube-contract` CHECK-4)?

**Decision: LITERAL-with-gate. The `source` design does NOT extend filter-value resolution.** The governed read a `source` head expresses is resolved at the MEASURE / grain level — its `metrics` (and a steward head's `query.measure`) route through the ONE `resolveMeasureRef` seam, and its `where` pins are coordinate LITERALS merged over `ctx.dims` exactly as `MetricSpec.where` is. No `filter.<dim>` value is governed-ref-resolved anywhere in the pipeline lowering.

**Why.** (1) *One filter path, unchanged.* The engine runtime (`matchesFilter` / `store-filter.ts`) treats every filter value as a literal; making `filter.<dim>` resolve governed refs is a behaviour change to the WHOLE filter path (every discriminant), not something the `source` head needs — it would be scope creep dressed as a lowering detail, and it would break the byte-identity the wave is gated on. (2) *The governed plane already lives at the measure/grain level.* An author never types a `filter` in the `source` head — they pick governed `metrics` + a generic grain; the only coordinate narrowing is `where`, whose SSOT is `MetricSpec.where` (scalar pins, Law 1, not predicates). (3) *The hole is already gated.* CHECK-4 (`config-cube-contract.fitness.test.ts`) fails any explicit `filter.<dim>` literal that is a governed metric-id — the exact b544819 leak — so a metric-id can never masquerade as a filter literal without failing loudly. Extending resolution would REMOVE that honest gate in favour of silent coercion. The literal-with-gate form is kept; CHECK-4 stands as the guard.
