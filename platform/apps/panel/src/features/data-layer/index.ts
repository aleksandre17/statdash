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
