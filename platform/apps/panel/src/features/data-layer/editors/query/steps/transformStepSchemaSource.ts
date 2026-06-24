// ── transformStepSchemaSource — Inspector schema port for a transform op [V1] ──
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A transform STEP is
//  just another such element: its schema is the op's authoring PropSchema, which
//  the op CARRIES in the engine's step-registry (OCP). This source returns that
//  schema — so a transform step is authored by the SAME Inspector that renders
//  node/panel/chrome properties, with NO bespoke per-op form (the ADR mandate).
//
//  A new op that registers a schema becomes authorable here with zero panel code
//  (the CanvasNode model is `{ type: step.op, props: step }`).
//
import { getTransformStepSchema } from '@statdash/engine'
import type { SchemaSource } from '../../../../../inspector/schemaSource'

export const transformStepSchemaSource: SchemaSource = {
  // node.type carries the op code; the schema is the op's registered PropSchema.
  getSchema: (node) => getTransformStepSchema(node.type) ?? [],
  // Transform-op schemas are flat (no accordion grouping) — none today.
  getGroups: () => [],
}
