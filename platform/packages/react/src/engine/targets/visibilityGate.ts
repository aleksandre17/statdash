// ── targets/visibilityGate.ts — the SSR walkers' perspective gate [P-opt] ────
//
//  The SSR/warm walkers (warm.ts, api.ts) must honour the SAME visibility gate
//  the live DOM already applies in renderNode.ts:228-231, so that only the
//  ACTIVE perspective's requirements warm/resolve. Pre-P-opt the walkers ignored
//  `view.visibleWhen` and eagerly warmed BOTH perspectives (~2× slices/snapshot);
//  the live DOM never paid this because renderNode gates BEFORE resolveNodeRows.
//
//  This module is the single home for that replicated gate (Law 5: one concern,
//  one home) so warm.ts and api.ts cannot drift from each other or from renderNode.
//
//  evalVisibility lives in packages/core (engine-pure) → the React walkers may
//  call it; this crosses NO dependency-arrow boundary (react ← core).
//

import { evalVisibility } from '@statdash/engine'
import type { VisibilityExpr } from '@statdash/engine'

/** The active-perspective gate inputs — mirrors renderNode.ts:229 exactly. */
export interface VisibilityGate {
  /** ctx.filterParams — the filter values evalVisibility resolves param refs against. */
  filterParams: Record<string, unknown>
  /** The active perspective id — ctx.mode.current on the live path. */
  activeView:   string | undefined
}

/**
 * True when `node` is visible in the active perspective — the EXACT predicate
 * the live renderNode uses (`renderNode.ts:228-231`):
 *
 * ```ts
 * if (migrated.view?.visibleWhen)
 *   if (!evalVisibility(migrated.view.visibleWhen, ctx.filterParams, ctx.mode.current)) return null
 * ```
 *
 * A node with no `view.visibleWhen` is always visible (ungated). When gated,
 * the result is `evalVisibility(expr, gate.filterParams, gate.activeView)`.
 *
 * Generic node access (Record-typed) so the same predicate serves both the
 * untyped warm walk and the api walk without coupling to a concrete node shape.
 */
export function isNodeVisibleInActiveView(
  node: Record<string, unknown>,
  gate: VisibilityGate,
): boolean {
  const view = node['view'] as { visibleWhen?: VisibilityExpr } | undefined
  const expr = view?.visibleWhen
  if (!expr) return true
  return evalVisibility(expr, gate.filterParams, gate.activeView)
}
