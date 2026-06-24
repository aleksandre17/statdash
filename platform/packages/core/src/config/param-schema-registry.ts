// ── ParamDef authoring-schema registry [V0] ───────────────────────────────────
//
//  Open-for-extension registry of the AUTHORING PropSchema for each ParamDef
//  type (the page-level FilterSchema control vocabulary). A ParamDef type CARRIES
//  its authoring schema, registered alongside the union member at module init
//  (param-schemas.ts) — OCP: a NEW ParamDef type = a new union member + a new
//  renderer (packages/react) + a registerParamSchema() call here, and it becomes
//  fully authorable through the SAME generic Inspector with ZERO Constructor code.
//
//  WHY only a schema (no handler, unlike the transform step-registry):
//    A ParamDef's runtime "handler" is its filter CONTROL renderer, which lives in
//    `packages/react` (FilterRenderers.tsx) and may NOT be hosted in core (the
//    arrow: contracts ← … ← core ← … ← react). What core CAN own — and what the
//    Constructor needs — is the type's authoring contract (its PropSchema). So
//    this registry is the schema half only; the render half stays in react,
//    registered there. Same SSOT discipline as op-schemas, split by the arrow.
//
//  The panel's filterParamSchemaSource resolves a ParamDef through this registry
//  into the generic Inspector — no bespoke per-control form, no second form engine
//  (the ADR mandate, mirroring transformStepSchemaSource for transform steps).
//
import type { PropSchema } from './prop-schema'
import type { ParamDefType } from './discriminant-manifest'

const _schemas = new Map<string, PropSchema>()

/**
 * Register the authoring PropSchema for a ParamDef type. Last-write-wins (so a
 * plugin or test may override a built-in). A new ParamDef type that registers its
 * schema becomes fully authorable with zero Constructor code (the [V0] coverage
 * guarantee enforced by Coverage Fitness #1).
 */
export function registerParamSchema(type: ParamDefType | (string & {}), schema: PropSchema): void {
  _schemas.set(type, schema)
}

/**
 * The authoring PropSchema for a ParamDef type, or undefined if none is
 * registered yet (the Constructor falls back to a raw-JSON editor; the shrinking
 * set of schema-less types is the visible COVERAGE_TODO gap, Fitness #1).
 */
export function getParamSchema(type: string): PropSchema | undefined {
  return _schemas.get(type)
}

/** Sorted list of ParamDef types that carry an authoring PropSchema. */
export function listParamSchemas(): string[] {
  return [..._schemas.keys()].sort()
}
