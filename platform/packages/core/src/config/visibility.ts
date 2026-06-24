// ── VisibilityExpr — node visibility gate ─────────────────────────────
//
//  The boolean-expression tree behind every node's `visibleWhen` gate.
//  renderNode evaluates it for ALL node types — generic platform vocabulary,
//  not section-specific.
//  100% JSON-serializable → Constructor (phase 2) generates any combination.
//

import type { DimVal } from '../sdmx'
import type { ModeId } from '../mode/types'

// ── VisibilityExpr — boolean expression tree ──────────────────────────
//
//  Evaluated by evalVisibility(expr, filterParams) in Page.tsx.
//  100% JSON-serializable → Constructor (phase 2) generates any combination.
//
export type VisibilityExpr =
  | { op: 'eq';       param: string; is: DimVal | null }
  | { op: 'neq';      param: string; is: DimVal | null }
  | { op: 'in';       param: string; values: DimVal[]  }
  | { op: 'isset';    param: string }
  | { op: 'and';      exprs: VisibilityExpr[] }
  | { op: 'or';       exprs: VisibilityExpr[] }
  | { op: 'not';      expr:  VisibilityExpr  }
  // Mode-aware ops — use ModeContext.current, not filterParams. Old { op:'eq', param:'mode' } still works.
  | { op: 'mode-is';  mode:  ModeId   }
  | { op: 'mode-in';  modes: ModeId[] }
  | { op: 'mode-not'; mode:  ModeId   }

// ── evalVisibility ────────────────────────────────────────────────────
//
//  Pure evaluator for VisibilityExpr boolean trees.
//  Called by Page.tsx to decide which sections to render.
//  Lives in engine — pure logic, zero React.
//
//  fr = PageFiltersResult cast to Record<string, unknown>.
//  undefined values normalised to null (no-selection state).
//
export function evalVisibility(
  expr: VisibilityExpr,
  fr:   Record<string, unknown>,
  mode?: ModeId,
): boolean {
  switch (expr.op) {
    case 'eq':       return (fr[expr.param] ?? null) === expr.is
    case 'neq':      return (fr[expr.param] ?? null) !== expr.is
    case 'in':       return expr.values.includes(fr[expr.param] as (typeof expr.values)[0])
    case 'isset':    { const v = fr[expr.param]; return v !== undefined && v !== null && v !== '' }
    case 'and':      return expr.exprs.every((e) => evalVisibility(e, fr, mode))
    case 'or':       return expr.exprs.some((e)  => evalVisibility(e, fr, mode))
    case 'not':      return !evalVisibility(expr.expr, fr, mode)
    case 'mode-is':  return mode != null && mode === expr.mode
    case 'mode-in':  return mode != null && expr.modes.includes(mode)
    case 'mode-not': return mode != null && mode !== expr.mode
  }
}
