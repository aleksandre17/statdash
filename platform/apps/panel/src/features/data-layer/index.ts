// ── data-layer feature barrel ─────────────────────────────────────────────────
//
//  Public surface: the DataSpec visual editor used by the wizard's DataStep.
//  Type-specific editors are exported for direct reuse/testing.
//

export { DataSpecEditor } from './DataSpecEditor'
export type { DataSpecEditorProps } from './DataSpecEditor'

export { QuerySpecEditor } from './editors/QuerySpecEditor'
export { TimeseriesEditor } from './editors/TimeseriesEditor'
export { GrowthEditor } from './editors/GrowthEditor'
export { RatioListEditor } from './editors/RatioListEditor'
export { RowListEditor } from './editors/rowlist/RowListEditor'
export { RowSpecEditor } from './editors/rowlist/RowSpecEditor'
export { ByModeEditor } from './editors/ByModeEditor'
export { TransformEditor } from './editors/TransformEditor'
export { PivotEditor } from './editors/PivotEditor'

// V5 — drag-to-bind field wells + Tableau "Show Me" suggested charts.
export { FieldWells } from './fieldwells/FieldWells'
export { FieldPalette } from './fieldwells/FieldPalette'
export { FieldWell } from './fieldwells/FieldWell'
export { ShowMe } from './showme/ShowMe'
export { fieldChips } from './fieldwells/fieldChips'
export type { FieldChip, FieldKind } from './fieldwells/fieldChips'
export { buildSuggestedSpec } from './showme/buildSuggestedSpec'
