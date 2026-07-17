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
