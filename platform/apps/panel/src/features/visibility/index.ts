// ── features/visibility — node-level "show when" condition authoring [V4] ──────
//
//  The Constructor surface that closes the last Coverage Fitness #1 category
//  (visibilityOps): a recursive, schema-driven builder for a node's
//  `view.visibleWhen` VisibilityExpr. Leaf ops render through the SAME generic
//  Inspector (visibilityLeafSchemaSource); composites (and/or/not) render as a
//  recursive group/negation. Mirrors features/filters (V0) for the page-level
//  ParamDef surface.
//
export { VisibilitySection }    from './VisibilitySection'
export { VisibilityBuilder }    from './VisibilityBuilder'
export { VisibilityLeafEditor } from './VisibilityLeafEditor'
export { visibilityLeafSchemaSource } from './visibilityLeafSchemaSource'
export {
  makeVisibilityExpr, isComposite,
  VISIBILITY_LEAF_OPS, VISIBILITY_COMPOSITE_OPS,
} from './visibilityFactory'
export type { VisibilityOpId } from './visibilityFactory'
export type { VisibilityLeaf } from './VisibilityLeafEditor'
