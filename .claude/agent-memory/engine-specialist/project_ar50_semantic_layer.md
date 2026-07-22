---
name: ar50-semantic-layer
description: AR-50 semantic-layer elevation initiative — convergence work retiring "erosions" (E1/E2 done in M5); where the erosion catalog lives
metadata:
  type: project
---

AR-50 is the semantic-layer elevation initiative for the engine/core. It is
framed as a series of "erosions" (breaches of stated invariants) to converge.

**M5 (DONE, commit 53bb83f)** — converged to ONE expression dialect + ONE
aggregation vocabulary:
- E1: `@statdash/expr` is now the single expression AST/evaluator. The former
  in-house `DeriveExpr` AST + tree evaluator + string parser (in
  `packages/core/src/data/transform/derive.ts`) was retired. The string-formula
  surface became `parseFormula` IN `@statdash/expr` (compiles to `Expr`). Added
  `abs`/`neg` ops to expr. `DeriveExpr` is now a deprecated alias of `Expr`.
- E2: one canonical `Reducer` set (`sum|mean|min|max|count|first|last`) + one
  `reduceValues` (`transform/reducers.ts`) shared by aggregate/rollup/reduce.
  Legacy `avg` → `mean` via `canonAgg` (Law-2 alias). `window` funcs untouched.

**Why:** two architecture studies flagged E1/E2 as the cheapest, highest-leverage
first move — a single AST unblocks `extractDeps` (reactive graph), lineage (G2),
and the visual calc-builder. Law 4 ("one standard, whole") applied to our house.

**How to apply:** E1/E2 are settled — do NOT re-flag the two-dialect / avg-vs-mean
erosions. Further erosions (E3+, G2 lineage, calc-builder) remain per the catalog
in [[ref-semantic-layer-proposals]]. The `metric-calc.ts` "never a second dialect"
invariant is now actually true — keep it that way (route new expression needs
through `@statdash/expr`, never a fresh AST/evaluator).

**Build sequence (D-AR50-3, reconciled from twin):** M5 (one dialect — DONE `53bb83f`) → M5b (discoverability — DONE) → M2 (grain algebra + FF-NO-SUM-OF-RATIO — DONE `87aea32`) → M-SQ (`metric` discriminant) → M4 (transform kernel) → M5/lifecycle. Keep all of it ADDITIVE alongside legacy paths.

**⛔ One-way door (OWNER-HELD, do NOT fire):** recasting `growth`/`cumulative` as metric KINDS and demoting the `ratio-list` DataSpec discriminant to sugar (contract C1–C3). Build alongside; NEVER remove/demote an existing DataSpec discriminant. If new algebra makes them redundant — NOTE it for the contract, do not act.

**Open findings from the 2026-07-15 deep audit (verify against live tree before acting — code-cited, not re-checked since):**
- **Additivity guard is path-dependent, not measure-dependent.** `guardNoSumOfRatio` (`metric-grain.ts`) protects only `evalMeasureAtGrain`; the pervasive `storeVal` OLAP-cell sum + `readMeasure` code-sum (`kpi.ts`) sum ratios across unpinned ambient dims UNGUARDED (confirmed still true 2026-07-22: `readMeasure` has no guard call). FF-NO-SUM-OF-RATIO bites a door almost nobody walks through yet.
- **Lineage/provenance = the most-repeated ADR claim, NOT built.** MetricResolver emits no provenance. `withMetricProvenance` fills from ONE metric, never walks `calc.inputs`. The reactive graph (`graph/compilePage.ts`) has NO `metric:` source edge (confirmed still true) — editing a `MetricDef.calc` invalidates NOTHING downstream.
- **The `metric` DataSpec (AR-50 keystone) still has near-zero authored consumers** — only editors/e2e/tests reference `type:'metric'` (confirmed still true 2026-07-22); no page config binds it. Built noun, no sentence written in it yet.
- Kernel is mid-Strangler: honest kernel = ~3 nouns (query/metric/transform); growth/ratio-list still bespoke resolvers — see [[project_pipeline_track]] for the current fold status.
- The Cell honest-state finding (storeVal collapsing 4 states into one 0) that this audit ALSO raised is RESOLVED — see [[reference_cell_honest_state_seam]] (PM-1, landed).
