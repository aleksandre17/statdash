// ── Transform step registry [N12] ─────────────────────────────────────
//
//  Open-for-extension registry of TransformStep handlers.
//  Built-in steps register at module init (transform/index.ts).
//  External steps register via registerTransformStep() — OCP pattern.
//
//  Constructor catalog: listTransformOps() returns sorted op codes.
//

import type { RawRow, TransformStep, PipelineContext } from './types'
import type { PropSchema } from '../../config/prop-schema'

/**
 * Handler signature for a transform step.
 * Receives the full TransformStep union; discriminate by step.op inside if needed.
 */
export type StepFn = (rows: RawRow[], step: TransformStep, ctx?: PipelineContext) => RawRow[]

const _registry = new Map<string, StepFn>()
const _schemas  = new Map<string, PropSchema>()

/**
 * Register a transform step handler — and, optionally, the AUTHORING PropSchema
 * the Constructor renders to edit a step of this op (OCP: the op is the SSOT for
 * BOTH its runtime behavior AND its editor; the panel's PipelineBuilder reads
 * this schema through the generic Inspector, never a bespoke per-op form).
 *
 * Last-write-wins — allows overriding built-ins in tests or plugins. A plugin
 * that registers a new op + its schema becomes fully authorable with zero
 * Constructor code (the [V1] coverage guarantee).
 */
export function registerTransformStep(op: string, fn: StepFn, schema?: PropSchema): void {
  _registry.set(op, fn)
  if (schema) _schemas.set(op, schema)
}

/** Lookup a handler by op — the single dispatch source for applyStep(). */
export function getTransformStep(op: string): StepFn | undefined {
  return _registry.get(op)
}

/**
 * The authoring PropSchema for an op, or undefined if the op declared none yet
 * (the Constructor falls back to a raw-JSON editor for those). The shrinking set
 * of schema-less ops is the visible COVERAGE_TODO gap (Fitness #1).
 */
export function getTransformStepSchema(op: string): PropSchema | undefined {
  return _schemas.get(op)
}

/**
 * Returns the sorted list of registered op codes.
 * Used by the Constructor to populate the transform-step catalog.
 */
export function listTransformOps(): string[] {
  return [..._registry.keys()].sort()
}

/** Sorted list of op codes that carry an authoring PropSchema. */
export function listTransformOpSchemas(): string[] {
  return [..._schemas.keys()].sort()
}
