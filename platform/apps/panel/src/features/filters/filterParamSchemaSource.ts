// ── filterParamSchemaSource — Inspector schema port for a ParamDef [V0] ────────
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A page-level filter
//  CONTROL (a ParamDef) is just another such element: its schema is the type's
//  authoring PropSchema, which the type CARRIES in the engine's param-schema
//  registry (OCP). This source returns that schema — so a ParamDef is authored by
//  the SAME Inspector that renders node / panel / chrome / transform-step
//  properties, with NO bespoke per-control form (the ADR mandate, mirroring
//  transformStepSchemaSource for transform steps).
//
//  A new ParamDef type that registers a schema becomes authorable here with zero
//  panel code (the editor models the ParamDef as `{ type, props: paramNode }`).
//
import { getParamSchema } from '@statdash/engine'
import type { SchemaSource } from '../../inspector/schemaSource'

export const filterParamSchemaSource: SchemaSource = {
  // node.type carries the ParamDef type; the schema is the type's registered one.
  getSchema: (node) => getParamSchema(node.type) ?? [],
  // ParamDef schemas are flat (no accordion grouping) — none today.
  getGroups: () => [],
}
