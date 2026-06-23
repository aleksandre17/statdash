// ── transform/ barrel ─────────────────────────────────────────────────
//
//  Public surface of the transform sub-module.
//  Callers import from '../transform' or '../../data/transform' — the
//  thin re-export in transform.ts points here.
//
export type { RawRow, DeriveExpr, TransformStep, PipelineContext } from './types'
export { fmtNum, FORMATTERS, getFormatter }                        from './formatters'
export { applyStep, applyPipeline }                                from './pipeline'

// ── Registry initialization — register all built-in transform ops ──────
//
//  Built-in steps register at module init. External plugins register via
//  registerTransformStep(). Used by applyStep() registry lookup and by
//  the Constructor to populate the op catalog.
//

import { registerTransformStep } from './step-registry'
import type { StepFn } from './step-registry'
import { applyMelt, applyRename, applyCast, applyFilter, applySort,
         applyConcat, applyTemplate, applyAddField, applySelect,
         applyAggregate, applyGroup, applyJoin, applyRollup, applyLookup,
         applyDerive } from './steps'
import { applyReduce } from './ops/reduce'
import { applyWindow } from './ops/window'
import { applyJoinByField } from './ops/joinByField'

registerTransformStep('addField',     applyAddField     as StepFn)
registerTransformStep('aggregate',    applyAggregate    as StepFn)
registerTransformStep('cast',         applyCast         as StepFn)
registerTransformStep('concat',       applyConcat       as StepFn)
registerTransformStep('derive',       applyDerive       as StepFn)
registerTransformStep('filter',       applyFilter       as StepFn)
registerTransformStep('group',        applyGroup        as StepFn)
registerTransformStep('join',         applyJoin         as StepFn)
registerTransformStep('joinByField',  applyJoinByField  as StepFn)
registerTransformStep('lookup',       applyLookup       as StepFn)
registerTransformStep('melt',         applyMelt         as StepFn)
registerTransformStep('reduce',       applyReduce       as StepFn)
registerTransformStep('rename',       applyRename       as StepFn)
registerTransformStep('rollup',       applyRollup       as StepFn)
registerTransformStep('select',       applySelect       as StepFn)
registerTransformStep('sort',         applySort         as StepFn)
registerTransformStep('template',     applyTemplate     as StepFn)
registerTransformStep('window',       applyWindow       as StepFn)
