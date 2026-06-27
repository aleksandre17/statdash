// ── VisibilityExpr — node visibility gate ─────────────────────────────
//
//  The boolean-expression tree behind every node's `visibleWhen` gate.
//  renderNode evaluates it for ALL node types — generic platform vocabulary,
//  not section-specific.
//  100% JSON-serializable → Constructor (phase 2) generates any combination.
//

import type { DimVal } from '../sdmx'
import { activePerspective } from './perspective-state'

/**
 * Resolve the active id for a perspective-* op. With an explicit `param` the op
 * reads `perspectiveState[param]` directly (the multi-axis path — Law 1, the param
 * is data). Param-less, it resolves the conventional single axis via
 * `activePerspective`.
 */
function activeForExpr(
  perspectiveState: Record<string, string> | undefined,
  param:            string | undefined,
): string | undefined {
  if (param != null) return perspectiveState?.[param]
  return activePerspective(perspectiveState)
}

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
  // ── Perspective-aware ops — the CANONICAL perspective-axis gate (VISION #3) ──
  //  Read the active id from the `perspectiveState` SSOT, NOT filterParams. An
  //  explicit `param` selects the axis (`perspectiveState[param]`) — Law 1, the
  //  param is data, so a page may carry many orthogonal axes. Param-less, the op
  //  resolves the conventional single axis (`activePerspective`) — which is what a
  //  config authoring `{op:'perspective-is', perspective:'range'}` (no param) gets.
  | { op: 'perspective-is';  perspective:  string;   param?: string }
  | { op: 'perspective-in';  perspectives: string[]; param?: string }
  | { op: 'perspective-not'; perspective:  string;   param?: string }

// ── evalVisibility ────────────────────────────────────────────────────
//
//  Pure evaluator for VisibilityExpr boolean trees.
//  Called by renderNode + the SSR walkers to decide which nodes to render.
//  Lives in engine — pure logic, zero React.
//
//  fr = PageFiltersResult cast to Record<string, unknown>.
//  undefined values normalised to null (no-selection state).
//
//  THE SSOT (VISION #3 / P1 — HIGH-3): the active perspective id is read from the
//  `perspectiveState: Record<param, activeId>` SSOT (the Harel orthogonal-regions
//  container on SectionContext). EVERY callsite passes the SAME record (renderNode,
//  both SSR walkers, navUtils, the kpi-strip). A param-less `perspective-*` op
//  resolves the active id via `activePerspective` (the conventional axis). Absent
//  perspectiveState ⇒ a `perspective-*` op is false (the N=1-free default).
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
    // Canonical perspective-* ops (P2). Explicit param → that axis; else the
    // conventional axis (activePerspective) — making param-less == the mode-* aliases.
    case 'perspective-is':  { const m = activeForExpr(perspectiveState, expr.param); return m != null && m === expr.perspective }
    case 'perspective-in':  { const m = activeForExpr(perspectiveState, expr.param); return m != null && expr.perspectives.includes(m) }
    case 'perspective-not': { const m = activeForExpr(perspectiveState, expr.param); return m != null && m !== expr.perspective }
  }
}
