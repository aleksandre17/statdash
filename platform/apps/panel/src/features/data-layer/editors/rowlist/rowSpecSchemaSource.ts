// ── rowSpecSchemaSource — Inspector schema port for a RowSpec [V2] ─────────────
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A `row-list` ROW entry
//  (a RowSpec) is just another such element: its schema is the RowSpec authoring
//  PropSchema, which RowSpec CARRIES in the engine's rowspec-schema registry (OCP).
//  This source returns that schema — so a RowSpec is authored by the SAME Inspector
//  that renders node / panel / chrome / transform-step / ParamDef properties, with
//  NO bespoke per-field form (the ADR mandate, mirroring filterParamSchemaSource).
//
import { getRowSpecSchema } from '@statdash/engine'
import type { SchemaSource } from '../../../../inspector/schemaSource'

export const rowSpecSchemaSource: SchemaSource = {
  // A RowSpec is a single shape (not a union), so the schema is source-independent
  // of node.type — the one registered RowSpec schema.
  getSchema: () => getRowSpecSchema() ?? [],
  // RowSpec schema is flat (no accordion grouping).
  getGroups: () => [],
}
