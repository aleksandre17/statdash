import type { DimVal, Expr, ExprScope, ExprVal } from '../types.ts'
import { evalTemplate } from '../template.ts'

type StringOp = Extract<Expr,
  | { op: 'template' } | { op: 'concat' }
  | { op: 'startsWith' } | { op: 'includes' }
>
type EvalFn = (expr: ExprVal, scope: ExprScope) => DimVal

export function evalString(expr: StringOp, scope: ExprScope, evalFn: EvalFn): DimVal {
  switch (expr.op) {
    case 'template':
      return evalTemplate(expr.tmpl, scope)

    case 'concat':
      return expr.values.map(v => {
        const val = evalFn(v, scope)
        return val === null ? '' : String(val)
      }).join('')

    case 'startsWith':
      return String(evalFn(expr.left, scope) ?? '').startsWith(expr.right)

    case 'includes':
      return String(evalFn(expr.left, scope) ?? '').includes(expr.right)
  }
}