// ── visibilityLeafSchemaSource — Inspector schema port for a VisibilityExpr leaf [V4] ──
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A VisibilityExpr LEAF
//  (eq / neq / in / isset / mode-*) is just another such element: its schema is
//  the op's authoring PropSchema, which the op CARRIES in the engine's visibility
//  registry (OCP). This source returns that schema — so a leaf condition is
//  authored by the SAME Inspector that renders node / panel / chrome / transform-
//  step / ParamDef properties, with NO bespoke per-op form (the ADR mandate,
//  mirroring filterParamSchemaSource for ParamDefs and transformStepSchemaSource
//  for transform steps).
//
//  Composite ops (and/or/not) are NOT resolved here — they have no scalar schema;
//  the recursive VisibilityBuilder renders their child sub-tree directly. A new
//  leaf op that registers a schema becomes authorable here with zero panel code
//  (the editor models the leaf as `{ type: leaf.op, props: leaf }`).
//
import { getVisibilityLeafSchema } from '@statdash/engine'
import type { SchemaSource } from '../../inspector/schemaSource'

export const visibilityLeafSchemaSource: SchemaSource = {
  // node.type carries the leaf op; the schema is the op's registered leaf schema.
  getSchema: (node) => getVisibilityLeafSchema(node.type) ?? [],
  // Leaf schemas are flat (no accordion grouping).
  getGroups: () => [],
}
