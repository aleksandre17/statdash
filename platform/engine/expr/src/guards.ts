import type { DimVal, Expr, ExprRef, ExprVal, ListRef } from './types.ts'

export function isDimVal(val: unknown): val is DimVal {
  return (
    val === null      ||
    typeof val === 'string'  ||
    typeof val === 'number'  ||
    typeof val === 'boolean'
  )
}

export function isExprRef(val: unknown): val is ExprRef {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false
  const o = val as Record<string, unknown>
  return '$ctx' in o || '$derived' in o || '$row' in o || '$literal' in o
}

export function isListRef(val: unknown): val is ListRef {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false
  return '$rows' in (val as Record<string, unknown>)
}

export function isExpr(val: unknown): val is Expr {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false
  return 'op' in (val as Record<string, unknown>)
}

export function classifyExprVal(val: ExprVal): 'dimval' | 'ref' | 'expr' {
  if (isDimVal(val))    return 'dimval'
  if (isExprRef(val))   return 'ref'
  return 'expr'
}