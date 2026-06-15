// ── transform/ barrel ─────────────────────────────────────────────────
//
//  Public surface of the transform sub-module.
//  Callers import from '../transform' or '../../data/transform' — the
//  thin re-export in transform.ts points here.
//
export type { RawRow, DeriveExpr, TransformStep, PipelineContext } from './types'
export { fmtNum, FORMATTERS, getFormatter }                        from './formatters'
export { applyStep, applyPipeline }                                from './pipeline'
