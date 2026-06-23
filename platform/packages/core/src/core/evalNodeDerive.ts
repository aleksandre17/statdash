import { evalExpr }               from '@statdash/expr'
import type { DimVal, ExprScope } from '@statdash/expr'
import type { DataLookupOp, DeriveEntry, NodeDeriveMap } from './types'
import type { SectionContext }    from './context'
import type { DataStore }         from '../data/store'
import { interpretSpec }          from '../data/spec'

function isDataLookupOp(e: DeriveEntry): e is DataLookupOp {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) return false
  const op = (e as Record<string, unknown>)['op']
  return op === 'tree-field' || op === 'map-field'
}

function evalDataLookup(
  op:    DataLookupOp,
  scope: ExprScope,
  ctx:   SectionContext,
  store: DataStore,
): DimVal {
  const refVal = evalExpr<DimVal>(op.ref, scope)
  const rows   = interpretSpec(op.data, ctx, store)
  const sparse = rows as unknown as Record<string, DimVal | undefined>[]

  if (op.op === 'tree-field') {
    const row = sparse.find((r) => r['id'] === refVal || r['value'] === refVal)
    const v   = row?.[op.field]
    return v != null ? v : (op.fallback ?? null)
  }

  // map-field: first row is the code→value map; look up String(ref)
  const v = sparse[0]?.[String(refVal)]
  return v != null ? v : (op.fallback ?? null)
}

/**
 * Evaluate a NodeDeriveMap and return the accumulated derived Record.
 * Each entry's key is immediately available to subsequent entries via {$derived: key}.
 * Data-lookup ops call interpretSpec; pure ExprVal entries delegate to @statdash/expr.
 */
export function evalNodeDerive(
  derive: NodeDeriveMap,
  scope:  ExprScope,
  ctx:    SectionContext,
  store:  DataStore,
): Record<string, DimVal> {
  const result: Record<string, DimVal> = { ...scope.derived }
  const inner:  ExprScope = { ...scope }

  for (const { key, expr } of derive) {
    const value: DimVal = isDataLookupOp(expr)
      ? evalDataLookup(expr, inner, ctx, store)
      : evalExpr<DimVal>(expr, inner)
    result[key]    = value
    inner.derived  = result
  }

  return result
}