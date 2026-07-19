// ── specSchemaSource — Inspector schema port for a DataSpec kind (ADR-049 P1) ──
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A DataSpec is just
//  another such element: for the `schema`-arm bind-kinds, its authoring schema is
//  the kind's PropSchema, which the kind CARRIES in the engine's SPEC_CATALOG
//  authoring contract (OCP). This source returns that schema — so a schema-arm
//  DataSpec is authored by the SAME Inspector that renders node / panel / chrome /
//  transform-step / ParamDef properties, with NO bespoke per-kind form.
//
//  Mirrors transformStepSchemaSource (transform ops) and filterParamSchemaSource
//  (ParamDefs) EXACTLY — one rung up, at the DataSpec kind itself. A new bind-kind
//  that declares a `schema` becomes authorable here with zero panel code (the
//  DataSpec is modeled as `{ type: spec.type, props: spec }`).
//
import { resolveSpecAuthoring } from '@statdash/engine'
import type { SchemaSource } from '../../inspector/schemaSource'

export const specSchemaSource: SchemaSource = {
  // node.type carries the DataSpec discriminant; the schema is the kind's declared one.
  getSchema: (node) => resolveSpecAuthoring(node.type)?.schema ?? [],
  // DataSpec kind schemas are flat (no accordion grouping) — none today.
  getGroups: () => [],
}
