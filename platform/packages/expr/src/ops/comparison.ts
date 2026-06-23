import type { DimVal, Expr, ExprScope, ExprVal } from '../types.ts'

type ComparisonOp = Extract<Expr,
  | { op: 'eq'  } | { op: 'ne'     } | { op: 'gt'  } | { op: 'lt' }
  | { op: 'gte' } | { op: 'lte'    } | { op: 'in'  } | { op: 'nin' }
  | { op: 'null' } | { op: 'exists' }
>

type EvalFn = (expr: ExprVal, scope: ExprScope) => DimVal

export function evalComparison(expr: ComparisonOp, scope: ExprScope, evalFn: EvalFn): boolean {
  switch (expr.op) {
    case 'eq':  return evalFn(expr.left, scope) === evalFn(expr.right, scope)
    case 'ne':  return evalFn(expr.left, scope) !== evalFn(expr.right, scope)
    case 'gt':  return (evalFn(expr.left, scope) as number) >  (evalFn(expr.right, scope) as number)
    case 'lt':  return (evalFn(expr.left, scope) as number) <  (evalFn(expr.right, scope) as number)
    case 'gte': return (evalFn(expr.left, scope) as number) >= (evalFn(expr.right, scope) as number)
    case 'lte': return (evalFn(expr.left, scope) as number) <= (evalFn(expr.right, scope) as number)

    case 'in': {
      const left = evalFn(expr.left, scope)
      return expr.right.some(r => evalFn(r, scope) === left)
    }
    case 'nin': {
      const left = evalFn(expr.left, scope)
      return expr.right.every(r => evalFn(r, scope) !== left)
    }

    case 'null':   return evalFn(expr.value, scope) === null
    case 'exists': return evalFn(expr.value, scope) !== null
  }
}