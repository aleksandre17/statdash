// ── Transform step registry [N12] ─────────────────────────────────────
//
//  Open-for-extension registry of TransformStep handlers.
//  Built-in steps register at module init (transform/index.ts).
//  External steps register via registerTransformStep() — OCP pattern.
//
//  Constructor catalog: listTransformOps() returns sorted op codes.
//

import type { RawRow, TransformStep, PipelineContext } from './types'

/**
 * Handler signature for a transform step.
 * Receives the full TransformStep union; discriminate by step.op inside if needed.
 */
export type StepFn = (rows: RawRow[], step: TransformStep, ctx?: PipelineContext) => RawRow[]

const _registry = new Map<string, StepFn>()

/**
 * Register a transform step handler.
 * Last-write-wins — allows overriding built-ins in tests or plugins.
 */
export function registerTransformStep(op: string, fn: StepFn): void {
  _registry.set(op, fn)
}

/** Lookup a handler by op — the single dispatch source for applyStep(). */
export function getTransformStep(op: string): StepFn | undefined {
  return _registry.get(op)
}

/**
 * Returns the sorted list of registered op codes.
 * Used by the Constructor to populate the transform-step catalog.
 */
export function listTransformOps(): string[] {
  return [..._registry.keys()].sort()
}
