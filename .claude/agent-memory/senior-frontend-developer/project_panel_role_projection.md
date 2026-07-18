---
name: project-panel-role-projection
description: Card 0087 P-OFFER TOTAL — the field-ROLE seam (PropFieldRole) + the ONE generic role-projecting TransformStepEditor with expr live preview; replaces the raw-JSON Inspector delegation for pipeline steps
metadata:
  type: project
---

# Field-ROLE projection — the pipeline step editor stopped showing raw JSON (card 0087, commits b5bb0ad+8e7785b on main)

**The mechanism.** Every op-schema `PropField` declares a `role: PropFieldRole` =
`field|member|newName|expr|literal` (core, `config/prop-schema.ts` — additive sibling of
`category`/`plane`/`concern`; the engine never reads it, only the panel projects it). `+memberOf`
scopes a member field to a sibling column (e.g. `rollup.of` → `memberOf:'dim'`). Composite fields
carry `itemSchema` whose SUB-fields carry roles (`aggregate.aggregations`, `group.by`). Coverage
guard: `listUnroledFields()` + **FF-ROLE-COVERAGE** (`role-coverage.fitness.test.ts`) — a leaf without
a role fails loudly with the exact `op.field` (the CATEGORY_PIN precedent).

**Why:** owner acceptance complaint (2026-07-18) — non-Filter verbs fell through the generic
`TransformStepEditor` to a raw Inspector JSON/array sub-editor ("mandatory fields, and even I can't
figure out what to do where"). The role lets ONE generic editor project the right OFFERED control.

**How to apply.** The rewritten `editors/query/steps/TransformStepEditor.tsx` is now the generic
role projector (NO Inspector delegation — that was the seam it retired). It renders each field by
role: field→`FieldPicker` / a column-checklist (array) · member→`MemberPicker` (over `memberOf`'s
column) · newName→text · expr→`ExprAutocompleteInput` (scope EXTENDED by step-input columns) + a
LIVE per-row preview · literal→typed input (select on `options`, number, boolean, text) ·
array+itemSchema→a structured list (recurse). `StepForm` routes `derive` here (bespoke
`DeriveStepForm` deleted); filter/sort/lookup STAY bespoke. Take `input?: StepInputOffer` — the
existing [[project_panel_poffer_filter_offer]] provider, extended with capped `sampleRows`
(`PREVIEW_ROW_CAP=12`) for the preview, threaded through the SAME `input?` prop (no new wiring).

**Expr = first-class (the Power-Query moment).** `pipeline-preview/exprStepScope.ts` is the pure
SSOT: `exprScopeSuggestions(columns)` offers exactly the input columns as scope; `previewStep(step,
target, sampleRows)` runs the CURRENT step over the sample via `applyStep` (the ONE engine
evaluator — never a second interpretation) and reads the produced column. **FF-EXPR-SCOPE-SSOT**:
offered scope == evaluator-resolvable columns (both from the ONE `StepInputOffer`). Live-proven:
derive `value*2` shows the computed value per row (`work/authoring-truth/0087/02-derive-preview.png`).

**Hand-maps killed.** `generatedQuery.ts` `FIELD_VALUE_KEYS`/`FIELD_RECORD_KEYS` gone — author-plane
nouns now derive from schema roles (`role`∈{field,newName}; member/expr/literal are not nouns).

**Ledgered next wave (NOT done):** FILTER FULL-POWER PARITY — MemberPicker `$ctx` («მიჰყევი
გვერდის არჩევანს») + `$ne` («ყველა, გარდა…») offered modes + Get-head grain/where authoring (engine
`FilterValue` already accepts the refs — this is offered-UI + FilterStepForm Cond-model work);
`FF-OFFER-ROUNDTRIP`/`FF-FILTER-PARITY` fixtures. See card 0087.

Extends [[project_panel_poffer_filter_offer]] · [[project_panel_data_workbench_wp2]]. Dev-line proof
recipe: [[dev-line-panel-3013]] (whole-src tar for a core change).
