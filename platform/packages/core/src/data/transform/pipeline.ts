import type { RawRow, TransformStep, PipelineContext } from './types'
import { getTransformStep } from './step-registry'

/**
 * applyStep — Execute one TransformStep against a row array.
 *
 * Dispatches through the open step-registry (OCP): every built-in registers in
 * transform/index.ts, plugins register via registerTransformStep(). A single
 * dispatch path means a custom op and a built-in op are reached identically —
 * no closed switch to keep in sync. Unknown op → rows unchanged (no throw).
 */
export function applyStep(rows: RawRow[], step: TransformStep, ctx?: PipelineContext): RawRow[] {
  const fn = getTransformStep(step.op)
  return fn ? fn(rows, step, ctx) : rows
}

/** applyPipeline — Execute an ordered list of TransformSteps in sequence. */
export function applyPipeline(rows: RawRow[], steps: TransformStep[], ctx?: PipelineContext): RawRow[] {
  return steps.reduce((acc, step) => applyStep(acc, step, ctx), rows)
}
