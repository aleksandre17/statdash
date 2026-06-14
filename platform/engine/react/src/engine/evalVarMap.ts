// ── evalVarMap — evaluate VarMap against filter context ───────────────────
//
//  Extracted from SiteRenderer so both page-level (SiteRenderer) and
//  node-level (renderNode step 2.5) can share the same evaluation logic.
//
//  ExprScope assembly:
//    dims    — all filter params (enables { $ctx: 'key' } references)
//    derived — accumulates so each var can reference earlier vars
//    ctx     — store classifiers + display for domain-specific ops
//              (find, breadcrumbs, join-labels, …)
//

import { evalExpr, isDimVal }               from '@geostat/expr'
import type { ExprScope, ExprVal, DimVal }  from '@geostat/expr'
import type { VarMap }                      from '@geostat/engine'
import type { RenderContext }               from './types'

export function evalVarMap(
  vars:    VarMap,
  ctx:     Pick<RenderContext, 'filterParams' | 'vars' | 'stores' | 'pageStoreKey'>,
): Record<string, unknown> {
  const pageStore = ctx.stores[ctx.pageStoreKey ?? '']
    ?? Object.values(ctx.stores)[0]
    ?? null

  const scope: ExprScope = {
    dims:    ctx.filterParams as Record<string, DimVal>,
    derived: { ...(ctx.vars as Record<string, DimVal>) },
    ctx:     {
      classifiers: pageStore?.classifiers,
      display:     pageStore?.display,
      raw:         ctx.filterParams as Record<string, string>,
    },
  }

  const result: Record<string, unknown> = {}
  for (const [k, expr] of Object.entries(vars)) {
    const value = evalExpr(expr as unknown as ExprVal, scope)
    result[k]   = value
    if (isDimVal(value)) scope.derived[k] = value
  }
  return result
}