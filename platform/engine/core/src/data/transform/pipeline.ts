import type { RawRow, TransformStep, PipelineContext } from './types'
import { applyMelt, applyRename, applyCast, applyFilter, applySort,
         applyConcat, applyTemplate, applyAddField, applySelect, applyDerive,
         applyAggregate, applyRollup, applyLookup, applyJoin, applyGroup } from './steps'

/** applyStep — Execute one TransformStep against a row array. */
export function applyStep(rows: RawRow[], step: TransformStep, ctx?: PipelineContext): RawRow[] {
  switch (step.op) {
    case 'melt':      return applyMelt(rows, step)
    case 'rename':    return applyRename(rows, step)
    case 'cast':      return applyCast(rows, step)
    case 'filter':    return applyFilter(rows, step, ctx)
    case 'sort':      return applySort(rows, step)
    case 'addField':  return applyAddField(rows, step)
    case 'select':    return applySelect(rows, step)
    case 'derive':    return applyDerive(rows, step)
    case 'aggregate': return applyAggregate(rows, step)
    case 'rollup':    return applyRollup(rows, step)
    case 'lookup':    return applyLookup(rows, step, ctx)
    case 'join':      return applyJoin(rows, step, ctx)
    case 'group':     return applyGroup(rows, step)
    case 'concat':    return applyConcat(rows, step)
    case 'template':  return applyTemplate(rows, step)
  }
}

/** applyPipeline — Execute an ordered list of TransformSteps in sequence. */
export function applyPipeline(rows: RawRow[], steps: TransformStep[], ctx?: PipelineContext): RawRow[] {
  return steps.reduce((acc, step) => applyStep(acc, step, ctx), rows)
}
