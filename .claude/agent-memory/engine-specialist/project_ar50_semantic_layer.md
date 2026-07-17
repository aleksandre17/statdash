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
