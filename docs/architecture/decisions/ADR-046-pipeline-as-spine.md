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
