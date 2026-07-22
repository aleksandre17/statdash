---
name: panel-authoring-features-misc
description: "Five small-but-distinct panel authoring features — value mappings (Grafana-style value→presentation), uniform section composition, the Summary-Card Inspector default, the calc/derived-metric editor, and the DataSpec editor's source-of-truth types. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 5 sibling files (value-mappings-architecture,
> section-authoring-uniformity, summary-card-inspector, panel-calc-editor-m30,
> panel-dataspec-editor).

## Value mappings (EXP-06) — value→{text,token,icon}, token-bound
Grafana-style, authorable, consumed by table status cells. Layer split (Clean Architecture arrow):
- **core** (`config/value-mapping.ts`): `ValueMapping`/match kinds (exact|range|regex|empty) +
  pure `applyValueMap` (first-match-wins). `token` is a registered semantic-token KEY, never a
  colour literal (Law 4 — no labels here either).
- **styles** (`utils/tokenColor.ts`): `tokenCssVar(key)`, `tokenColorLiteral` (computed, for SVG),
  `isRegisteredColorToken` (the FF predicate).
- **plugins** (`MappedCell.tsx`): renders mapped TEXT always (WCAG 1.4.1, never colour-only),
  coloured via `tokenCssVar`; falls back to the raw formatted value on no match.
- **panel authoring:** `VALUE_MAPPING_SCHEMA` lives in `apps/panel` (bilingual labels), NOT core.
  `ValueMappingField` = an ordered, reorderable rule list (first-match = priority) over the generic
  Inspector; registered as a side-effect module in `App.tsx` (not `FieldControlRegistry.ts` —
  would cycle: ValueMappingField→Inspector→FieldControlRegistry).

## Section authoring uniformity — ONE composition primitive
Closed the owner's "non-uniform section handwriting" complaint at the CONFIG level: every section
group in `geostat.provisioning.json` is now wrapped through `columns` (pairs `count:2`, singles
`count:1`) — `gdp` already did this and was left untouched (Chesterton's fence); `accounts`/
`regional` converged to it. The group-level perspective gate lives on the `columns` WRAPPER, never
the inner single section.

**Load-bearing, don't regress:** wrapping a `repeat` in `columns count:1` is NAV-SAFE (`columns`
carries `caps:['nav-transparent']`; the nav extractor descends exactly ONE level, `repeat` itself
is not nav-transparent, so the emitted nav shape is byte-identical). Moving `visibleWhen` off the
section is nav-identical too.

**Guard:** `config-uniform-section-authoring.fitness.test.ts` — every inner-page `section`/
`geograph` needs a layout-container ancestor; no section/geograph/repeat is a direct page-body
child; no wrapped single carries a redundant perspective gate.

## Summary-Card Inspector — rich values default to a glance card, never raw JSON
`inspector/summarize.ts` `summarizeRegistry` (keyed by PropFieldType) → `SubjectSummary
{primary,secondary,badges}`; built-ins for DataSpec/ChartDef + a generic field-count fallback
(NEVER returns JSON). `inspector/controls/SummaryCard.tsx` is the FieldControl (constant-height
glance card + "Open editor →" escalates a node-field focus-view). `FieldControlRegistry.resolve()`
step 6 falls to SummaryCard when nothing else is registered; raw JSON is reachable only behind
`isRawJsonEscapeEnabled()` (`?rawjson` URL param or a test seam).
`inspector/sections/*` `dockSectionRegistry {id,appliesTo,render,order}` + `DockBody` is the
registry RightDock's body composes from — absorbed the old hardcoded Chip+Inspector+ContextEditor
stack. **Gotcha:** any rich FieldControl must carry `id` (Inspector renders
`<label htmlFor={id}>`). Gates: FF-NO-RAW-JSON-DEFAULT, FF-DOCK-CONSTANT-WEIGHT,
FF-SUMMARY-EVERYWHERE.

## Calc / derived-metric editor (AR-49 M3.0)
A define-mode toggle in `MetricEditor` (base vs calculated) renders `CalcBuilder` +
`ExprTreeEditor` (a small in-house visual expr-tree, not Blockly) → emits pure
`ManifestMetric{calc}` through the UNCHANGED `saveSemanticCatalog` chain; pure core in
`metricCalc.ts` (templates/build/cycle-detect). Operands are governed metric ids picked from the
catalog (never raw codes); validation rejects non-governed operands, self-reference, transitive
cycles, undeclared `$derived` refs, calc-XOR-code.
**Not built:** numeric live-preview on the active canvas coordinate — the Model surface threads no
live `DataStore`/`SectionContext`, so shipped a formula (text) `aria-live` preview instead (the
WCAG-compliant fallback). Live-COMPUTE is proven against the real engine runtime in
`metricCalc.test.ts`, not in the UI.

## DataSpec editor — source-of-truth types
The visual DataSpec Query Builder (`apps/panel/src/features/data-layer/`) must emit shapes the
engine `interpretSpec`/`applyPipeline` actually accept — all types come from `@statdash/engine`
(`DataSpec` 9-variant union keyed in `SPEC_CATALOG`, `TransformStep`, `EncodingSpec`, `ObsQuery`;
source: `packages/core/src/config/section.ts`, `data/transform.ts`, `data/encoding.ts`, `sdmx.ts`).
Two real-config quirks the editors handle: `ObsQuery.measure` is `string|string[]` (normalize);
`sort.by` has simple (`{by:string,dir}`) AND compound (`{by:[{field,dir}]}`) forms. See
[[feedback_conform_engine_types]].
