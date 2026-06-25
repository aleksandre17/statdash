// ── RowSpec authoring-schema registry [V2] ────────────────────────────────────
//
//  Open-for-extension registry of the AUTHORING PropSchema for a RowSpec (one
//  entry of a `row-list` DataSpec). A RowSpec is a single shape (not a union), so
//  there is ONE registered schema, keyed by ROW_SPEC_KEY. The registry exists (vs.
//  a bare exported constant) to mirror the param-schema / op-schema registries
//  EXACTLY — last-write-wins so a plugin or test may override the built-in — and so
//  the panel's rowSpecSchemaSource resolves the schema through the SAME lookup
//  shape as filterParamSchemaSource / transformStepSchemaSource (no special-casing
//  in the Inspector port).
//
//  WHY core (not the panel): the schema is part of RowSpec's authoring contract
//  (its editor is as much a property of the type as its renderer). Co-locating it
//  with the RowSpec interface (core) is the SSOT; the arrow lets core host
//  PropSchema (its only external dep is the core-origin LocaleString). Mirrors
//  param-schema-registry.ts — the schema half only; there is no runtime "handler"
//  because a RowSpec carries no behavior of its own (the renderer interprets it).
//
import type { PropSchema } from './prop-schema'

/** The single registry key for the RowSpec authoring schema. */
export const ROW_SPEC_KEY = 'row-spec' as const

const _schemas = new Map<string, PropSchema>()

/**
 * Register the authoring PropSchema for RowSpec (keyed ROW_SPEC_KEY). Last-write-
 * wins (so a plugin or test may override the built-in). Mirrors registerParamSchema
 * one rung down — a row entry instead of a page-filter control.
 */
export function registerRowSpecSchema(schema: PropSchema): void {
  _schemas.set(ROW_SPEC_KEY, schema)
}

/**
 * The authoring PropSchema for RowSpec, or undefined if none is registered yet
 * (the Constructor would then fall back to a raw-JSON editor — but the built-in is
 * always registered via the rowspec-schemas module-init side-effect).
 */
export function getRowSpecSchema(): PropSchema | undefined {
  return _schemas.get(ROW_SPEC_KEY)
}
