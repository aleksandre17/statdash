import type { DimVal, Expr, ExprRef, ExprScope, ExprVal } from './types.ts'
import { isDimVal, isExpr, isExprRef } from './guards.ts'
import { evalComparison } from './ops/comparison.ts'
import { evalLogic }      from './ops/logic.ts'
import { evalString }     from './ops/string.ts'
import { evalMath }       from './ops/math.ts'
import { evalLookup }     from './ops/lookup.ts'
import { evalCollection } from './ops/collection.ts'
import { ExprEvalError }  from './errors.ts'

// ── Plugin registry — engine-registered ops ───────────────────────────────────
//
//  @statdash/expr stays zero-dep. Higher layers (engine, plugins) register their
//  domain ops here at bootstrap, extending the evaluator without touching this file.
//
//  Pattern: registerSpec / registerChart in @statdash/engine uses the same idea.
//
const _exprOpRegistry = new Map<string, (expr: Record<string, unknown>, scope: ExprScope) => unknown>()

export function registerExprOp(
  op:      string,
  handler: (expr: Record<string, unknown>, scope: ExprScope) => unknown,
): void {
  _exprOpRegistry.set(op, handler)
}

// Resolves ExprRef → DimVal from scope. Never throws — missing keys → null.
function evalRef(ref: ExprRef, scope: ExprScope): DimVal {
  if ('$ctx'     in ref) return scope.dims[ref.$ctx]         ?? null
  if ('$derived' in ref) return scope.derived[ref.$derived]  ?? null
  if ('$row'     in ref) return scope.row?.[ref.$row]        ?? null  // null outside collection op
  if ('$literal' in ref) return ref.$literal
  return null
}

// Single entry point. Generic T lets callers express the expected result type.
// evalExpr<boolean>(node.visibleWhen, scope)  — TypeScript enforces caller intent
// evalExpr<string>(view.subtitle, scope)
export function evalExpr<T = DimVal>(expr: ExprVal, scope: ExprScope): T {
  // DimVal literal — fastest path (most common in filter values)
  if (isDimVal(expr)) return expr as unknown as T

  // ExprRef — resolve from scope
  if (isExprRef(expr)) return evalRef(expr, scope) as unknown as T

  // Expr — dispatch to op group
  if (isExpr(expr)) return evalOp(expr, scope) as unknown as T

  return null as unknown as T
}

function evalOp(expr: Expr, scope: ExprScope): unknown {
  switch (expr.op) {
    // ── Comparison ──────────────────────────────────────────────────────────
    case 'eq':
    case 'ne':
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte':
    case 'in':
    case 'nin':
    case 'null':
    case 'exists':
      return evalComparison(expr, scope, evalExpr)

    // ── Logic ────────────────────────────────────────────────────────────────
    case 'and':
    case 'or':
    case 'not':
    case 'if':
      return evalLogic(expr, scope, evalExpr)

    // ── String ───────────────────────────────────────────────────────────────
    case 'template':
    case 'concat':
    case 'startsWith':
    case 'includes':
      return evalString(expr, scope, evalExpr)

    // ── Math ─────────────────────────────────────────────────────────────────
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod':
    case 'abs':
    case 'neg':
      return evalMath(expr, scope, evalExpr)

    // ── Lookup ───────────────────────────────────────────────────────────────
    case 'get':
    case 'coalesce':
      return evalLookup(expr, scope, evalExpr, evalRef)

    // ── Collection ───────────────────────────────────────────────────────────
    case 'some':
    case 'every':
    case 'filter':
    case 'count':
    case 'map':
      return evalCollection(expr, scope, evalExpr)

    default: {
      const op      = (expr as { op: string }).op
      const handler = _exprOpRegistry.get(op)
      if (handler) return handler(expr as Record<string, unknown>, scope)
      throw new ExprEvalError(`[evalExpr] unknown op: '${op}'`, expr, scope)
    }
  }
}