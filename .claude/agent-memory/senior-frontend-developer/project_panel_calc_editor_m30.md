---
name: project-panel-calc-editor-m30
description: AR-49 M3.0 calc/derived-metric editor is LIVE in MetricEditor; rides the existing calc runtime; numeric canvas-preview deferred (no live store/ctx seam in Model surface)
metadata:
  type: project
---

AR-49 M3.0 (calc / measure-algebra editor) shipped in `apps/panel/src/studio/model`: a
define-mode toggle in `MetricEditor` (base vs calculated) renders `CalcBuilder` +
`ExprTreeEditor` (tiny in-house visual expr-tree, NOT Blockly) → emits pure
`ManifestMetric{calc}` through the UNCHANGED `saveSemanticCatalog` chain. Pure core in
`metricCalc.ts` (templates/build/cycle-detect); calc branch added to `metricValidation.ts`.

**Why:** completes the M2 deferred placeholder Alert; the `MetricDef.calc` runtime
(`packages/core/src/data/metric-calc.ts → resolveMetricValue` via `@statdash/expr`) was
already live — M3.0 was authoring-only, arrow untouched, `packages/*` not touched.

**How to apply:**
- Operands are governed metric ids picked from the catalog (never raw codes on the common
  path); validation rejects non-governed operands, self-reference, transitive cycles,
  undeclared `$derived` refs, and calc-XOR-code.
- NOT built: the numeric live-preview "on the active canvas coordinate" (spec §3.2 item 4).
  The Model surface threads NO live `DataStore` + `SectionContext`, so numeric preview has
  no seam today — shipped the **formula (text) preview** (`aria-live`, the WCAG alternative)
  instead. Numeric canvas preview needs that seam wired first. Live-COMPUTE is proven in
  `metricCalc.test.ts` against the real engine runtime, not in the UI.
- M3.1 (Recipe gallery) + M3.2 (growth relative-time engine seam) are LATER, owner-gated —
  see `docs/architecture/proposals/SPEC-authoring-reconception-M3-pipeline.md`.
