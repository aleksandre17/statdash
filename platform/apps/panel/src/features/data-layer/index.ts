// ── data-layer feature barrel ─────────────────────────────────────────────────
//
//  Public surface: the DataSpec visual editor used by the wizard's DataStep.
//  Type-specific editors are exported for direct reuse/testing.
//

export { DataSpecEditor } from './DataSpecEditor'
export type { DataSpecEditorProps } from './DataSpecEditor'

// The full source/spec browser + editor body — shared by the wizard's DataStep
// and the Studio Data surface (AR-49 M1.3). One component, no fork.
export { DataModelingPanel } from './DataModelingPanel'

export { QuerySpecEditor } from './editors/QuerySpecEditor'
export { TimeseriesEditor } from './editors/TimeseriesEditor'
export { GrowthEditor } from './editors/GrowthEditor'
// ratio-list migrated to the SCHEMA arm (ADR-049 P1 step 4) — authored by the
// generic Inspector (SPEC_CATALOG['ratio-list'].schema), no bespoke editor.
export { RowListEditor } from './editors/rowlist/RowListEditor'
export { RowSpecEditor } from './editors/rowlist/RowSpecEditor'
export { TransformEditor } from './editors/TransformEditor'
export { PivotEditor } from './editors/PivotEditor'
export { MetricSpecEditor } from './editors/MetricSpecEditor'

// V5 — drag-to-bind field wells + Tableau "Show Me" suggested charts.
export { FieldWells } from './fieldwells/FieldWells'
export { FieldPalette } from './fieldwells/FieldPalette'
export { FieldWell } from './fieldwells/FieldWell'
export { ShowMe } from './showme/ShowMe'
export { fieldChips } from './fieldwells/fieldChips'
export type { FieldChip, FieldKind } from './fieldwells/fieldChips'
export { buildSuggestedSpec } from './showme/buildSuggestedSpec'
