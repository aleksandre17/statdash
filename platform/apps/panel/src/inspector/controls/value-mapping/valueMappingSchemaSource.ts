// ── valueMappingSchemaSource — Inspector schema port for ONE value-mapping rule ──
//
//  A value-mapping rule is authored by the SAME generic Inspector that renders node /
//  panel / chrome / transform-step / ParamDef / RowSpec properties — driven by the
//  VALUE_MAPPING_SCHEMA the engine CARRIES (config/value-mapping.ts, OCP). No bespoke
//  per-field form (the ADR mandate). Mirrors rowSpecSchemaSource EXACTLY, one rung
//  over: a mapping rule instead of a row entry. The schema's `match.kind` discriminant
//  drives showWhen, so the Inspector shows only the relevant condition fields.
//
import { VALUE_MAPPING_SCHEMA } from './valueMappingSchema'
import type { SchemaSource } from '../../schemaSource'

/** CanvasNode `type` used to model one value-mapping rule for the Inspector. */
export const VALUE_MAPPING_RULE_KEY = 'value-mapping-rule'

export const valueMappingSchemaSource: SchemaSource = {
  // A mapping rule is a single shape (the discriminant is INSIDE, on match.kind), so
  // the schema is independent of node.type — the one VALUE_MAPPING_SCHEMA.
  getSchema: () => VALUE_MAPPING_SCHEMA,
  getGroups: () => [],
}
