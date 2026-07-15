// ── thresholdStepSchemaSource — Inspector schema port for ONE threshold step ──
//
//  A threshold step is authored by the SAME generic Inspector that renders node /
//  panel / value-mapping-rule properties — driven by THRESHOLD_STEP_SCHEMA. No bespoke
//  per-field form (the ADR mandate). Mirrors valueMappingSchemaSource EXACTLY, one axis
//  over: an ordered numeric breakpoint instead of a heterogeneous match rule.
//
import { THRESHOLD_STEP_SCHEMA } from './thresholdStepSchema'
import type { SchemaSource }     from '../../schemaSource'

/** CanvasNode `type` used to model one threshold step for the Inspector. */
export const THRESHOLD_STEP_KEY = 'threshold-step'

export const thresholdStepSchemaSource: SchemaSource = {
  // A step is a single flat shape (no inner discriminant), so the schema is
  // independent of node.type — the one THRESHOLD_STEP_SCHEMA.
  getSchema: () => THRESHOLD_STEP_SCHEMA,
  getGroups: () => [],
}
