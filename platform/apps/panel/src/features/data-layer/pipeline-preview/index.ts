// ── pipeline-preview barrel (W-P1 · ADR-046 · SPEC §3.2) ──────────────────────
//
//  The live per-step data grid + its pure projection. Composable so W-P2 can
//  re-home the grid into the three-pane shell.
//
export { PipelineStepGrid } from './PipelineStepGrid'
export type { PipelineStepGridProps } from './PipelineStepGrid'
export { PipelineDataGrid } from './PipelineDataGrid'
export type { PipelineDataGridProps } from './PipelineDataGrid'
export { usePipelineSourceRows } from './usePipelineSourceRows'
export type { PipelineSource, PreviewStatus } from './usePipelineSourceRows'
export {
  deriveStepRows, capRows, deriveColumns, toGridCell,
  AS_OF_SOURCE, PREVIEW_CAP, MISSING_GLYPH,
} from './pipelinePreview'
export type { CappedRows, GridCell, GridCellState } from './pipelinePreview'
export { buildColumnLabels } from './columnLabels'
export type { ColumnLabelResolver } from './columnLabels'
