import type { DimVal, Expr, ExprScope, ExprVal } from '../types.ts'

type MathOp = Extract<Expr,
  | { op: 'add' } | { op: 'sub' } | { op: 'mul' }
  | { op: 'div' } | { op: 'mod' }
>
type EvalFn = (expr: ExprVal, scope: ExprScope) => DimVal

export function evalMath(expr: MathOp, scope: ExprScope, evalFn: EvalFn): DimVal {
  const l = evalFn(expr.left,  scope) as number
  const r = evalFn(expr.right, scope) as number

  switch (expr.op) {
    case 'add': return l + r
    case 'sub': return l - r
    case 'mul': return l * r
    case 'div': return r !== 0 ? l / r : null  // div-by-zero → null (fail-safe)
    case 'mod': return l % r
  }
}