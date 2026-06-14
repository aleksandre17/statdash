import type { DimVal, Expr, ExprScope, ExprVal } from '../types.ts'

type LogicOp = Extract<Expr, { op: 'and' } | { op: 'or' } | { op: 'not' } | { op: 'if' }>
type EvalFn  = (expr: ExprVal, scope: ExprScope) => DimVal

export function evalLogic(expr: LogicOp, scope: ExprScope, evalFn: EvalFn): DimVal {
  switch (expr.op) {
    case 'and': return expr.exprs.every(e => Boolean(evalFn(e as ExprVal, scope)))
    case 'or':  return expr.exprs.some(e  => Boolean(evalFn(e as ExprVal, scope)))
    case 'not': return !Boolean(evalFn(expr.expr as ExprVal, scope))
    case 'if':
      return Boolean(evalFn(expr.cond as ExprVal, scope))
        ? evalFn(expr.then, scope)
        : (expr.else !== undefined ? evalFn(expr.else, scope) : null)
  }
}