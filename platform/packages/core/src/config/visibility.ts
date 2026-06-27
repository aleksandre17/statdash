// ── VisibilityExpr — node visibility gate ─────────────────────────────
//
//  The boolean-expression tree behind every node's `visibleWhen` gate.
//  renderNode evaluates it for ALL node types — generic platform vocabulary,
//  not section-specific.
//  100% JSON-serializable → Constructor (phase 2) generates any combination.
//

import type { DimVal } from '../sdmx'
import type { ModeId } from '../mode/types'
import { activePerspective } from './perspective-state'

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
  // Mode-aware ops — read the active perspective id from the perspectiveState SSOT,
  // NOT filterParams. Old { op:'eq', param:'mode' } still works (reads filterParams).
  // The generic `perspective-is`/`perspective-in`/`perspective-not` ops (carrying an
  // explicit `param`) land in P2; these param-less legacy ops resolve via
  // activePerspective (the conventional axis) and retire in P6.
  | { op: 'mode-is';  mode:  ModeId   }
  | { op: 'mode-in';  modes: ModeId[] }
  | { op: 'mode-not'; mode:  ModeId   }

// ── evalVisibility ────────────────────────────────────────────────────
//
//  Pure evaluator for VisibilityExpr boolean trees.
//  Called by renderNode + the SSR walkers to decide which nodes to render.
//  Lives in engine — pure logic, zero React.
//
//  fr = PageFiltersResult cast to Record<string, unknown>.
//  undefined values normalised to null (no-selection state).
//
//  THE SSOT MIGRATION (VISION #3 / P1 — HIGH-3): the active perspective id no
//  longer arrives as a positional `mode?` sourced from a React `ModeContext`; it is
//  read from the `perspectiveState: Record<param, activeId>` SSOT (the Harel
//  orthogonal-regions container on SectionContext). EVERY callsite passes the SAME
//  record (renderNode, both SSR walkers, navUtils). A param-less `mode-*` op resolves
//  the active id via `activePerspective` (the conventional axis). Absent
//  perspectiveState ⇒ a `mode-*` op is false — byte-identical to the pre-P1 path
//  where an undefined positional `mode` made the op false (N=1-free).
//
export function evalVisibility(
  expr:             VisibilityExpr,
  fr:               Record<string, unknown>,
  perspectiveState?: Record<string, string>,
): boolean {
  switch (expr.op) {
    case 'eq':       return (fr[expr.param] ?? null) === expr.is
    case 'neq':      return (fr[expr.param] ?? null) !== expr.is
    case 'in':       return expr.values.includes(fr[expr.param] as (typeof expr.values)[0])
    case 'isset':    { const v = fr[expr.param]; return v !== undefined && v !== null && v !== '' }
    case 'and':      return expr.exprs.every((e) => evalVisibility(e, fr, perspectiveState))
    case 'or':       return expr.exprs.some((e)  => evalVisibility(e, fr, perspectiveState))
    case 'not':      return !evalVisibility(expr.expr, fr, perspectiveState)
    case 'mode-is':  { const m = activePerspective(perspectiveState); return m != null && m === expr.mode }
    case 'mode-in':  { const m = activePerspective(perspectiveState); return m != null && expr.modes.includes(m) }
    case 'mode-not': { const m = activePerspective(perspectiveState); return m != null && m !== expr.mode }
  }
}
