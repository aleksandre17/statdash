// ── resolveConditionStyles ────────────────────────────────────────────
//
//  Evaluates StyleCond[] against runtime context (filter params + mode).
//  Returns merged NodeStyles for all matching conditions.
//  Used by shells: const override = resolveConditionStyles(def.view?.styles?.conditions, ctx)
//  Then: mergeStyles(def.view?.styles ?? {}, override)
//
//  param conditions → evaluated at render time (JS)
//  mode  conditions → evaluated at render time (JS)
//  Breakpoint conditions → handled by CSS ([data-aspect] media queries) — not evaluated here.
//

import type { StyleCond, StyleExpr, NodeStyles } from '../types'
import { mergeStyles }                            from '../utils/compose'

function evalExpr(
  expr:   StyleExpr,
  params: Record<string, unknown>,
  mode:   string,
): boolean {
  if ('param' in expr && 'is'  in expr) return params[expr.param] === expr.is
  if ('param' in expr && 'not' in expr) return params[expr.param] !== expr.not
  if ('mode'  in expr)                  return mode === expr.mode
  return false
}

export function resolveConditionStyles(
  conditions:   StyleCond[] | undefined,
  filterParams: Record<string, unknown>,
  mode:         string,
): NodeStyles {
  if (!conditions?.length) return {}
  return conditions
    .filter(c => evalExpr(c.when, filterParams, mode))
    .reduce<NodeStyles>((acc, c) => mergeStyles(acc, c.apply as NodeStyles), {})
}