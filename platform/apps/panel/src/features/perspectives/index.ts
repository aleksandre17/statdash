// ── features/perspectives — page-level PerspectiveAxis authoring [P-final] ─────
//
//  The "Perspectives pane": authors a page's perspective axes (the OLAP query-view
//  axis — VISION #3) through the SAME generic Inspector + recursive VisibilityBuilder
//  every other element uses. The convergent best-in-class primitive (Power BI pane +
//  Grafana variables-list + Tableau parameter + Looker measure), unified, with an
//  always-live preview (`perspective = f(state)`). Page-scoped (mirrors features/
//  filters + features/page-config). The scope fields are registry-driven (Law 8 / OCP):
//  a new perspective-scope key auto-surfaces with zero pane edit.
//
export { PerspectivesPane }      from './PerspectivesPane'
export { PerspectiveDefEditor }  from './PerspectiveDefEditor'
export { perspectiveDefSchemaSource, perspectiveDefSchema, perspectiveDefGroups } from './perspectiveDefSchemaSource'
export { perspectiveScopeSchemaSource, perspectiveScopeSchema } from './perspectiveScopeSchemaSource'
export {
  toAxisViews, setAxisPerspectives, toAxis, movePerspective,
  type PerspectiveAxisView,
} from './perspectiveModel'
export { makePerspectiveDef, DEFAULT_PERSPECTIVE_PARAM } from './perspectiveFactory'
