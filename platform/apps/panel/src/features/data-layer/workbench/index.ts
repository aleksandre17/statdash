// ── data-workbench barrel (W-P2 · ADR-046 · SPEC §3) ─────────────────────────────
//
//  The three-pane authoring surface (step rail · live grid · generated query) — the
//  Power-Query-class editor that re-homes the W-P1 grid into a wide surface. Entered
//  from the DATA facet (DataFacetField) via focus-view escalation.
//
export { DataWorkbench } from './DataWorkbench'
export type { DataWorkbenchProps } from './DataWorkbench'
export { GeneratedQueryPane } from './GeneratedQueryPane'
export type { GeneratedQueryPaneProps } from './GeneratedQueryPane'
export { describeAuthorSteps, describeStewardDetail } from './generatedQuery'
export type { AuthorStep, StewardDetail } from './generatedQuery'
export { VerbPalette } from './VerbPalette'
export type { VerbPaletteProps } from './VerbPalette'
export { buildVerbPalette, verbLabelForOp } from './verbProjection'
export type { VerbEntry } from './verbProjection'
// 0084 — the steward raw-cube Get entry + the promotion loop (E2).
export { GetHead } from './GetHead'
export type { GetHeadProps } from './GetHead'
export { RawCubePalette } from './RawCubePalette'
export type { RawCubePaletteProps } from './RawCubePalette'
export { PromoteMetric } from './PromoteMetric'
export type { PromoteMetricProps } from './PromoteMetric'
export {
  isStewardHead, stewardHeadMeasure, withStewardCube, promoteHeadToMetric,
} from './workbenchModel'
export {
  cubeLabelDebt, dimsWithDebt, dimLabelDebt, memberLacksLabel, debtNote,
} from './cubeDebt'
export type { DimLabelDebt } from './cubeDebt'
