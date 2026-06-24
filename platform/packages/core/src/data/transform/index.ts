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
import {
  meltSchema, renameSchema, castSchema, concatSchema, templateSchema,
  addFieldSchema, selectSchema, aggregateSchema, rollupSchema, groupSchema,
  reduceSchema, windowSchema, joinSchema, deriveSchema, lookupSchema,
  sortSchema, filterSchema,
} from './op-schemas'

// Each op registers its handler AND its authoring PropSchema (OCP — the op is
// the SSOT for both its runtime behavior and its Constructor editor; the panel
// renders the schema through the generic Inspector, not a per-op form).
registerTransformStep('addField',     applyAddField     as StepFn, addFieldSchema)
registerTransformStep('aggregate',    applyAggregate    as StepFn, aggregateSchema)
registerTransformStep('cast',         applyCast         as StepFn, castSchema)
registerTransformStep('concat',       applyConcat       as StepFn, concatSchema)
registerTransformStep('derive',       applyDerive       as StepFn, deriveSchema)
registerTransformStep('filter',       applyFilter       as StepFn, filterSchema)
registerTransformStep('group',        applyGroup        as StepFn, groupSchema)
registerTransformStep('join',         applyJoin         as StepFn, joinSchema)
// joinByField carries already-RESOLVED EngineRow[] (the caller must resolve any
// DataSpec to rows before constructing it) — NOT declaratively authorable by a
// non-programmer. Intentionally schema-less → stays in COVERAGE_TODO (Fitness #1).
registerTransformStep('joinByField',  applyJoinByField  as StepFn)
registerTransformStep('lookup',       applyLookup       as StepFn, lookupSchema)
registerTransformStep('melt',         applyMelt         as StepFn, meltSchema)
registerTransformStep('reduce',       applyReduce       as StepFn, reduceSchema)
registerTransformStep('rename',       applyRename       as StepFn, renameSchema)
registerTransformStep('rollup',       applyRollup       as StepFn, rollupSchema)
registerTransformStep('select',       applySelect       as StepFn, selectSchema)
registerTransformStep('sort',         applySort         as StepFn, sortSchema)
registerTransformStep('template',     applyTemplate     as StepFn, templateSchema)
registerTransformStep('window',       applyWindow       as StepFn, windowSchema)
