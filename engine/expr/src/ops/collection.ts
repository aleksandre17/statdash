import type { Expr, ExprScope, ExprVal } from '../types.ts'

type CollectionOp = Extract<Expr,
  | { op: 'some' } | { op: 'every' } | { op: 'filter' }
  | { op: 'count' } | { op: 'map' }
>
type EvalFn = (expr: ExprVal, scope: ExprScope) => unknown

export function evalCollection(expr: CollectionOp, scope: ExprScope, evalFn: EvalFn): unknown {
  const rows = scope.rows ?? []

  switch (expr.op) {
    case 'count':
      return rows.length

    case 'some': {
      // 1 allocation per op call (not N allocations per row) — mutate inner.row per iteration
      const inner = { ...scope } as ExprScope
      return rows.some(row => { inner.row = row; return Boolean(evalFn(expr.expr, inner)) })
    }

    case 'every': {
      const inner = { ...scope } as ExprScope
      return rows.every(row => { inner.row = row; return Boolean(evalFn(expr.expr, inner)) })
    }

    case 'filter': {
      // Returns ExprRow[] — useful in DeriveMap pipeline; not a DimVal scalar
      const inner = { ...scope } as ExprScope
      return rows.filter(row => { inner.row = row; return Boolean(evalFn(expr.expr, inner)) })
    }

    case 'map': {
      // Returns unknown[] (DimVal[]) — usable in downstream collection ops or 'in' checks
      const inner = { ...scope } as ExprScope
      return rows.map(row => { inner.row = row; return evalFn(expr.expr, inner) })
    }
  }
}