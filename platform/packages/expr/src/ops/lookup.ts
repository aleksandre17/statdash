import type { DimVal, Expr, ExprRef, ExprScope, ExprVal } from '../types.ts'

type LookupOp  = Extract<Expr, { op: 'get' } | { op: 'coalesce' }>
type EvalFn    = (expr: ExprVal,  scope: ExprScope) => DimVal
type RefEvalFn = (ref:  ExprRef,  scope: ExprScope) => DimVal

export function evalLookup(expr: LookupOp, scope: ExprScope, evalFn: EvalFn, evalRef: RefEvalFn): DimVal {
  switch (expr.op) {
    case 'coalesce':
      for (const v of expr.values) {
        const result = evalFn(v, scope)
        if (result !== null) return result
      }
      return null

    case 'get': {
      const base = evalRef(expr.ref, scope)
      if (!expr.path) return base
      // DimVal scalars cannot be path-navigated; path navigation is for future object DimVal support
      if (base === null || typeof base !== 'object') return null
      const parts = expr.path.split('.')
      let current: unknown = base
      for (const part of parts) {
        if (current === null || typeof current !== 'object') return null
        current = (current as Record<string, unknown>)[part] ?? null
      }
      return current as DimVal
    }
  }
}