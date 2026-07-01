---
name: value-mappings-architecture
description: EXP-06 value mappings (value→{text,token,icon}) — layer split core/styles/plugins/panel, token-bound colour seam, FieldControl authoring
metadata:
  type: project
---

Value mappings (Grafana-style value→presentation, EXP-06) — token-bound (no literal colour), authorable, consumed by table status cells. Layer split (Clean Architecture arrow):

- **core (`config/value-mapping.ts`):** `ValueMapping`/`ValueMappingMatch`(exact|range|regex|empty)/`ValueMappingResult` + pure `applyValueMap(value, mappings)` (Strategy by match.kind, first-match-wins). `valueMappings?: ValueMapping[]` added to `ColumnDef`. NO labels here (Law 4). The `token` field is a registered semantic-token KEY (e.g. `'status.positive-fg'`), never a colour literal.
- **styles (`utils/tokenColor.ts`):** `tokenCssVar(key)`→`var(--…)`, `tokenColorLiteral(key,fb)` (computed, for SVG), `isRegisteredColorToken(key)` (the FF predicate). Looks up `TOKENS_CATALOG` (= DATA_COLOR_TOKENS, the registered-token SSOT).
- **plugins consumer (`panels/table/.../MappedCell.tsx`):** applied in `SimpleTable` non-bar cells. Renders mapped TEXT (always — WCAG 1.4.1 no colour-only) coloured via `tokenCssVar(token)`; icon aria-hidden; falls back to raw formatted value on no match.
- **panel authoring:** `VALUE_MAPPING_SCHEMA` lives in `apps/panel/src/inspector/controls/value-mapping/valueMappingSchema.ts` (NOT core — bilingual labels; see [[i18n-label-completeness-gate]]). `ValueMappingField` FieldControl = ordered rule list (▲▼ reorder since first-match = priority; keyboard-operable) reusing the generic Inspector over the schema via `valueMappingSchemaSource`. Registered under PropFieldType key `'value-mapping'` via a side-effect module imported in `App.tsx` (NOT in FieldControlRegistry.ts — would cycle: ValueMappingField→Inspector→FieldControlRegistry).

Fitness: FF-VALUE-MAPPING runtime half in `plugins/__tests__/valueMapping.fitness.test.tsx` (token resolves to var(), never hex; a11y text; fallback); authoring/structural half (token field is `enum-ref` source `'tokens'` — no free hex) in `apps/panel/.../valueMappingAuthorable.fitness.test.ts`.
