// @statdash/expr — public API
// Pure TypeScript. Zero dependencies. JSON-serializable expression evaluation.

export type {
  DimVal,
  ExprRow,
  ExprRef,
  ListRef,
  ExprVal,
  Expr,
  ExprScope,
  DeriveMap,
} from './src/types.ts'

export { evalExpr, registerExprOp }              from './src/eval.ts'
export { evalDerived, validateDeriveMap }        from './src/derive.ts'
export type { DeriveOrderError }                 from './src/derive.ts'
export { parseFormula }                          from './src/formula.ts'
export type { FormulaOptions }                   from './src/formula.ts'
export { evalTemplate }                          from './src/template.ts'
export { isExpr, isExprRef, isDimVal, isListRef, classifyExprVal } from './src/guards.ts'
export { ExprEvalError }                         from './src/errors.ts'

// ── Capability Catalogs — Self-Describing Module (Panel / Constructor) ─
export type { OpCategory, OpArgType, OpDescriptor } from './ops-catalog.ts'
export { OPS_CATALOG }                              from './ops-catalog.ts'
export type { RefKind, RefDescriptor }              from './refs-catalog.ts'
export { REFS_CATALOG }                             from './refs-catalog.ts'