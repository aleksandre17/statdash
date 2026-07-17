// ── transform/ barrel ─────────────────────────────────────────────────
//
//  Public surface of the transform sub-module.
//  Callers import from '../transform' or '../../data/transform' — the
//  thin re-export in transform.ts points here.
//
export type { RawRow, DeriveExpr, TransformStep, PipelineContext } from './types'
export { fmtNum, compact, FORMATTERS, getFormatter }               from './formatters'
export { applyStep, applyPipeline }                                from './pipeline'
export { resolvePipeRefs }                                         from './resolve-refs'

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
  sortSchema, filterSchema, blendSchema,
} from './op-schemas'
import type { RawRow } from './types'

// Each op registers its handler, its authoring PropSchema (OCP — the op is the SSOT
// for both its runtime behavior and its Constructor editor), AND its author-facing
// `category` (ADR-046 · SPEC §1.2). The category is the 4th arg — the projection the
// 7-verb palette / rail / "+add step" menu are VIEWS of (declaration→projection, the
// Bounded-Element ideal — never an external per-op switch). Assigning it changes NO
// runtime dispatch (applyStep never consults category); it only groups the ops for
// perception. The mapping IS SPEC §1.2's table (the taxonomy SSOT); FF-VERB-COVERAGE
// pins it so a new/removed op must make its category decision deliberately.
registerTransformStep('addField',     applyAddField     as StepFn, addFieldSchema,  'derive')
registerTransformStep('aggregate',    applyAggregate    as StepFn, aggregateSchema, 'aggregate')
// blend — DECLARATIVE cross-store enrichment. It is the Constructor-authorable
// front-door for joinByField (carries a schema → leaves COVERAGE_TODO), but it
// has NO real core handler: resolving its secondary store needs the react
// manifest (ctx.stores), which core must not see (Law 3). The react binding
// layer (resolveBlends) rewrites every blend → joinByField BEFORE the pipeline
// runs. The identity handler registered here is the safe fallback ONLY for a
// blend that somehow reaches the core pipeline un-desugared: it cannot reach a
// second store, so it passes rows through unchanged rather than crashing.
registerTransformStep('blend',        ((rows: RawRow[]) => rows) as StepFn, blendSchema, 'combine')
registerTransformStep('cast',         applyCast         as StepFn, castSchema,      'derive')
registerTransformStep('concat',       applyConcat       as StepFn, concatSchema,    'derive')
registerTransformStep('derive',       applyDerive       as StepFn, deriveSchema,    'derive')
registerTransformStep('filter',       applyFilter       as StepFn, filterSchema,    'filter')
registerTransformStep('group',        applyGroup        as StepFn, groupSchema,     'aggregate')
registerTransformStep('join',         applyJoin         as StepFn, joinSchema,      'combine')
// joinByField carries already-RESOLVED EngineRow[] (the caller must resolve any
// DataSpec to rows before constructing it) — NOT declaratively authorable by a
// non-programmer. Intentionally schema-less → stays in COVERAGE_TODO (Fitness #1).
// It is the resolved-rows underside of `blend` (SPEC §1.1) → `combine`.
registerTransformStep('joinByField',  applyJoinByField  as StepFn, undefined,       'combine')
registerTransformStep('lookup',       applyLookup       as StepFn, lookupSchema,    'combine')
registerTransformStep('melt',         applyMelt         as StepFn, meltSchema,      'reshape')
registerTransformStep('reduce',       applyReduce       as StepFn, reduceSchema,    'aggregate')
registerTransformStep('rename',       applyRename       as StepFn, renameSchema,    'reshape')
registerTransformStep('rollup',       applyRollup       as StepFn, rollupSchema,    'aggregate')
registerTransformStep('select',       applySelect       as StepFn, selectSchema,    'reshape')
registerTransformStep('sort',         applySort         as StepFn, sortSchema,      'sort')
registerTransformStep('template',     applyTemplate     as StepFn, templateSchema,  'derive')
registerTransformStep('window',       applyWindow       as StepFn, windowSchema,    'derive')
