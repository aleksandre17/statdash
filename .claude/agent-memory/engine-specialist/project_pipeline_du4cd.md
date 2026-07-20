---
name: pipeline-du4cd
description: DU4c/DU4d ASSESSED + DEFERRED — ratio-list & row-list cannot fold with the current DU4a value-cell variant; both need the explicit-cells extension (flagged for ADR-046 Add.5)
metadata:
  type: project
---

# DU4c (ratio-list) + DU4d (row-list) — ASSESSED, DEFERRED (ADR-046 Add.4 / ADR-051)

2026-07-20. Outcome: **NEITHER folds byte-identically** with the current DU4a value-cell
`source` variant (`{over,code,coords,at,grain,rollup,clamp}`) + the pure tail. Both DEFERRED to
the DU3 fallback lane; the explicit-cells extension they need is FLAGGED for architect design
([[project_pipeline_du4a]] is the sibling — the variant DU4c/d would extend).

**Why ratio-list (`RatioListResolver`, resolvers.ts) can't fold.** Reads TWO cells per row —
`storeVal(numCode,ctx)` AND `storeVal(denCode,ctx)`, a PER-PAIR denominator — emits
`{id, measure, label, value: den?(num/den)*100:0}` (has `measure`, NO `pct`; label is
`label ?? numCode`, no store-meta read). One `source` head reads ONE value per coord over ONE
fixed code; the pure tail has no store to read the denominator; the pairing lives in `spec.pairs`,
not the store. Point-series emits `pct`, never `measure` → field mismatch even for the trivial case.

**Why row-list (`RowListResolver`, resolvers.ts) can't fold.** Per-cell HETEROGENEOUS params
(`negate` sign-flip / `pctOf` = a per-cell DISTINCT denominator read / `isTotal` / explicit
label+color) that a flat `coords: DimVal[]` can't carry, PLUS a store-META enrichment read
(`storeObs({measure:code},ctx)[0]` → label/color, with LocaleString tagging). Point-series always
emits `pct` (|v|/max); row-list only for `pctOf`, different formula (|raw|/denomVal×100).

**The flagged extension (needs ADR-046 Addendum 5 before build).** Add.4 sketches
`cells:{code,denom?,…}[]` with an unspecified `…`. The two kinds need DIFFERENT cell shapes:
ratio-list `cells:{code, denom, label?}[]` (per-cell numerator + its own denom read + ÷×100 fold);
row-list `cells:{code, label?, color?, negate?, pctOf?, isTotal?}[]` + the meta-enrich read + the
LocaleString tag. Open design Qs: one unified `cells` shape or two? does the cell own the store-meta
fallback behaviour? output field set (`measure` vs none; `pct` semantics). Improvising it = an
under-designed variant field (Law 10) → NOT built.

**What landed (revert-clean, live switch UNCHANGED).** desugar.ts: comment-only (the `default:`
in both `desugar()` and `desugarToPipeline()` still returns `spec` → direct resolvers; ratio-list/
row-list route to RatioListResolver/RowListResolver unchanged). pipeline-desugar.fitness.test.ts:
+4 DEFER GUARDS (desugarToPipeline identity `.toBe(spec)` + the DU3 lane resolves correct rows —
ratio 2500 with `measure`/no-`pct`, row-list negate→negative + meta label). coverage.fitness.test.ts:
NOT_YET_FOLDED comment records the assessment (both stay allowlisted).

**Gate:** tsc -b EXIT 0 · core full suite 990 pass/3 todo · pipeline-desugar+desugar 67 pass ·
coverage 13 pass · canvasNeverLies 4 pass · eslint clean on 3 files.

**Remaining before the gated emission flip:** ratio-list + row-list (blocked on Add.5 explicit-cells
extension design) + multi-code growth (calc-metric browse, Add.2). Everything else folds. Once those
land byte-identical, the emission flip flips the live `desugar()` switch and the DU3 lane retires.
